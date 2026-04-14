// composables/useGithub.ts
import type { ComputedRef } from "vue";
import { slaStatus } from "@/composables/useSla";
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
  created7d: number;
  merged7d: number;
  avgLeadTimeHours: number | null;
}

export interface ReviewStatsMetrics {
  avgTimeToReviewHours: number | null;
  avgTimeToMergeHours: number | null;
  reviewedCount: number;
  mergedWithApprovalCount: number;
}

export function useGithub(token: ComputedRef<string>) {
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

  async function fetchRepo(repoFull: string): Promise<PullRequest[]> {
    const [owner, repo] = repoFull.split("/");
    const cutoff = Date.now() - 24 * 3_600_000;

    const allRaw = await gh<GithubRawPR[]>(
      `/repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=updated&direction=desc`,
    );

    const relevant = allRaw.filter(
      (pr) =>
        pr.state === "open" ||
        (pr.merged_at !== null && new Date(pr.merged_at).getTime() > cutoff),
    );

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
          const latest: Record<string, { state: string; submitted_at: string }> = {};
          for (const rv of reviewsRes.value) {
            if (rv.state !== "COMMENTED") latest[rv.user.login] = rv;
          }
          const entries = Object.values(latest);
          const states = entries.map((e) => e.state);
          if (states.includes("CHANGES_REQUESTED")) reviewStatus = "changes";
          else if (states.length && states.every((s) => s === "APPROVED"))
            reviewStatus = "approved";
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

    const [closedRaw, openRaw] = await Promise.all([
      gh<GithubRawPR[]>(
        `/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
      ),
      gh<GithubRawPR[]>(
        `/repos/${owner}/${repo}/pulls?state=open&per_page=100`,
      ),
    ]);

    const byId: Record<number, GithubRawPR> = {};
    for (const pr of [...closedRaw, ...openRaw]) byId[pr.id] = pr;
    const all = Object.values(byId);

    const created7d = all.filter(
      (pr) => new Date(pr.created_at).getTime() >= windowStart,
    );
    const merged7d = all.filter(
      (pr) =>
        pr.merged_at !== null &&
        new Date(pr.merged_at).getTime() >= windowStart,
    );

    let avgLeadTimeHours: number | null = null;
    if (merged7d.length > 0) {
      const totalMs = merged7d.reduce((sum, pr) => {
        return (
          sum +
          (new Date(pr.merged_at!).getTime() -
            new Date(pr.created_at).getTime())
        );
      }, 0);
      avgLeadTimeHours = totalMs / merged7d.length / 3_600_000;
    }

    return {
      created7d: created7d.length,
      merged7d: merged7d.length,
      avgLeadTimeHours,
    };
  }

  async function fetchReviewStats(
    repoFull: string,
    periodMs: number,
  ): Promise<ReviewStatsMetrics> {
    const [owner, repo] = repoFull.split("/");
    const windowStart = Date.now() - periodMs;

    const closedRaw = await gh<GithubRawPR[]>(
      `/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
    );
    const mergedRecently = closedRaw.filter(
      (pr) =>
        pr.merged_at !== null &&
        new Date(pr.merged_at).getTime() >= windowStart,
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
      if (result.status !== "fulfilled") continue;

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
        reviewedCount > 0
          ? totalReviewMs / reviewedCount / 3_600_000
          : null,
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
    const result: string[] = [];
    let page = 1;
    while (page <= 5) {
      const batch = await gh<GithubRepo[]>(
        `/user/repos?per_page=100&sort=pushed&page=${page}&affiliation=owner,collaborator,organization_member`,
        overrideToken,
      );
      for (const r of batch) {
        if (!r.archived) result.push(r.full_name);
      }
      if (batch.length < 100) break;
      page++;
    }
    return result;
  }

  return { fetchRepo, checkIfMerged, fetchRecentActivity, fetchReviewStats, fetchAvailableRepos };
}
