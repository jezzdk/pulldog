<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from "vue";
import { useAudio } from "@/composables/useAudio";
import { useGithub } from "@/composables/useGithub";
import { slaStatus } from "@/composables/useSla";
import { useTheme } from "@/composables/useTheme";
import { usePersistedRepos } from "@/composables/usePersistedRepos";
import { usePersistedToken } from "@/composables/usePersistedToken";
import type { PullRequest, Toast, FilteredGroup } from "@/types";

import SetupScreen from "@/components/SetupScreen.vue";
import Topbar from "@/components/Topbar.vue";
import FilterBar from "@/components/FilterBar.vue";
import PrTable from "@/components/PrTable.vue";
import SettingsDialog from "@/components/SettingsDialog.vue";
import SummaryBar from "@/components/SummaryBar.vue";
import Badge from "@/components/ui/Badge.vue";
import Card from "@/components/ui/Card.vue";
import { CheckCircle2, GitPullRequest, RefreshCw } from "lucide-vue-next";

// ── theme (boot before render) ────────────────────────────────────
useTheme();

// ── constants ─────────────────────────────────────────────────────
const COMMENT_FIRE_THRESHOLD = Number(
  import.meta.env.VITE_COMMENT_FIRE_THRESHOLD ?? 10,
);
const TEST_MODE = import.meta.env.VITE_TEST_MODE === "true";

// ── persisted repos + token ───────────────────────────────────────
const { repoList, saveList } = usePersistedRepos();
const { token, hasEnvToken, save: saveToken } = usePersistedToken();

// ── session state ─────────────────────────────────────────────────
const connected = ref(false);
const loading = ref(false);
const setupError = ref("");
const showSettings = ref(false);
const lastUpdated = ref("");

// Auto-connect if we have both a token and saved repos
const canAutoConnect = token.value.length > 0 && repoList.value.length > 0;

// ── data ──────────────────────────────────────────────────────────
type RepoEntry = PullRequest[] | { error: string };
const prData = ref<Record<string, RepoEntry>>({});
const knownIds = ref<Record<string, Set<number>>>({});

// ── filters ───────────────────────────────────────────────────────
const activeFilter = ref("all");
const staleOnly = ref(false);
const searchQ = ref("");
const selectedRepos = ref<string[]>([]);
const selectedAuthors = ref<string[]>([]);

// ── activity metrics (stored per-repo so filters can reaggregate) ─
type RepoActivity = {
  created7d: number;
  merged7d: number;
  avgLeadTimeHours: number | null;
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
    if (t) t.out = true;
    setTimeout(() => {
      toasts.value = toasts.value.filter((x) => x.id !== id);
    }, 300);
  }, 4500);
}

// ── audio / github ────────────────────────────────────────────────
const { soundEnabled, toggle: toggleSound, playNewPR, playMerged } = useAudio();
const tokenComputed = computed(() => token.value);
const { fetchRepo, checkIfMerged, fetchRecentActivity, fetchAvailableRepos } =
  useGithub(tokenComputed);

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
      if (!Array.isArray(entry)) return [];
      const prs = entry as PullRequest[];
      return selectedAuthors.value.length > 0
        ? prs.filter((p) => selectedAuthors.value.includes(p.author.login))
        : prs;
    }),
);

const totalOpen = computed(
  () => baseFilteredPRs.value.filter((p) => !p.draft).length,
);
const statOpen = computed(
  () => allPRs.value.filter((p) => p.reviewStatus === "open").length,
);
const statApproved = computed(
  () => allPRs.value.filter((p) => p.reviewStatus === "approved").length,
);
const statWarn = computed(
  () =>
    allPRs.value.filter((p) => !p.draft && slaStatus(p.createdAt) === "warning")
      .length,
);
const statBreach = computed(
  () =>
    allPRs.value.filter((p) => !p.draft && slaStatus(p.createdAt) === "breach")
      .length,
);

