<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useGithubOAuth, TOKEN_SOURCE_KEY } from "@/composables/useGithubOAuth";
import { useAudio } from "@/composables/useAudio";
import { useGithub } from "@/composables/useGithub";
import { usePollingTimer } from "@/composables/usePollingTimer";
import { useRateLimitPause } from "@/composables/useRateLimitPause";
import {
  slaStatus,
  slaWarningHours,
  slaBreachHours,
  SLA_WARNING_KEY,
  SLA_BREACH_KEY,
} from "@/composables/useSla";
import type { StatPeriod } from "@/types";
import { useTheme } from "@/composables/useTheme";
import { useConfetti } from "@/composables/useConfetti";
import { usePersistedRepos, REPOS_KEY } from "@/composables/usePersistedRepos";
import { usePersistedToken, TOKEN_KEY } from "@/composables/usePersistedToken";
import type { PullRequest, ReviewStatus, Toast, FilteredGroup } from "@/types";

import SetupScreen from "@/components/SetupScreen.vue";
import Topbar from "@/components/Topbar.vue";
import RateLimitBanner from "@/components/RateLimitBanner.vue";
import RateLimitFooter from "@/components/RateLimitFooter.vue";
import FilterBar from "@/components/FilterBar.vue";
import PrTable from "@/components/PrTable.vue";
import SettingsDialog from "@/components/SettingsDialog.vue";
import RepoDialog from "@/components/RepoDialog.vue";
import SummaryBar from "@/components/SummaryBar.vue";
import SlaLegend from "@/components/SlaLegend.vue";
import DayTimeline from "@/components/DayTimeline.vue";
import Badge from "@/components/ui/Badge.vue";
import Card from "@/components/ui/Card.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Button from "@/components/ui/Button.vue";
import { CheckCircle2, GitPullRequest, RefreshCw } from "lucide-vue-next";

// ── theme (boot before render) ────────────────────────────────────
useTheme();

const { fireConfetti } = useConfetti();

// ── constants ─────────────────────────────────────────────────────
const COMMENT_FIRE_THRESHOLD_KEY = "pulldog-comment-fire-threshold";
const commentFireThreshold = ref(
  Number(
    localStorage.getItem(COMMENT_FIRE_THRESHOLD_KEY) ??
      import.meta.env.VITE_COMMENT_FIRE_THRESHOLD ??
      10,
  ),
);
const TEST_MODE = import.meta.env.VITE_TEST_MODE === "true";
const ENV_POLL_INTERVAL_S = Number(import.meta.env.VITE_POLL_INTERVAL_S ?? 60);
const POLL_INTERVAL_KEY = "pulldog-poll-interval";
const pollIntervalS = ref(
  Number(localStorage.getItem(POLL_INTERVAL_KEY) ?? ENV_POLL_INTERVAL_S),
);

const STAT_PERIOD_MS: Record<StatPeriod, number> = {
  "12h": 12 * 3_600_000,
  "24h": 24 * 3_600_000,
  "7d": 7 * 86_400_000,
  "14d": 14 * 86_400_000,
  "30d": 30 * 86_400_000,
};

// ── persisted repos + token ───────────────────────────────────────
const { repoList, saveList } = usePersistedRepos();
const { token, hasEnvToken, save: saveToken } = usePersistedToken();

const TITLE_FILTER_KEY = "pulldog-title-filter";
const titleFilterRegex = ref(localStorage.getItem(TITLE_FILTER_KEY) ?? "");

const TIMELINE_OPEN_KEY = "pulldog-timeline-open";
const timelineOpen = ref(localStorage.getItem(TIMELINE_OPEN_KEY) === "true");
function toggleTimeline(): void {
  timelineOpen.value = !timelineOpen.value;
  localStorage.setItem(TIMELINE_OPEN_KEY, String(timelineOpen.value));
}

const HIDE_DRAFTS_IN_ALL_KEY = "pulldog-hide-drafts-in-all";
const HIDE_MERGED_IN_ALL_KEY = "pulldog-hide-merged-in-all";
const CONFETTI_ENABLED_KEY = "pulldog-confetti-enabled";
const hideDraftsInAll = ref(
  localStorage.getItem(HIDE_DRAFTS_IN_ALL_KEY) === "true",
);
const hideMergedInAll = ref(
  localStorage.getItem(HIDE_MERGED_IN_ALL_KEY) === "true",
);
const confettiEnabled = ref(
  localStorage.getItem(CONFETTI_ENABLED_KEY) === "true",
);
const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID ?? "";
const oauth = useGithubOAuth();
const isOAuth = computed(
  () => localStorage.getItem(TOKEN_SOURCE_KEY) === "oauth",
);

