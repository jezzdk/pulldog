// composables/useGithub.ts
import type { ComputedRef } from 'vue'
import { slaStatus } from '@/composables/useSla'
import type { PullRequest, ReviewStatus, CheckStatus } from '@/types'

interface GithubErrorBody {
  message?: string
}

interface GithubReview {
  state: string
  user:  { login: string }
}

interface GithubCheckRuns {
  check_runs: Array<{ conclusion: string | null; status: string }>
}

interface GithubRawPR {
  id:                number
  number:            number
  title:             string
  html_url:          string
  draft:             boolean
  created_at:        string
  merged_at:         string | null
  user:              { login: string; avatar_url: string }
  assignees:         Array<{ login: string; avatar_url: string }>
  requested_reviewers: Array<{ login: string; avatar_url: string }>
  labels:            Array<{ name: string; color: string }>
  comments:          number
  review_comments:   number
  head:              { sha: string }
}

export interface ActivityMetrics {
  created7d:        number
  merged7d:         number
  avgLeadTimeHours: number | null
}

export function useGithub(token: ComputedRef<string>) {
  async function gh<T>(path: string): Promise<T> {
    const r = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `token ${token.value}`,
        Accept: 'application/vnd.github+json',
      },
    })
    if (!r.ok) {
      const b = await r.json().catch((): GithubErrorBody => ({})) as GithubErrorBody
      throw new Error(`GitHub ${r.status}: ${b.message ?? 'error'}`)
    }
    return r.json() as Promise<T>
  }

  async function fetchRepo(repoFull: string): Promise<PullRequest[]> {
    const [owner, repo] = repoFull.split('/')
    const prs = await gh<GithubRawPR[]>(
      `/repos/${owner}/${repo}/pulls?state=open&per_page=50`,
    )

    return Promise.all(
      prs.map(async (pr): Promise<PullRequest> => {
        let reviewStatus: ReviewStatus = 'open'
        let checks: CheckStatus = null

        try {
          const [reviews, checkRuns] = await Promise.all([
            gh<GithubReview[]>(`/repos/${owner}/${repo}/pulls/${pr.number}/reviews`),
            gh<GithubCheckRuns>(`/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`),
          ])

          if (pr.draft) {
            reviewStatus = 'draft'
          } else {
            const latest: Record<string, string> = {}
            for (const rv of reviews) {
              if (rv.state !== 'COMMENTED') latest[rv.user.login] = rv.state
            }
            const states = Object.values(latest)
            if (states.includes('CHANGES_REQUESTED'))          reviewStatus = 'changes'
            else if (states.length && states.every(s => s === 'APPROVED')) reviewStatus = 'approved'
          }

          const runs = (checkRuns.check_runs ?? []).map(r => r.conclusion ?? r.status)
          if (runs.some(s => ['failure', 'cancelled', 'timed_out'].includes(s))) {
            checks = 'fail'
            if (!pr.draft) reviewStatus = 'failing'
          } else if (runs.some(s => ['in_progress', 'queued', 'pending'].includes(s))) {
            checks = 'pending'
          } else if (runs.length) {
            checks = 'pass'
          }
        } catch (_) { /* enrichment failed — show PR with basic info */ }

        return {
          id:                 pr.id,
          number:             pr.number,
          title:              pr.title,
          url:                pr.html_url,
          draft:              pr.draft,
          createdAt:          new Date(pr.created_at),
          author:             pr.user,
          assignees:          pr.assignees ?? [],
          requestedReviewers: pr.requested_reviewers ?? [],
          labels:             pr.labels ?? [],
          reviewStatus,
          checks,
          commentCount:       (pr.comments ?? 0) + (pr.review_comments ?? 0),
          repo:               repoFull,
          _flashClass:        '',
          _slaRowCss:         '',
        }
      }),
    )
  }

  async function checkIfMerged(repoFull: string, prNumber: number): Promise<boolean> {
    const [owner, repo] = repoFull.split('/')
    try {
      const pr = await gh<GithubRawPR>(`/repos/${owner}/${repo}/pulls/${prNumber}`)
      return pr.merged_at !== null
    } catch (_) {
      return false
    }
  }

  async function fetchRecentActivity(repoFull: string): Promise<ActivityMetrics> {
    const [owner, repo] = repoFull.split('/')
    const windowStart = Date.now() - 7 * 86_400_000

    const [closedRaw, openRaw] = await Promise.all([
      gh<GithubRawPR[]>(
        `/repos/${owner}/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
      ),
      gh<GithubRawPR[]>(`/repos/${owner}/${repo}/pulls?state=open&per_page=100`),
    ])

    const byId: Record<number, GithubRawPR> = {}
    for (const pr of [...closedRaw, ...openRaw]) byId[pr.id] = pr
    const all = Object.values(byId)

    const created7d = all.filter(pr => new Date(pr.created_at).getTime() >= windowStart)
    const merged7d  = all.filter(
      pr => pr.merged_at !== null && new Date(pr.merged_at).getTime() >= windowStart,
    )

    let avgLeadTimeHours: number | null = null
    if (merged7d.length > 0) {
      const totalMs = merged7d.reduce((sum, pr) => {
        return sum + (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime())
      }, 0)
      avgLeadTimeHours = totalMs / merged7d.length / 3_600_000
    }

    return {
      created7d:        created7d.length,
      merged7d:         merged7d.length,
      avgLeadTimeHours,
    }
  }

  return { fetchRepo, checkIfMerged, fetchRecentActivity }
}
