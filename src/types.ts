// src/types.ts — shared domain types

export type ReviewStatus = "open" | "approved" | "draft" | "changes" | "merged";
export type SlaStatus = "ok" | "warning" | "breach";
export type Theme = "light" | "dark" | "system";

export interface GithubUser {
  login: string;
  avatar_url: string;
}

export interface GithubLabel {
  name: string;
  color: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  url: string;
  draft: boolean;
  createdAt: Date;
  author: GithubUser;
  assignees: GithubUser[];
  requestedReviewers: GithubUser[];
  labels: GithubLabel[];
  reviewStatus: ReviewStatus;
  commentCount: number;
  repo: string;
  mergedAt?: Date;
  reviewedAt?: Date;
  _flashClass: string;
  _slaRowCss: string;
}

export interface RepoData {
  error?: string;
}

export interface ActivityMetrics {
  created7d: number | null;
  merged7d: number | null;
  avgLeadTimeHours: number | null;
  activityLoading: boolean;
}

export interface FilterState {
  activeFilter: string;
  staleOnly: boolean;
  searchQ: string;
  selectedRepos: string[];
  selectedAuthors: string[];
}

export interface FilterGroup {
  repo: string;
  prs: PullRequest[];
  error: string | null;
}

export interface Toast {
  id: number;
  type: "new" | "merged";
  icon: string;
  title: string;
  sub: string;
  out: boolean;
}

export interface FilteredGroup {
  repo: string;
  prs: PullRequest[];
  error: string | null;
}