// ── session state ─────────────────────────────────────────────────
const connected = ref(false);
const loading = ref(false);
const setupError = ref("");
const showSettings = ref(false);
const showRepos = ref(false);
const showLogoutConfirm = ref(false);
const lastUpdated = ref("");

// ── data ──────────────────────────────────────────────────────────
type RepoEntry = PullRequest[] | { error: string };
const prData = ref<Record<string, RepoEntry>>({});
// Tracks the last-seen reviewStatus per PR id, per repo — used to detect
// open→merged transitions without a secondary API call.
const knownStatuses = ref<Record<string, Record<number, ReviewStatus>>>({});

// ── stat period ───────────────────────────────────────────────────
const statPeriod = ref<StatPeriod>("7d");
// Last completed PR fetch window (matches fetchRepo cutoff). Used so that
// when the user widens the period, merges that were outside the previous
// window are not treated as fresh open→merged transitions.
const lastFetchedStatPeriodMs = ref<number | null>(null);

// ── filters ───────────────────────────────────────────────────────
const activeFilter = ref("all");
const searchQ = ref("");
const selectedRepos = ref<string[]>([]);
const selectedAuthors = ref<string[]>([]);

// ── activity metrics (stored per-repo so filters can reaggregate) ─
type RepoActivity = {
  createdInPeriod: number;
  mergedInPeriod: number;
  avgLeadTimeHours: number | null;
  avgTimeToReviewHours: number | null;
  avgTimeToMergeHours: number | null;
  reviewedCount: number;
  mergedWithApprovalCount: number;
};
const activityByRepo = ref<Record<string, RepoActivity>>({});
const activityLoading = ref(true);

// ── toasts ────────────────────────────────────────────────────────
const toasts = ref<Toast[]>([]);
let toastId = 0;

function addToast(
  type: Toast["type"],
  icon: string,
  title: string,
  sub: string,
): void {
  const id = ++toastId;
  toasts.value.push({ id, type, icon, title, sub, out: false });
  setTimeout(() => {
    const t = toasts.value.find((x) => x.id === id);

    if (t) {
      t.out = true;
    }

    setTimeout(() => {
      toasts.value = toasts.value.filter((x) => x.id !== id);
    }, 300);
  }, 30_000);
}

// ── audio / github ────────────────────────────────────────────────
const {
  soundEnabled,
  ttsEnabled,
  prTtsEnabled,
  prSoundEnabled,
  mergeSoundEnabled,
  customSoundEnabled,
  customPrSoundEnabled,
  toggle: toggleSound,
  playNewPR,
  playMerged,
  playDefaultNewPR,
  playDefaultMerged,
} = useAudio();

const testAuthors = [
  "alice",
  "bob",
  "charlie",
  "diana",
  "eve",
  "frank",
  "grace",
  "henry",
];

function playNewPRTest(): void {
  const author = testAuthors[Math.floor(Math.random() * testAuthors.length)]!;
  void playNewPR(author);
}

function playMergedTest(): void {
  const author = testAuthors[Math.floor(Math.random() * testAuthors.length)]!;
  void playMerged(author);

  if (confettiEnabled.value) {
    fireConfetti();
  }
}

function playMergedTestWithAuthor(author: string): void {
  void playMerged(author);

  if (confettiEnabled.value) {
    fireConfetti();
  }
}

const tokenComputed = computed(() => token.value);
const compiledTitleFilter = computed<RegExp | null>(() => {
  if (!titleFilterRegex.value) {
    return null;
  }

  try {
    return new RegExp(titleFilterRegex.value, "i");
  } catch {
    return null;
  }
});
const {
  fetchRepo,
  fetchRecentActivity,
  fetchReviewStats,
  fetchAvailableRepos,
  rateLimit,
} = useGithub(tokenComputed, compiledTitleFilter);
const rateLimitPause = useRateLimitPause(rateLimit);
const summaryLoading = computed(
  () => activityLoading.value && !rateLimitPause.isPaused.value,
);

// ── computed stats ────────────────────────────────────────────────
const allPRs = computed<PullRequest[]>(() =>
  Object.values(prData.value)
    .filter((v): v is PullRequest[] => Array.isArray(v))
    .flat(),
);

const repoOptions = computed<string[]>(() =>
  repoList.value.filter((r) => Array.isArray(prData.value[r])),
);

const authorOptions = computed<string[]>(() => {
  const logins = new Set(allPRs.value.map((p) => p.author.login));
  return [...logins].sort((a, b) => a.localeCompare(b));
});

const authorAvatars = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};

  for (const p of allPRs.value) {
    map[p.author.login] = p.author.avatar_url;
  }

  return map;
});

