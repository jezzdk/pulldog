// composables/useGithub.ts
import { readonly, ref } from "vue";
import type { ComputedRef } from "vue";
import type { GithubUser, PullRequest, ReviewStatus } from "@/types";

interface GithubErrorBody {
  message?: string;
}

interface GithubRepo {
  full_name: string;
  archived: boolean;
}

interface GithubReview {
  state: string;
  submitted_at: string;
  user: GithubUser | null;
}

interface GithubRawPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  user: { login: string; avatar_url: string };
  assignees: Array<{ login: string; avatar_url: string }>;
  requested_reviewers: Array<{ login: string; avatar_url: string }>;
  labels: Array<{ name: string; color: string }>;
  comments: number;
  review_comments: number;
  head: { sha: string };
}

export interface ActivityMetrics {
  createdInPeriod: number;
  mergedInPeriod: number;
  avgLeadTimeHours: number | null;
}

export interface ReviewStatsMetrics {
  avgTimeToReviewHours: number | null;
  avgTimeToMergeHours: number | null;
  reviewedCount: number;
  mergedWithApprovalCount: number;
}

export interface GithubRateLimit {
  limit: number | null;
  used: number | null;
  remaining: number | null;
  reset: Date | null;
}

export function useGithub(
  token: ComputedRef<string>,
  titleFilter: ComputedRef<RegExp | null> = {
    value: null,
  } as ComputedRef<RegExp | null>,
) {
  const rateLimit = ref<GithubRateLimit | null>(null);

  // ── caches (persist for the composable lifetime) ──────────────────
  // ETag cache: GitHub returns 304 Not Modified for unchanged resources,
  // and 304 responses do NOT count against the rate limit. Keyed by token
  // + path so a token swap (re-login) never serves another user's data.
  const etagCache = new Map<string, { etag: string; data: unknown }>();

  // Per-PR enrichment caches keyed by PR id. We only refetch a PR's reviews
  // or detail when its `updated_at` advances — unchanged PRs cost no request
  // at all (not even a conditional one), which is the dominant saving on a
  // busy repo where most open PRs are untouched between polls.
  const reviewsCache = new Map<
    number,
    { updatedAt: string; reviews: GithubReview[] }
  >();
  const detailCache = new Map<
    number,
    { updatedAt: string; comments: number; review_comments: number }
  >();

  // Per-cycle request dedup. Within a single refresh cycle, `fetchRepo`,
  // `fetchRecentActivity`, and `fetchReviewStats` all paginate the same
  // open/closed PR lists. Keyed by token+path, this collapses those identical
  // GETs into one in-flight promise so the same URL is fetched once per cycle.
  // Cleared at the start of every cycle (see resetRequestCache) so each cycle
  // still gets fresh data.
  const requestCache = new Map<string, Promise<unknown>>();

  function resetRequestCache(): void {
    requestCache.clear();
  }

  // Cache-tracing. Enable in the browser console with:
  //   localStorage.setItem("pulldog-debug-cache", "1")  // then reload
  // Disable with localStorage.removeItem("pulldog-debug-cache").
  const debugCache =
    typeof localStorage !== "undefined" &&
    localStorage.getItem("pulldog-debug-cache") === "1";

  function logCache(
    kind: "etag" | "reviews" | "detail" | "dedup",
    hit: boolean,
    label: string,
  ): void {
    if (!debugCache) {
      return;
    }

    const tag = hit ? "HIT " : "MISS";
    const color = hit ? "color:#16a34a" : "color:#dc2626";
    // eslint-disable-next-line no-console
    console.debug(
      `%c[cache ${tag}] %c${kind}%c ${label}`,
      color,
      "color:#888",
      "",
    );
  }

  function headerNumber(headers: Headers, name: string): number | null {
    const value = headers.get(name);

    if (value === null) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function captureRateLimit(headers: Headers): void {
    const limit = headerNumber(headers, "x-ratelimit-limit");
    const used = headerNumber(headers, "x-ratelimit-used");
    const remaining = headerNumber(headers, "x-ratelimit-remaining");
    const resetSeconds = headerNumber(headers, "x-ratelimit-reset");

    if (
      limit === null &&
      used === null &&
      remaining === null &&
      resetSeconds === null
    ) {
      return;
    }

    rateLimit.value = {
      limit,
      used,
      remaining,
      reset: resetSeconds === null ? null : new Date(resetSeconds * 1_000),
    };
  }

  // Dedup wrapper: collapses identical concurrent/in-cycle GETs into one
  // request. The actual fetching (with ETag revalidation) lives in ghFetch.
  function gh<T>(path: string, overrideToken?: string): Promise<T> {
    const tok = overrideToken ?? token.value;
    const cacheKey = `${tok}:${path}`;

    const inflight = requestCache.get(cacheKey);

    if (inflight) {
      logCache("dedup", true, path);
      return inflight as Promise<T>;
    }

    const promise = ghFetch<T>(path, tok, cacheKey);
    requestCache.set(cacheKey, promise);
    // Don't let a failed request stick around and poison later callers.
    promise.catch(() => requestCache.delete(cacheKey));
    return promise;
  }

  async function ghFetch<T>(
    path: string,
    tok: string,
    cacheKey: string,
  ): Promise<T> {
    const cached = etagCache.get(cacheKey);

    const headers: Record<string, string> = {
      Authorization: `token ${tok}`,
      Accept: "application/vnd.github+json",
    };

    if (cached) {
      headers["If-None-Match"] = cached.etag;
    }

    const r = await fetch(`https://api.github.com${path}`, { headers });

    captureRateLimit(r.headers);

    // Unchanged since last fetch — serve from cache. 304s are free (they do
    // not decrement the rate limit), which is the whole point of sending the
    // conditional request.
    if (r.status === 304 && cached) {
      logCache("etag", true, `304 ${path}`);
      return cached.data as T;
    }

    if (cached) {
      logCache("etag", false, `${r.status} ${path}`);
    }

    if (!r.ok) {
      const b = (await r
        .json()
        .catch((): GithubErrorBody => ({}))) as GithubErrorBody;
      throw new Error(`GitHub ${r.status}: ${b.message ?? "error"}`);
    }

    const data = (await r.json()) as T;
    const etag = r.headers.get("etag");

    if (etag) {
      etagCache.set(cacheKey, { etag, data });
    }

    return data;
  }

  // Reviews for a PR, refetched only when its `updated_at` changes.
  async function ghReviews(
    owner: string,
    repo: string,
    pr: GithubRawPR,
  ): Promise<GithubReview[]> {
    const hit = reviewsCache.get(pr.id);

    if (hit && hit.updatedAt === pr.updated_at) {
      logCache("reviews", true, `${repo}#${pr.number}`);
      return hit.reviews;
    }

    logCache("reviews", false, `${repo}#${pr.number}`);
    const reviews = await gh<GithubReview[]>(
      `/repos/${owner}/${repo}/pulls/${pr.number}/reviews`,
    );
    reviewsCache.set(pr.id, { updatedAt: pr.updated_at, reviews });
    return reviews;
  }

  function isCountedReviewState(state: string): boolean {
    return state === "APPROVED" || state === "CHANGES_REQUESTED";
  }

  function reviewersFromReviews(reviews: GithubReview[]): GithubUser[] {
    const reviewers: Record<string, GithubUser> = {};

    for (const review of reviews) {
      if (!review.user || !isCountedReviewState(review.state)) {
        continue;
      }

      reviewers[review.user.login] = review.user;
    }

    return Object.values(reviewers);
  }

  // PR detail (comment counts), refetched only when `updated_at` changes.
  async function ghDetail(
    owner: string,
    repo: string,
    pr: GithubRawPR,
  ): Promise<{ comments: number; review_comments: number }> {
    const hit = detailCache.get(pr.id);

    if (hit && hit.updatedAt === pr.updated_at) {
      logCache("detail", true, `${repo}#${pr.number}`);
      return { comments: hit.comments, review_comments: hit.review_comments };
    }

    logCache("detail", false, `${repo}#${pr.number}`);
    const detail = await gh<{ comments: number; review_comments: number }>(
      `/repos/${owner}/${repo}/pulls/${pr.number}`,
    );
    detailCache.set(pr.id, {
      updatedAt: pr.updated_at,
      comments: detail.comments ?? 0,
      review_comments: detail.review_comments ?? 0,
    });
    return detail;
  }

  /**
   * Fetch all pages of a paginated GitHub list endpoint.
   *
   * @param buildPath  Called with the current page number; must include
   *                   `per_page=100` in the URL.
   * @param maxPages   Hard cap on pages fetched (default 5 = 500 items).
   * @param earlyExit  Optional predicate — if it returns true for a batch,
   *                   pagination stops after that batch is appended.
   *                   Useful when results are sorted and we can tell the
   *                   remaining pages are irrelevant.
   */
  async function ghPaginated<T>(
    buildPath: (page: number) => string,
    {
      maxPages = 5,
      earlyExit,
      overrideToken,
    }: {
      maxPages?: number;
      earlyExit?: (batch: T[]) => boolean;
      overrideToken?: string;
    } = {},
  ): Promise<T[]> {
    const result: T[] = [];
    let page = 1;

    while (page <= maxPages) {
      const batch = await gh<T[]>(buildPath(page), overrideToken);
      result.push(...batch);

      if (batch.length < 100) {
        break;
      }

      if (earlyExit?.(batch)) {
        break;
      }

      page++;
    }

    return result;
  }

  async function fetchRepo(
    repoFull: string,
    periodMs = 24 * 3_600_000,
  ): Promise<PullRequest[]> {
    const [owner, repo] = repoFull.split("/");
    const cutoff = Date.now() - periodMs;

    // The moment a closed PR left the board: when it merged, or — if it was
    // closed without merging — when it was closed.
    const terminalMs = (pr: GithubRawPR): number | null => {
      const ts = pr.merged_at ?? pr.closed_at;
      return ts === null ? null : new Date(ts).getTime();
    };

    // Open PRs: must paginate fully — a PR that hasn't been touched in months
    // is still open and must not be silently dropped.
    // Closed PRs: sorted by updated desc, so once a full page has no PR whose
    // terminal event (merge or close) falls within the cutoff window we can
    // stop — anything deeper is older.
    const [openRaw, closedRaw] = await Promise.all([
      ghPaginated<GithubRawPR>(
        (page) =>
          `/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}`,
      ),
      ghPaginated<GithubRawPR>(
        (page) =>
          `/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc&page=${page}`,
        {
          earlyExit: (batch) =>
            batch.every((pr) => {
              const ms = terminalMs(pr);
              return ms === null || ms <= cutoff;
            }),
        },
      ),
    ]);

    let relevant = [
      ...openRaw,
      ...closedRaw.filter((pr) => {
        const ms = terminalMs(pr);
        return ms !== null && ms > cutoff;
      }),
    ];

    const re = titleFilter.value;

    if (re) {
      relevant = relevant.filter((pr) => !re.test(pr.title));
    }

    return Promise.all(
      relevant.map(async (pr): Promise<PullRequest> => {
        // Merged/closed PRs need reviews for the reviewer leaderboard.
        if (pr.merged_at !== null) {
          const reviews = await ghReviews(owner, repo, pr).catch(() => []);

          return {
            id: pr.id,
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            draft: false,
            createdAt: new Date(pr.created_at),
            mergedAt: new Date(pr.merged_at),
            author: pr.user,
            assignees: pr.assignees ?? [],
            requestedReviewers: pr.requested_reviewers ?? [],
            reviewers: reviewersFromReviews(reviews),
            labels: pr.labels ?? [],
            reviewStatus: "merged",
            commentCount: (pr.comments ?? 0) + (pr.review_comments ?? 0),
            repo: repoFull,
            _flashClass: "",
            _slaRowCss: "",
          };
        }

        if (pr.closed_at !== null) {
          const reviews = await ghReviews(owner, repo, pr).catch(() => []);

          return {
            id: pr.id,
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            draft: false,
            createdAt: new Date(pr.created_at),
            closedAt: new Date(pr.closed_at),
            author: pr.user,
            assignees: pr.assignees ?? [],
            requestedReviewers: pr.requested_reviewers ?? [],
            reviewers: reviewersFromReviews(reviews),
            labels: pr.labels ?? [],
            reviewStatus: "closed",
            commentCount: (pr.comments ?? 0) + (pr.review_comments ?? 0),
            repo: repoFull,
            _flashClass: "",
            _slaRowCss: "",
          };
        }

        // Open PRs: enrich with reviews + comment counts
        let reviewStatus: ReviewStatus = pr.draft ? "draft" : "open";
        let commentCount = 0;

        const [reviewsRes, prDetailRes] = await Promise.allSettled([
          ghReviews(owner, repo, pr),
          ghDetail(owner, repo, pr),
        ]);

        if (prDetailRes.status === "fulfilled") {
          commentCount =
            (prDetailRes.value.comments ?? 0) +
            (prDetailRes.value.review_comments ?? 0);
        }

        const reviews =
          reviewsRes.status === "fulfilled" ? reviewsRes.value : [];
        const reviewers = reviewersFromReviews(reviews);
        let reviewedAt: Date | undefined;

        if (!pr.draft) {
          const latest: Record<
            string,
            { state: string; submitted_at: string }
          > = {};

          for (const rv of reviews) {
            if (rv.user && rv.state !== "COMMENTED") {
              latest[rv.user.login] = rv;
            }
          }

          const entries = Object.values(latest);
          const states = entries.map((e) => e.state);

          if (states.includes("CHANGES_REQUESTED")) {
            reviewStatus = "changes";
          } else if (states.length && states.every((s) => s === "APPROVED")) {
            reviewStatus = "approved";
          }

          if (entries.length) {
            const latest_ts = entries.reduce((a, b) =>
              a.submitted_at > b.submitted_at ? a : b,
            );
            reviewedAt = new Date(latest_ts.submitted_at);
          }
        }

        return {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          draft: pr.draft,
          createdAt: new Date(pr.created_at),
          author: pr.user,
          assignees: pr.assignees ?? [],
          requestedReviewers: pr.requested_reviewers ?? [],
          reviewers,
          labels: pr.labels ?? [],
          reviewStatus,
          commentCount,
          repo: repoFull,
          reviewedAt,
          _flashClass: "",
          _slaRowCss: "",
        };
      }),
    );
  }

  async function checkIfMerged(
    repoFull: string,
    prNumber: number,
  ): Promise<boolean> {
    const [owner, repo] = repoFull.split("/");

    try {
      const pr = await gh<GithubRawPR>(
        `/repos/${owner}/${repo}/pulls/${prNumber}`,
      );
      return pr.merged_at !== null;
    } catch (_) {
      return false;
    }
  }

  async function fetchRecentActivity(
    repoFull: string,
    periodMs: number,
  ): Promise<ActivityMetrics> {
    const [owner, repo] = repoFull.split("/");
    const windowStart = Date.now() - periodMs;

    // Stop fetching closed PRs once a full page has no PR merged inside the
    // window — results are sorted by updated desc so deeper pages are older.
    const [closedRaw, openRaw] = await Promise.all([
      ghPaginated<GithubRawPR>(
        (page) =>
          `/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc&page=${page}`,
        {
          earlyExit: (batch) =>
            batch.every(
              (pr) =>
                pr.merged_at === null ||
                new Date(pr.merged_at).getTime() < windowStart,
            ),
        },
      ),
      ghPaginated<GithubRawPR>(
        (page) =>
          `/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}`,
      ),
    ]);

    const byId: Record<number, GithubRawPR> = {};

    for (const pr of [...closedRaw, ...openRaw]) {
      byId[pr.id] = pr;
    }

    const all = Object.values(byId);

    const reActivity = titleFilter.value;
    const createdInPeriod = all.filter(
      (pr) =>
        new Date(pr.created_at).getTime() >= windowStart &&
        (!reActivity || !reActivity.test(pr.title)),
    );
    const mergedInPeriod = all.filter(
      (pr) =>
        pr.merged_at !== null &&
        new Date(pr.merged_at).getTime() >= windowStart &&
        (!reActivity || !reActivity.test(pr.title)),
    );

    let avgLeadTimeHours: number | null = null;

    if (mergedInPeriod.length > 0) {
      const totalMs = mergedInPeriod.reduce(
        (sum, pr) =>
          sum +
          new Date(pr.merged_at!).getTime() -
          new Date(pr.created_at).getTime(),
        0,
      );
      avgLeadTimeHours = totalMs / mergedInPeriod.length / 3_600_000;
    }

    return {
      createdInPeriod: createdInPeriod.length,
      mergedInPeriod: mergedInPeriod.length,
      avgLeadTimeHours,
    };
  }

  async function fetchReviewStats(
    repoFull: string,
    periodMs: number,
  ): Promise<ReviewStatsMetrics> {
    const [owner, repo] = repoFull.split("/");
    const windowStart = Date.now() - periodMs;

    const closedRaw = await ghPaginated<GithubRawPR>(
      (page) =>
        `/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc&page=${page}`,
      {
        earlyExit: (batch) =>
          batch.every(
            (pr) =>
              pr.merged_at === null ||
              new Date(pr.merged_at).getTime() < windowStart,
          ),
      },
    );
    const reReview = titleFilter.value;
    const mergedRecently = closedRaw.filter(
      (pr) =>
        pr.merged_at !== null &&
        new Date(pr.merged_at).getTime() >= windowStart &&
        (!reReview || !reReview.test(pr.title)),
    );

    if (mergedRecently.length === 0) {
      return {
        avgTimeToReviewHours: null,
        avgTimeToMergeHours: null,
        reviewedCount: 0,
        mergedWithApprovalCount: 0,
      };
    }

    const reviewResults = await Promise.allSettled(
      mergedRecently.map((pr) => ghReviews(owner, repo, pr)),
    );

    let totalReviewMs = 0,
      reviewedCount = 0;
    let totalMergeMs = 0,
      mergedWithApprovalCount = 0;

    for (let i = 0; i < mergedRecently.length; i++) {
      const pr = mergedRecently[i]!;
      const result = reviewResults[i]!;

      if (result.status !== "fulfilled") {
        continue;
      }

      const reviews = result.value;

      // Time to first review (excluding plain comments)
      const substantive = reviews.filter((r) => r.state !== "COMMENTED");

      if (substantive.length > 0) {
        const first = substantive.reduce((a, b) =>
          a.submitted_at < b.submitted_at ? a : b,
        );
        const ms =
          new Date(first.submitted_at).getTime() -
          new Date(pr.created_at).getTime();

        if (ms > 0) {
          totalReviewMs += ms;
          reviewedCount++;
        }
      }

      // Time from last approval to merge
      if (pr.merged_at) {
        const approvals = reviews.filter((r) => r.state === "APPROVED");

        if (approvals.length > 0) {
          const lastApproval = approvals.reduce((a, b) =>
            a.submitted_at > b.submitted_at ? a : b,
          );
          const ms =
            new Date(pr.merged_at).getTime() -
            new Date(lastApproval.submitted_at).getTime();

          if (ms >= 0) {
            totalMergeMs += ms;
            mergedWithApprovalCount++;
          }
        }
      }
    }

    return {
      avgTimeToReviewHours:
        reviewedCount > 0 ? totalReviewMs / reviewedCount / 3_600_000 : null,
      avgTimeToMergeHours:
        mergedWithApprovalCount > 0
          ? totalMergeMs / mergedWithApprovalCount / 3_600_000
          : null,
      reviewedCount,
      mergedWithApprovalCount,
    };
  }

  async function fetchAvailableRepos(
    overrideToken?: string,
  ): Promise<string[]> {
    const repos = await ghPaginated<GithubRepo>(
      (page) =>
        `/user/repos?per_page=100&sort=pushed&page=${page}&affiliation=owner,collaborator,organization_member`,
      { maxPages: 5, overrideToken },
    );
    return repos.filter((r) => !r.archived).map((r) => r.full_name);
  }

  return {
    fetchRepo,
    checkIfMerged,
    fetchRecentActivity,
    fetchReviewStats,
    fetchAvailableRepos,
    resetRequestCache,
    rateLimit: readonly(rateLimit),
  };
}
