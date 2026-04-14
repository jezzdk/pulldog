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
  user: { login: string };
}

interface GithubRawPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
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
    const prs = await gh<GithubRawPR[]>(
      `/repos/${owner}/${repo}/pulls?state=open&per_page=50`,
    );

    return Promise.all(
      prs.map(async (pr): Promise<PullRequest> => {
        // Draft is known from the PR itself — set before enrichment so it
        // survives even if the API calls below fail.
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

        if (reviewsRes.status === "fulfilled" && !pr.draft) {
          const latest: Record<string, string> = {};
          for (const rv of reviewsRes.value) {
            if (rv.state !== "COMMENTED") latest[rv.user.login] = rv.state;
          }
          const states = Object.values(latest);
          if (states.includes("CHANGES_REQUESTED")) reviewStatus = "changes";
          else if (states.length && states.every((s) => s === "APPROVED"))
            reviewStatus = "approved";
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
  ): Promise<ActivityMetrics> {
    const [owner, repo] = repoFull.split("/");
    const windowStart = Date.now() - 7 * 86_400_000;

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

  return { fetchRepo, checkIfMerged, fetchRecentActivity, fetchAvailableRepos };
}