// PRs filtered by repo + author only — used for stats so they aren't
// affected by the status/stale/search filters applied to the table.
const baseFilteredPRs = computed<PullRequest[]>(() =>
  repoList.value
    .filter(
      (repo) =>
        selectedRepos.value.length === 0 || selectedRepos.value.includes(repo),
    )
    .flatMap((repo) => {
      const entry = prData.value[repo];

      if (!Array.isArray(entry)) {
        return [];
      }

      const prs = entry as PullRequest[];
      return selectedAuthors.value.length > 0
        ? prs.filter((p) => selectedAuthors.value.includes(p.author.login))
        : prs;
    }),
);

const totalOpen = computed(
  () =>
    baseFilteredPRs.value.filter((p) => !p.draft && p.reviewStatus !== "merged")
      .length,
);

const authorPrCounts = computed(() => {
  const counts: Record<
    string,
    { login: string; avatarUrl: string; count: number }
  > = {};

  for (const pr of baseFilteredPRs.value) {
    if (pr.reviewStatus === "merged") {
      const { login, avatar_url } = pr.author;

      if (!counts[login]) {
        counts[login] = { login, avatarUrl: avatar_url, count: 0 };
      }

      counts[login].count++;
    }
  }

  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
});

const assigneePrCounts = computed(() => {
  const counts: Record<
    string,
    { login: string; avatarUrl: string; count: number }
  > = {};

  for (const pr of baseFilteredPRs.value) {
    if (!pr.draft && pr.reviewStatus !== "merged") {
      for (const { login, avatar_url } of pr.assignees) {
        if (!counts[login]) {
          counts[login] = { login, avatarUrl: avatar_url, count: 0 };
        }

        counts[login].count++;
      }
    }
  }

  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
});

const statOpen = computed(
  () => baseFilteredPRs.value.filter((p) => p.reviewStatus === "open").length,
);
const statApproved = computed(
  () => baseFilteredPRs.value.filter((p) => p.reviewStatus === "approved").length,
);
const statWarn = computed(
  () =>
    baseFilteredPRs.value.filter((p) => !p.draft && slaStatus(p.createdAt) === "warning")
      .length,
);
const statBreach = computed(
  () =>
    baseFilteredPRs.value.filter((p) => !p.draft && slaStatus(p.createdAt) === "breach")
      .length,
);

const filteredActivity = computed(() => {
  const loaded = Object.keys(activityByRepo.value);

  if (loaded.length === 0) {
    return {
      createdInPeriod: null as number | null,
      mergedInPeriod: null as number | null,
      avgLeadTimeHours: null as number | null,
      avgTimeToReviewHours: null as number | null,
      avgTimeToMergeHours: null as number | null,
    };
  }

  const activeRepos =
    selectedRepos.value.length > 0
      ? selectedRepos.value.filter((r) => activityByRepo.value[r])
      : loaded;

  let totalCreated = 0,
    totalMerged = 0;
  let totalLeadMs = 0,
    mergedWithTime = 0;
  let totalReviewMs = 0,
    reviewedCount = 0;
  let totalMergeMs = 0,
    mergedWithApproval = 0;

  for (const repo of activeRepos) {
    const a = activityByRepo.value[repo];

    if (!a) {
      continue;
    }

    totalCreated += a.createdInPeriod;
    totalMerged += a.mergedInPeriod;

    if (a.avgLeadTimeHours !== null) {
      totalLeadMs += a.avgLeadTimeHours * 3_600_000 * a.mergedInPeriod;
      mergedWithTime += a.mergedInPeriod;
    }

    if (a.avgTimeToReviewHours !== null) {
      totalReviewMs += a.avgTimeToReviewHours * 3_600_000 * a.reviewedCount;
      reviewedCount += a.reviewedCount;
    }

    if (a.avgTimeToMergeHours !== null) {
      totalMergeMs +=
        a.avgTimeToMergeHours * 3_600_000 * a.mergedWithApprovalCount;
      mergedWithApproval += a.mergedWithApprovalCount;
    }
  }

  return {
    createdInPeriod: totalCreated,
    mergedInPeriod: totalMerged,
    avgLeadTimeHours:
      mergedWithTime > 0 ? totalLeadMs / mergedWithTime / 3_600_000 : null,
    avgTimeToReviewHours:
      reviewedCount > 0 ? totalReviewMs / reviewedCount / 3_600_000 : null,
    avgTimeToMergeHours:
      mergedWithApproval > 0
        ? totalMergeMs / mergedWithApproval / 3_600_000
        : null,
  };
});

