<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from "vue";
import { useAudio } from "@/composables/useAudio";
import { useGithub } from "@/composables/useGithub";
import { slaStatus } from "@/composables/useSla";
import { useTheme } from "@/composables/useTheme";
import { usePersistedRepos } from "@/composables/usePersistedRepos";
import type {
  PullRequest,
  ActivityMetrics,
  Toast,
  FilteredGroup,
} from "@/types";

import SetupScreen from "@/components/SetupScreen.vue";
import Topbar from "@/components/Topbar.vue";
import FilterBar from "@/components/FilterBar.vue";
import RepoGroup from "@/components/RepoGroup.vue";
import SettingsDialog from "@/components/SettingsDialog.vue";
import SummaryBar from "@/components/SummaryBar.vue";
import Card from "@/components/ui/Card.vue";
import { CheckCircle2, RefreshCw } from "lucide-vue-next";

// ── theme (boot before render) ────────────────────────────────────
useTheme();

// ── constants ─────────────────────────────────────────────────────
const COMMENT_FIRE_THRESHOLD = Number(
  import.meta.env.VITE_COMMENT_FIRE_THRESHOLD ?? 10,
);
const ENV_TOKEN =
  (import.meta.env.VITE_GITHUB_TOKEN as string | undefined) ?? "";

// ── persisted repos ───────────────────────────────────────────────
const { reposText, repoList, save: saveRepos } = usePersistedRepos();

// ── session state ─────────────────────────────────────────────────
// Token lives only in memory — sourced from .env or the setup form
const token = ref<string>(ENV_TOKEN);
const connected = ref(false);
const loading = ref(false);
const setupError = ref("");
const showSettings = ref(false);
const lastUpdated = ref("");

// Auto-connect if we have both a token and saved repos
const canAutoConnect = ENV_TOKEN.length > 0 && repoList.value.length > 0;

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

// ── activity metrics ──────────────────────────────────────────────
const activityData = ref<ActivityMetrics>({
  created7d: null,
  merged7d: null,
  avgLeadTimeHours: null,
  activityLoading: true,
});

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
const { fetchRepo, checkIfMerged, fetchRecentActivity } =
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

const totalOpen = computed(
  () => allPRs.value.filter((p) => !p.draft).length,
);
const statOpen = computed(
  () => allPRs.value.filter((p) => p.reviewStatus === "open").length,
);
const statApproved = computed(
  () => allPRs.value.filter((p) => p.reviewStatus === "approved").length,
);

const statWarn = computed(
  () =>
    allPRs.value.filter(
      (p) => !p.draft && slaStatus(p.createdAt) === "warning",
    ).length,
);
const statBreach = computed(
  () =>
    allPRs.value.filter(
      (p) => !p.draft && slaStatus(p.createdAt) === "breach",
    ).length,
);

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
            p.reviewStatus === activeFilter.value &&
            p.reviewStatus !== "draft",
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
  activityData.value.activityLoading = true;
  const results = await Promise.allSettled(
    repoList.value.map(fetchRecentActivity),
  );
  let totalCreated = 0,
    totalMerged = 0,
    totalLeadMs = 0,
    mergedWithTime = 0;

  for (const r of results) {
    if (r.status === "fulfilled") {
      const { created7d, merged7d, avgLeadTimeHours } = r.value;
      totalCreated += created7d;
      totalMerged += merged7d;
      if (avgLeadTimeHours !== null) {
        totalLeadMs += avgLeadTimeHours * 3_600_000 * merged7d;
        mergedWithTime += merged7d;
      }
    }
  }

  activityData.value = {
    created7d: totalCreated,
    merged7d: totalMerged,
    avgLeadTimeHours:
      mergedWithTime > 0 ? totalLeadMs / mergedWithTime / 3_600_000 : null,
    activityLoading: false,
  };
}

async function connect(newRepos: string): Promise<void> {
  setupError.value = "";
  if (!newRepos.trim()) {
    setupError.value = "Please enter at least one repository.";
    return;
  }
  saveRepos(newRepos);
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

async function handleSaveSettings(newRepos: string): Promise<void> {
  showSettings.value = false;
  saveRepos(newRepos);
  prData.value = {};
  knownIds.value = {};
  selectedRepos.value = [];
  selectedAuthors.value = [];
  activityData.value = {
    created7d: null,
    merged7d: null,
    avgLeadTimeHours: null,
    activityLoading: true,
  };
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
  void connect(reposText.value);
}
</script>

<template>
  <!-- ── Setup ───────────────────────────────────────────────── -->
  <SetupScreen
    v-if="!connected"
    :initial-repos="reposText"
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
      :on-test-new-pr="playNewPR"
      :on-test-merged="playMerged"
      @refresh="refreshAll"
      @toggle-sound="toggleSound"
      @open-settings="showSettings = true"
    />

    <SummaryBar
      :total-open="totalOpen"
      :created7d="activityData.created7d"
      :merged7d="activityData.merged7d"
      :avg-lead-time-hours="activityData.avgLeadTimeHours"
      :loading="activityData.activityLoading"
    />

    <FilterBar
      v-model:active-filter="activeFilter"
      v-model:stale-only="staleOnly"
      v-model:search-q="searchQ"
      v-model:selected-repos="selectedRepos"
      v-model:selected-authors="selectedAuthors"
      :repo-options="repoOptions"
      :author-options="authorOptions"
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
        <RepoGroup
          v-for="group in filteredGroups"
          :key="group.repo"
          :repo="group.repo"
          :prs="group.prs"
          :error="group.error"
          :comment-fire-threshold="COMMENT_FIRE_THRESHOLD"
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
      :current-repos="reposText"
      @close="showSettings = false"
      @save="handleSaveSettings"
    />
  </template>
</template>