const filteredActivity = computed(() => {
  const loaded = Object.keys(activityByRepo.value);
  if (loaded.length === 0)
    return { created7d: null as number | null, merged7d: null as number | null, avgLeadTimeHours: null as number | null };

  const activeRepos =
    selectedRepos.value.length > 0
      ? selectedRepos.value.filter((r) => activityByRepo.value[r])
      : loaded;

  let totalCreated = 0,
    totalMerged = 0,
    totalLeadMs = 0,
    mergedWithTime = 0;
  for (const repo of activeRepos) {
    const a = activityByRepo.value[repo];
    if (!a) continue;
    totalCreated += a.created7d;
    totalMerged += a.merged7d;
    if (a.avgLeadTimeHours !== null) {
      totalLeadMs += a.avgLeadTimeHours * 3_600_000 * a.merged7d;
      mergedWithTime += a.merged7d;
    }
  }
  return {
    created7d: totalCreated as number | null,
    merged7d: totalMerged as number | null,
    avgLeadTimeHours:
      mergedWithTime > 0 ? totalLeadMs / mergedWithTime / 3_600_000 : null,
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
      if (!entry) return { repo, prs: [], error: null };
      if (!Array.isArray(entry)) return { repo, prs: [], error: entry.error };

      let prs: PullRequest[] = entry;
      if (activeFilter.value === "sla-warn")
        prs = prs.filter(
          (p) => !p.draft && slaStatus(p.createdAt) === "warning",
        );
      else if (activeFilter.value === "sla-breach")
        prs = prs.filter(
          (p) => !p.draft && slaStatus(p.createdAt) === "breach",
        );
      else if (activeFilter.value === "draft")
        prs = prs.filter((p) => p.reviewStatus === "draft");
      else if (activeFilter.value !== "all")
        prs = prs.filter(
          (p) =>
            p.reviewStatus === activeFilter.value && p.reviewStatus !== "draft",
        );
      else
        // "all" hides drafts by default
        prs = prs.filter((p) => p.reviewStatus !== "draft");
      if (staleOnly.value)
        prs = prs.filter(
          (p) => Date.now() - p.createdAt.getTime() > 7 * 86_400_000,
        );
      if (selectedAuthors.value.length > 0)
        prs = prs.filter((p) => selectedAuthors.value.includes(p.author.login));
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
  filteredGroups.value
    .flatMap((g) => g.prs)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
);

const anyVisible = computed(() =>
  filteredGroups.value.some((g) => g.prs.length > 0 || g.error !== null),
);

// ── data loading ──────────────────────────────────────────────────
async function loadAll(isRefresh = false): Promise<void> {
  loading.value = true;
  const results = await Promise.allSettled(repoList.value.map(fetchRepo));
  let anyOk = false;

  for (let i = 0; i < results.length; i++) {
    const repo = repoList.value[i]!;
    const r = results[i]!;

    if (r.status === "fulfilled") {
      const fresh = r.value;
      anyOk = true;

      // Annotate each PR with its SLA row CSS class (drafts are exempt)
      for (const p of fresh) {
        if (p.draft) {
          p._slaRowCss = "";
          continue;
        }
        const s = slaStatus(p.createdAt);
        p._slaRowCss =
          s === "breach"
            ? "row-sla-breach"
            : s === "warning"
              ? "row-sla-warning"
              : "";
      }

      if (isRefresh && knownIds.value[repo]) {
        const prevIds = knownIds.value[repo]!;
        const freshIds = new Set(fresh.map((p) => p.id));

        for (const p of fresh) {
          if (!prevIds.has(p.id)) {
            playNewPR();
            addToast(
              "new",
              "🔔",
              "New pull request",
              `${repo} #${p.number}: ${p.title}`,
            );
            await nextTick();
            p._flashClass = "flash-new";
            setTimeout(() => {
              p._flashClass = "";
            }, 900);
          }
        }

        for (const id of prevIds) {
          if (!freshIds.has(id)) {
            const existing = prData.value[repo];
            const prev = Array.isArray(existing)
              ? existing.find((p) => p.id === id)
              : undefined;
            if (prev) {
              void checkIfMerged(repo, prev.number).then((merged) => {
                if (merged) {
                  playMerged();
                  addToast(
                    "merged",
                    "🎉",
                    "PR merged!",
                    `${repo} #${prev.number}: ${prev.title}`,
                  );
                }
              });
            }
          }
        }
      }

      knownIds.value[repo] = new Set(fresh.map((p) => p.id));
      prData.value[repo] = fresh;
    } else {
      const msg =
        r.reason instanceof Error ? r.reason.message : "Failed to load";
      prData.value[repo] = { error: msg };
    }
  }

  if (!isRefresh && !anyOk) {
    const first = results[0];
    const msg =
      first?.status === "rejected" && first.reason instanceof Error
        ? first.reason.message
        : "Failed to connect";
    throw new Error(msg);
  }

  loading.value = false;
  lastUpdated.value = new Date().toLocaleTimeString();
}

async function loadActivity(): Promise<void> {
  activityLoading.value = true;
  const results = await Promise.allSettled(
    repoList.value.map(async (repo) => ({
      repo,
      metrics: await fetchRecentActivity(repo),
    })),
  );
  const updated = { ...activityByRepo.value };
  for (const r of results) {
    if (r.status === "fulfilled") updated[r.value.repo] = r.value.metrics;
  }
  activityByRepo.value = updated;
  activityLoading.value = false;
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
    void loadActivity();
    connected.value = true;
    startPolling();
  } catch (e) {
    setupError.value = e instanceof Error ? e.message : "Unknown error";
  }
  loading.value = false;
}

async function refreshAll(): Promise<void> {
  if (!loading.value) {
    await loadAll(true);
    void loadActivity();
  }
}

async function handleSaveSettings(
  newRepos: string[],
  newToken?: string,
): Promise<void> {
  showSettings.value = false;
  if (newToken !== undefined) {
    token.value = newToken;
    saveToken(newToken);
  }
  saveList(newRepos);
  prData.value = {};
  knownIds.value = {};
  selectedRepos.value = [];
  selectedAuthors.value = [];
  activityByRepo.value = {};
  activityLoading.value = true;
  await loadAll(false);
  void loadActivity();
  startPolling();
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
function startPolling(): void {
  if (pollTimer !== null) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    void loadAll(true);
    void loadActivity();
  }, 60_000);
}
onUnmounted(() => {
  if (pollTimer !== null) clearInterval(pollTimer);
});