const filteredGroups = computed<FilteredGroup[]>(() =>
  repoList.value
    .filter(
      (repo) =>
        selectedRepos.value.length === 0 || selectedRepos.value.includes(repo),
    )
    .map((repo) => {
      const entry = prData.value[repo];

      if (!entry) {
        return { repo, prs: [], error: null };
      }

      if (!Array.isArray(entry)) {
        return { repo, prs: [], error: entry.error };
      }

      let prs: PullRequest[] = [...entry];

      if (activeFilter.value === "sla-warn") {
        prs = prs.filter(
          (p) =>
            p.reviewStatus === "open" && slaStatus(p.createdAt) === "warning",
        );
      } else if (activeFilter.value === "sla-breach") {
        prs = prs.filter(
          (p) =>
            p.reviewStatus === "open" && slaStatus(p.createdAt) === "breach",
        );
      } else if (activeFilter.value === "draft") {
        prs = prs.filter((p) => p.reviewStatus === "draft");
      } else if (activeFilter.value === "merged") {
        prs = prs.filter((p) => p.reviewStatus === "merged");
      } else if (activeFilter.value !== "all") {
        prs = prs.filter(
          (p) =>
            p.reviewStatus === activeFilter.value && p.reviewStatus !== "draft",
        );
      } else {
        prs = prs.filter(
          (p) =>
            (!hideDraftsInAll.value || p.reviewStatus !== "draft") &&
            (!hideMergedInAll.value || p.reviewStatus !== "merged"),
        );
      }

      if (selectedAuthors.value.length > 0) {
        prs = prs.filter((p) => selectedAuthors.value.includes(p.author.login));
      }

      if (searchQ.value) {
        const q = searchQ.value.toLowerCase();
        prs = prs.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.author.login.toLowerCase().includes(q) ||
            String(p.number).includes(q),
        );
      }

      return { repo, prs, error: null };
    }),
);

const allFilteredPrs = computed<PullRequest[]>(() =>
  filteredGroups.value.flatMap((g) => g.prs),
);

const anyVisible = computed(() =>
  filteredGroups.value.some((g) => g.prs.length > 0 || g.error !== null),
);

/** True after the first completed fetch; widening the stat period grows the merged-PR slice. */
function isMergedPrSliceWiderThanLastFetch(
  currentFetchPeriodMs: number,
  lastCompletedFetchPeriodMs: number | null,
): boolean {
  return (
    lastCompletedFetchPeriodMs !== null &&
    currentFetchPeriodMs > lastCompletedFetchPeriodMs
  );
}

/**
 * When the stat period widens, older merges appear in the payload for the first time.
 * Those are not live open→merged events relative to the last fetch.
 */
function isStaleMergeOnlySeenBecausePeriodWidened(
  pr: PullRequest,
  mergedPrSliceWiderThanBefore: boolean,
  priorFetchPeriodMs: number | null,
  evaluatedAtMs: number,
): boolean {
  return (
    mergedPrSliceWiderThanBefore &&
    priorFetchPeriodMs !== null &&
    pr.mergedAt !== undefined &&
    pr.mergedAt.getTime() < evaluatedAtMs - priorFetchPeriodMs
  );
}

function isNewlyTrackedNonDraftOpenPullRequest(
  prevStatus: ReviewStatus | undefined,
  pr: PullRequest,
): boolean {
  return (
    (prevStatus === undefined &&
      pr.reviewStatus !== "merged" &&
      !pr.draft) ||
    (prevStatus === "draft" && pr.reviewStatus !== "draft")
  );
}

function shouldAlertMergedPullRequestThisFetch(
  prevStatus: ReviewStatus | undefined,
  pr: PullRequest,
  mergedPrSliceWiderThanBefore: boolean,
  priorFetchPeriodMs: number | null,
  evaluatedAtMs: number,
): boolean {
  if (prevStatus === "merged" || pr.reviewStatus !== "merged") {
    return false;
  }

  return !isStaleMergeOnlySeenBecausePeriodWidened(
    pr,
    mergedPrSliceWiderThanBefore,
    priorFetchPeriodMs,
    evaluatedAtMs,
  );
}

