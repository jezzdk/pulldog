// composables/useGithub.ts
import type { ComputedRef } from "vue";
import type { PullRequest, ReviewStatus } from "@/types";

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
  user: { login: string };
}

interface GithubRawPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean;
  created_at: string;
  merged_at: string | null;
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

export function useGithub(
  token: ComputedRef<string>,
  titleFilter: ComputedRef<RegExp | null> = {
    value: null,
  } as ComputedRef<RegExp | null>,
) {
  async function gh<T>(path: string, overrideToken?: string): Promise<T> {
    const tok = overrideToken ?? token.value;
    const r = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `token ${tok}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!r.ok) {
      const b = (await r
        .json()
        .catch((): GithubErrorBody => ({}))) as GithubErrorBody;
      throw new Error(`GitHub ${r.status}: ${b.message ?? "error"}`);
    }

    return r.json() as Promise<T>;
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

    // Open PRs: must paginate fully — a PR that hasn't been touched in months
    // is still open and must not be silently dropped.
    // Closed PRs: sorted by updated desc, so once a full page has no PR merged
    // within the cutoff window we can stop — anything deeper is older.
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
            batch.every(
              (pr) =>
                pr.merged_at === null ||
                new Date(pr.merged_at).getTime() <= cutoff,
            ),
        },
      ),
    ]);

    let relevant = [
      ...openRaw,
      ...closedRaw.filter(
        (pr) =>
          pr.merged_at !== null && new Date(pr.merged_at).getTime() > cutoff,
      ),
    ];

    const re = titleFilter.value;

    if (re) {
      relevant = relevant.filter((pr) => !re.test(pr.title));
    }

    return Promise.all(
      relevant.map(async (pr): Promise<PullRequest> => {
        // Merged PRs: status is known — skip review enrichment
        if (pr.merged_at !== null) {
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
            labels: pr.labels ?? [],
            reviewStatus: "merged",
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
          gh<GithubReview[]>(
            `/repos/${owner}/${repo}/pulls/${pr.number}/reviews`,
          ),
          gh<{ comments: number; review_comments: number }>(
            `/repos/${owner}/${repo}/pulls/${pr.number}`,
          ),
        ]);

        if (prDetailRes.status === "fulfilled") {
          commentCount =
            (prDetailRes.value.comments ?? 0) +
            (prDetailRes.value.review_comments ?? 0);
        }

        let reviewedAt: Date | undefined;

        if (reviewsRes.status === "fulfilled" && !pr.draft) {
          const latest: Record<
            string,
            { state: string; submitted_at: string }
          > = {};

          for (const rv of reviewsRes.value) {
            if (rv.state !== "COMMENTED") {
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
      mergedRecently.map((pr) =>
        gh<GithubReview[]>(
          `/repos/${owner}/${repo}/pulls/${pr.number}/reviews`,
        ),
      ),
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
  };
}