// Auto-connect on mount if token + repos are already available
if (canAutoConnect) {
  void connect(repoList.value);
}
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
      :loading="loading"
      :last-updated="lastUpdated"
      :test-mode="TEST_MODE"
      :on-test-new-pr="playNewPR"
      :on-test-merged="playMerged"
      @refresh="refreshAll"
      @toggle-sound="toggleSound"
      @open-settings="showSettings = true"
    />

    <FilterBar
      v-model:active-filter="activeFilter"
      v-model:stale-only="staleOnly"
      v-model:search-q="searchQ"
      v-model:selected-repos="selectedRepos"
      v-model:selected-authors="selectedAuthors"
      :repo-options="repoOptions"
      :author-options="authorOptions"
      :author-avatars="authorAvatars"
    />

    <SummaryBar
      :total-open="totalOpen"
      :created7d="filteredActivity.created7d"
      :merged7d="filteredActivity.merged7d"
      :avg-lead-time-hours="filteredActivity.avgLeadTimeHours"
      :loading="activityLoading"
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
        <!-- Repo summary chips -->
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

        <!-- Unified PR table -->
        <PrTable
          v-if="allFilteredPrs.length"
          :prs="allFilteredPrs"
          :comment-fire-threshold="COMMENT_FIRE_THRESHOLD"
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
      class="border-t border-border px-5 py-3 font-mono text-[10px] text-muted-foreground/40 text-right"
    >
      Pulldog · auto-refresh every 60s
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
          class="flex items-center gap-3 px-4 py-3 min-w-[240px] max-w-sm shadow-xl"
          :class="
            t.type === 'merged' ? 'border-purple-500/30' : 'border-primary/30'
          "
        >
          <span class="text-base shrink-0">{{ t.icon }}</span>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-foreground text-xs">
              {{ t.title }}
            </div>
            <div class="font-mono text-[10.5px] text-muted-foreground truncate">
              {{ t.sub }}
            </div>
          </div>
        </Card>
      </Transition>
    </div>

    <!-- Settings -->
    <SettingsDialog
      :open="showSettings"
      :has-env-token="hasEnvToken"
      :current-token="token"
      :current-repos="repoList"
      :fetch-repos="fetchAvailableRepos"
      @close="showSettings = false"
      @save="handleSaveSettings"
    />
  </template>
</template>