// ── data loading ──────────────────────────────────────────────────
async function loadAll(isRefresh = false): Promise<void> {
  if (rateLimitPause.sync() > 0) {
    return;
  }

  loading.value = true;
  const periodMs = STAT_PERIOD_MS[statPeriod.value];
  const priorFetchPeriodMs = lastFetchedStatPeriodMs.value;
  const mergedPrSliceWiderThanBefore = isMergedPrSliceWiderThanLastFetch(
    periodMs,
    priorFetchPeriodMs,
  );
  const results = await Promise.allSettled(
    repoList.value.map((repo) => fetchRepo(repo, periodMs)),
  );
  const notificationEvalTimeMs = Date.now();
  let anyOk = false;
  let shouldPlayDing = false;
  let shouldPlayGong = false;
  let newPrAuthorName = "";
  let mergedAuthorName = "";

  for (let i = 0; i < results.length; i++) {
    const repo = repoList.value[i]!;
    const r = results[i]!;

    if (r.status === "fulfilled") {
      const fresh = r.value;
      anyOk = true;

      if (isRefresh && knownStatuses.value[repo]) {
        const prev = knownStatuses.value[repo]!;

        for (const p of fresh) {
          const prevStatus = prev[p.id];

          if (isNewlyTrackedNonDraftOpenPullRequest(prevStatus, p)) {
            if (!shouldPlayDing) {
              newPrAuthorName = p.author.login;
            }

            shouldPlayDing = true;
            addToast(
              "new",
              "🔔",
              `New pull request · ${p.author.login}`,
              `${repo} #${p.number}: ${p.title}`,
            );
            await nextTick();
            p._flashClass = "flash-new";
            setTimeout(() => {
              p._flashClass = "";
            }, 900);
          } else if (
            shouldAlertMergedPullRequestThisFetch(
              prevStatus,
              p,
              mergedPrSliceWiderThanBefore,
              priorFetchPeriodMs,
              notificationEvalTimeMs,
            )
          ) {
            if (!shouldPlayGong) {
              mergedAuthorName = p.author.login;
            }

            shouldPlayGong = true;
            addToast(
              "merged",
              "🎉",
              `PR merged · ${p.author.login}`,
              `${repo} #${p.number}: ${p.title}`,
            );
          }
        }
      }

      knownStatuses.value[repo] = Object.fromEntries(
        fresh.map((p) => [p.id, p.reviewStatus]),
      );
      prData.value[repo] = fresh;
    } else {
      const msg =
        r.reason instanceof Error ? r.reason.message : "Failed to load";
      prData.value[repo] = { error: msg };
    }
  }

  if (shouldPlayGong) {
    void playMerged(mergedAuthorName);

    if (confettiEnabled.value) {
      fireConfetti();
    }
  } else if (shouldPlayDing) {
    void playNewPR(newPrAuthorName);
  }

  if (!isRefresh && !anyOk) {
    const first = results[0];
    const msg =
      first?.status === "rejected" && first.reason instanceof Error
        ? first.reason.message
        : "Failed to connect";
    throw new Error(msg);
  }

  lastFetchedStatPeriodMs.value = periodMs;
  loading.value = false;
  lastUpdated.value = new Date().toLocaleTimeString();
}

async function loadActivity(): Promise<void> {
  if (rateLimitPause.sync() > 0) {
    activityLoading.value = false;
    return;
  }

  activityLoading.value = true;
  activityByRepo.value = {};
  const periodMs = STAT_PERIOD_MS[statPeriod.value];
  const results = await Promise.allSettled(
    repoList.value.map(async (repo) => {
      const [activityRes, reviewStatsRes] = await Promise.allSettled([
        fetchRecentActivity(repo, periodMs),
        fetchReviewStats(repo, periodMs),
      ]);
      return {
        repo,
        activity: activityRes.status === "fulfilled" ? activityRes.value : null,
        reviewStats:
          reviewStatsRes.status === "fulfilled" ? reviewStatsRes.value : null,
      };
    }),
  );
  const updated = { ...activityByRepo.value };

  for (const r of results) {
    if (r.status === "fulfilled" && r.value.activity !== null) {
      updated[r.value.repo] = {
        ...r.value.activity,
        avgTimeToReviewHours: r.value.reviewStats?.avgTimeToReviewHours ?? null,
        avgTimeToMergeHours: r.value.reviewStats?.avgTimeToMergeHours ?? null,
        reviewedCount: r.value.reviewStats?.reviewedCount ?? 0,
        mergedWithApprovalCount:
          r.value.reviewStats?.mergedWithApprovalCount ?? 0,
      };
    }
  }

  activityByRepo.value = updated;
  activityLoading.value = false;
}

watch(statPeriod, () => {
  if (connected.value) {
    void refreshData(true);
  }
});

async function refreshData(isRefresh = true): Promise<void> {
  await loadAll(isRefresh);

  if (rateLimitPause.sync() === 0) {
    void loadActivity();
  }
}

const polling = usePollingTimer(
  pollIntervalS,
  () => {
    if (connected.value && !loading.value) {
      void refreshData(true);
    }
  },
  rateLimitPause.sync,
);

async function resetToken(): Promise<void> {
  await oauth.revokeToken(token.value);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REPOS_KEY);
  localStorage.removeItem(TOKEN_SOURCE_KEY);
  window.location.reload();
}

async function connect(newRepos: string[], newToken?: string): Promise<void> {
  setupError.value = "";

  if (newToken !== undefined) {
    token.value = newToken;
    saveToken(newToken);
  }

  if (!token.value.trim()) {
    setupError.value = "Please enter a GitHub token.";
    return;
  }

  if (!newRepos.length) {
    setupError.value = "Please select at least one repository.";
    return;
  }

  saveList(newRepos);
  loading.value = true;

  try {
    await loadAll(false);

    if (rateLimitPause.sync() === 0) {
      void loadActivity();
    }

    connected.value = true;
    polling.start();
  } catch (e) {
    setupError.value = e instanceof Error ? e.message : "Unknown error";
  }

  loading.value = false;
}

async function refreshAll(): Promise<void> {
  if (!loading.value) {
    polling.start();

    if (rateLimitPause.sync() > 0) {
      return;
    }

    await loadAll(true);

    if (rateLimitPause.sync() === 0) {
      void loadActivity();
    }
  }
}

function handleSaveSettings(
  newToken?: string,
  newTitleFilter?: string,
  newPollInterval?: number,
  newSlaWarningHours?: number,
  newSlaBreachHours?: number,
  newCommentFireThreshold?: number,
  newHideDraftsInAll?: boolean,
  newHideMergedInAll?: boolean,
  newConfettiEnabled?: boolean,
  newTtsEnabled?: boolean,
  newPrTtsEnabled?: boolean,
  newPrSoundEnabled?: boolean,
  newMergeSoundEnabled?: boolean,
  newCustomSoundEnabled?: boolean,
  newCustomPrSoundEnabled?: boolean,
): void {
  showSettings.value = false;

  if (newToken !== undefined) {
    token.value = newToken;
    saveToken(newToken);
  }

  if (newTitleFilter !== undefined) {
    titleFilterRegex.value = newTitleFilter;

    if (newTitleFilter) {
      localStorage.setItem(TITLE_FILTER_KEY, newTitleFilter);
    } else {
      localStorage.removeItem(TITLE_FILTER_KEY);
    }
  }

  if (
    newPollInterval !== undefined &&
    newPollInterval !== pollIntervalS.value
  ) {
    pollIntervalS.value = newPollInterval;
    localStorage.setItem(POLL_INTERVAL_KEY, String(newPollInterval));
    polling.start();
  }

  if (newSlaWarningHours !== undefined) {
    slaWarningHours.value = newSlaWarningHours;
    localStorage.setItem(SLA_WARNING_KEY, String(newSlaWarningHours));
  }

  if (newSlaBreachHours !== undefined) {
    slaBreachHours.value = newSlaBreachHours;
    localStorage.setItem(SLA_BREACH_KEY, String(newSlaBreachHours));
  }

  if (newCommentFireThreshold !== undefined) {
    commentFireThreshold.value = newCommentFireThreshold;
    localStorage.setItem(
      COMMENT_FIRE_THRESHOLD_KEY,
      String(newCommentFireThreshold),
    );
  }

  if (newHideDraftsInAll !== undefined) {
    hideDraftsInAll.value = newHideDraftsInAll;
    localStorage.setItem(HIDE_DRAFTS_IN_ALL_KEY, String(newHideDraftsInAll));
  }

  if (newHideMergedInAll !== undefined) {
    hideMergedInAll.value = newHideMergedInAll;
    localStorage.setItem(HIDE_MERGED_IN_ALL_KEY, String(newHideMergedInAll));
  }

  if (newConfettiEnabled !== undefined) {
    confettiEnabled.value = newConfettiEnabled;
    localStorage.setItem(CONFETTI_ENABLED_KEY, String(newConfettiEnabled));
  }

  if (newTtsEnabled !== undefined) {
    ttsEnabled.value = newTtsEnabled;
    localStorage.setItem("pulldog-tts-enabled", String(newTtsEnabled));
  }

  if (newPrTtsEnabled !== undefined) {
    prTtsEnabled.value = newPrTtsEnabled;
    localStorage.setItem("pulldog-pr-tts-enabled", String(newPrTtsEnabled));
  }

  if (newPrSoundEnabled !== undefined) {
    prSoundEnabled.value = newPrSoundEnabled;
    localStorage.setItem("pulldog-pr-sound-enabled", String(newPrSoundEnabled));
  }

  if (newMergeSoundEnabled !== undefined) {
    mergeSoundEnabled.value = newMergeSoundEnabled;
    localStorage.setItem(
      "pulldog-merge-sound-enabled",
      String(newMergeSoundEnabled),
    );
  }

  if (newCustomSoundEnabled !== undefined) {
    customSoundEnabled.value = newCustomSoundEnabled;
    localStorage.setItem(
      "pulldog-custom-sound-enabled",
      String(newCustomSoundEnabled),
    );
  }

  if (newCustomPrSoundEnabled !== undefined) {
    customPrSoundEnabled.value = newCustomPrSoundEnabled;
    localStorage.setItem(
      "pulldog-custom-pr-sound-enabled",
      String(newCustomPrSoundEnabled),
    );
  }
}

async function handleSaveRepos(newRepos: string[]): Promise<void> {
  showRepos.value = false;
  saveList(newRepos);
  prData.value = {};
  knownStatuses.value = {};
  lastFetchedStatPeriodMs.value = null;
  selectedRepos.value = [];
  selectedAuthors.value = [];
  activityByRepo.value = {};
  activityLoading.value = true;
  await loadAll(false);

  if (rateLimitPause.sync() === 0) {
    void loadActivity();
  }

  polling.start();
}

watch(
  rateLimit,
  () => {
    if (connected.value && rateLimitPause.sync() > 0) {
      polling.start();
    }
  },
  { deep: true },
);

function handleLogout(): void {
  polling.stop();

  localStorage.removeItem(REPOS_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_SOURCE_KEY);
  token.value = "";
  repoList.value.splice(0);
  prData.value = {};
  knownStatuses.value = {};
  lastFetchedStatPeriodMs.value = null;
  activityByRepo.value = {};
  activityLoading.value = true;
  selectedRepos.value = [];
  selectedAuthors.value = [];
  activeFilter.value = "all";
  searchQ.value = "";
  rateLimitPause.clear();
  showLogoutConfirm.value = false;
  connected.value = false;
}

onMounted(async () => {
  const callbackToken = await oauth.handleCallback();

  if (callbackToken) {
    token.value = callbackToken;
    saveToken(callbackToken);
  }

  if (token.value && repoList.value.length) {
    void connect(repoList.value);
  }
});
</script>

<template>
  <!-- ── Setup ───────────────────────────────────────────────── -->
  <SetupScreen
    v-if="!connected"
    :has-env-token="hasEnvToken"
    :initial-token="token"
    :initial-selected="repoList"
    :fetch-repos="fetchAvailableRepos"
    :loading="loading"
    :error="setupError"
    :client-id="githubClientId"
    :oauth-state="oauth.state.value"
    @connect-with-github="oauth.startRedirect(githubClientId)"
    @reset-token="resetToken"
    @connect="connect"
  />

  <!-- ── Dashboard ───────────────────────────────────────────── -->
  <template v-else>
    <Topbar
      :stat-open="statOpen"
      :stat-approved="statApproved"
      :stat-warn="statWarn"
      :stat-breach="statBreach"
      :sound-enabled="soundEnabled"
      :confetti-enabled="confettiEnabled"
      :loading="loading"
      :last-updated="lastUpdated"
      :poll-countdown="polling.countdown.value"
      :rate-limit-paused="rateLimitPause.isPaused.value"
      :test-mode="TEST_MODE"
      :has-env-token="hasEnvToken"
      :on-test-new-pr="playNewPRTest"
      :on-test-merged="playMergedTest"
      :on-test-merged-with-author="playMergedTestWithAuthor"
      @refresh="refreshAll"
      @toggle-sound="toggleSound"
      @open-repos="showRepos = true"
      @open-settings="showSettings = true"
      @logout="showLogoutConfirm = true"
    />

    <RateLimitBanner
      :paused="rateLimitPause.isPaused.value"
      :rate-limit="rateLimit"
    />

    <FilterBar
      v-model:active-filter="activeFilter"
      v-model:search-q="searchQ"
      v-model:selected-repos="selectedRepos"
      v-model:selected-authors="selectedAuthors"
      :repo-options="repoOptions"
      :author-options="authorOptions"
      :author-avatars="authorAvatars"
      :timeline-open="timelineOpen"
      @toggle-timeline="toggleTimeline"
    />

    <SummaryBar
      :total-open="totalOpen"
      :created-in-period="filteredActivity.createdInPeriod"
      :merged-in-period="filteredActivity.mergedInPeriod"
      :avg-lead-time-hours="filteredActivity.avgLeadTimeHours"
      :avg-time-to-review-hours="filteredActivity.avgTimeToReviewHours"
      :avg-time-to-merge-hours="filteredActivity.avgTimeToMergeHours"
      :author-pr-counts="authorPrCounts"
      :assignee-pr-counts="assigneePrCounts"
      :loading="summaryLoading"
      v-model:period="statPeriod"
      @test-opened-sound="playDefaultNewPR"
      @test-merged-sound="playDefaultMerged"
    />

    <!-- PR groups -->
    <main class="p-5 flex flex-col gap-6">
      <div
        v-if="loading && allPRs.length === 0"
        class="flex items-center justify-center gap-2 py-16 font-mono text-xs text-muted-foreground"
      >
        <RefreshCw class="h-3.5 w-3.5 animate-spin" />
        Loading pull requests…
      </div>

      <template v-else>
        <!-- Repo summary chips + SLA legend -->
        <div class="flex flex-wrap items-center justify-between gap-y-1.5">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div
              v-for="group in filteredGroups"
              :key="group.repo"
              class="flex items-center gap-1.5"
            >
              <GitPullRequest class="h-3 w-3 text-muted-foreground shrink-0" />
              <a
                :href="'https://github.com/' + group.repo"
                target="_blank"
                class="font-mono text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                {{ group.repo }}
              </a>
              <Badge variant="secondary" class="text-[10px] px-1.5 py-0">
                {{ group.prs.length }}
              </Badge>
              <span
                v-if="group.error"
                class="font-mono text-[11px] text-destructive"
              >
                ⚠ {{ group.error }}
              </span>
            </div>
          </div>
          <SlaLegend />
        </div>

        <!-- Day timeline -->
        <DayTimeline
          v-if="timelineOpen"
          :prs="allPRs"
          @play-opened-sound="playNewPR"
          @play-merged-sound="playMerged"
        />

        <!-- Unified PR table -->
        <PrTable
          v-if="allFilteredPrs.length"
          :prs="allFilteredPrs"
          :comment-fire-threshold="commentFireThreshold"
          :show-repo="true"
        />

        <div
          v-if="!anyVisible"
          class="flex flex-col items-center justify-center gap-2 py-20"
        >
          <CheckCircle2 class="h-8 w-8 text-muted-foreground/30" />
          <p class="text-sm font-medium text-muted-foreground">
            No matching pull requests
          </p>
          <p class="font-mono text-[11px] text-muted-foreground/50">
            Adjust filters or wait for new activity
          </p>
        </div>
      </template>
    </main>

    <footer
      class="flex items-center justify-between gap-4 border-t border-border px-5 py-3 font-mono text-[10px] text-muted-foreground"
    >
      <RateLimitFooter :rate-limit="rateLimit" />
      <span class="text-right">
        Pulldog · The faithful watchdog for your pull requests
      </span>
    </footer>

    <!-- Toasts -->
    <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
      <Transition
        v-for="t in toasts"
        :key="t.id"
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-3 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0 translate-y-1"
      >
        <Card
          v-if="!t.out"
          class="flex items-center gap-3 px-4 py-3 w-full max-w-sm shadow-xl"
          :class="
            t.type === 'merged' ? 'border-purple-500/30' : 'border-primary/30'
          "
        >
          <span class="text-base shrink-0">{{ t.icon }}</span>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-foreground text-xs">
              {{ t.title }}
            </div>
            <div class="font-mono text-[10.5px] text-muted-foreground">
              {{ t.sub }}
            </div>
          </div>
        </Card>
      </Transition>
    </div>

    <!-- Logout confirmation -->
    <Dialog :open="showLogoutConfirm" @close="showLogoutConfirm = false">
      <div class="space-y-4">
        <h2 class="font-mono text-sm font-semibold text-foreground">
          Disconnect?
        </h2>
        <p class="text-sm text-muted-foreground">
          This will clear your saved token and repositories and return you to
          the setup screen.
        </p>
        <div class="flex gap-2 pt-1">
          <Button
            variant="outline"
            class="flex-1"
            @click="showLogoutConfirm = false"
            >Cancel</Button
          >
          <Button variant="destructive" class="flex-1" @click="handleLogout"
            >Disconnect</Button
          >
        </div>
      </div>
    </Dialog>

    <!-- Repositories -->
    <RepoDialog
      :open="showRepos"
      :has-env-token="hasEnvToken || isOAuth"
      :current-token="token"
      :current-repos="repoList"
      :fetch-repos="fetchAvailableRepos"
      @close="showRepos = false"
      @save="handleSaveRepos"
    />

    <!-- Settings -->
    <SettingsDialog
      :open="showSettings"
      :has-env-token="hasEnvToken || isOAuth"
      :current-token="token"
      :current-title-filter="titleFilterRegex"
      :current-poll-interval="pollIntervalS"
      :current-sla-warning-hours="slaWarningHours"
      :current-sla-breach-hours="slaBreachHours"
      :current-comment-fire-threshold="commentFireThreshold"
      :current-hide-drafts-in-all="hideDraftsInAll"
      :current-hide-merged-in-all="hideMergedInAll"
      :current-confetti-enabled="confettiEnabled"
      :current-tts-enabled="ttsEnabled"
      :current-pr-tts-enabled="prTtsEnabled"
      :current-pr-sound-enabled="prSoundEnabled"
      :current-merge-sound-enabled="mergeSoundEnabled"
      :current-custom-sound-enabled="customSoundEnabled"
      :current-custom-pr-sound-enabled="customPrSoundEnabled"
      :fetch-repos="fetchAvailableRepos"
      @close="showSettings = false"
      @save="handleSaveSettings"
    />
  </template>
</template>
