<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import Card from "@/components/ui/Card.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import { RefreshCw, Zap, Lock, Search, AlertCircle } from "lucide-vue-next";

const props = defineProps<{
  hasEnvToken: boolean;
  initialToken: string;
  initialSelected: string[];
  fetchRepos: (token?: string) => Promise<string[]>;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  connect: [repos: string[], token?: string];
}>();

// Whether we have a usable token already (env or localStorage)
const hasExistingToken = computed(
  () => props.hasEnvToken || props.initialToken.length > 0,
);

type Step = "token" | "loading" | "repos" | "error";
const step = ref<Step>(hasExistingToken.value ? "loading" : "token");

const tokenInput = ref(props.initialToken);
const availableRepos = ref<string[]>([]);
const selectedRepos = ref<string[]>([...props.initialSelected]);
const search = ref("");
const fetchError = ref("");

const filteredRepos = computed(() => {
  const q = search.value.toLowerCase();
  return q
    ? availableRepos.value.filter((r) => r.toLowerCase().includes(q))
    : availableRepos.value;
});

const allFilteredSelected = computed(
  () =>
    filteredRepos.value.length > 0 &&
    filteredRepos.value.every((r) => selectedRepos.value.includes(r)),
);

async function doFetchRepos(tok?: string): Promise<void> {
  step.value = "loading";
  fetchError.value = "";
  try {
    const repos = await props.fetchRepos(tok);
    availableRepos.value = repos;
    // Keep previously selected repos that are still accessible
    selectedRepos.value = selectedRepos.value.filter((r) => repos.includes(r));
    step.value = "repos";
  } catch (e) {
    fetchError.value =
      e instanceof Error ? e.message : "Failed to fetch repositories";
    step.value = "error";
  }
}

function handleConnect(): void {
  const tok = props.hasEnvToken ? undefined : tokenInput.value.trim();
  void doFetchRepos(tok);
}

function handleStart(): void {
  emit(
    "connect",
    selectedRepos.value,
    props.hasEnvToken ? undefined : tokenInput.value.trim(),
  );
}

function toggleRepo(repo: string): void {
  selectedRepos.value = selectedRepos.value.includes(repo)
    ? selectedRepos.value.filter((r) => r !== repo)
    : [...selectedRepos.value, repo];
}

function toggleAll(): void {
  selectedRepos.value = allFilteredSelected.value
    ? selectedRepos.value.filter((r) => !filteredRepos.value.includes(r))
    : [...new Set([...selectedRepos.value, ...filteredRepos.value])];
}

// Auto-fetch if we already have a token
onMounted(() => {
  if (hasExistingToken.value) {
    void doFetchRepos(props.hasEnvToken ? undefined : props.initialToken);
  }
});
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(217_89%_65%_/_0.07)_0%,transparent_70%)]"
  >
    <Card class="w-full max-w-[480px] p-10">
      <!-- Brand -->
      <div class="flex items-center gap-3 mb-9">
        <div
          class="h-9 w-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary"
        >
          <Zap class="h-4 w-4" />
        </div>
        <div>
          <div
            class="font-mono text-base font-semibold text-foreground tracking-tight"
          >
            Pulldog 🐕
          </div>
          <div class="text-[11px] text-muted-foreground mt-0.5">
            The faithful watchdog for your pull requests
          </div>
        </div>
      </div>

      <div class="space-y-5">
        <!-- ── Step: Token input ── -->
        <template v-if="step === 'token'">
          <div class="space-y-1.5">
            <Label>GitHub Token</Label>
            <Input
              v-model="tokenInput"
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              @keydown.enter="handleConnect"
            />
            <p class="font-mono text-[10.5px] text-muted-foreground">
              Needs
              <code class="text-foreground/70">repo</code>
              scope. Saved to localStorage — never sent to any server.
            </p>
          </div>

          <div
            class="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
          >
            <Lock class="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <p class="font-mono text-[10.5px] text-muted-foreground">
              Everything stays in your browser. Your token and repo list are
              never sent to any server — all GitHub API calls are made directly
              from your machine.
            </p>
          </div>

          <Button
            class="w-full"
            :disabled="!tokenInput.trim()"
            @click="handleConnect"
          >
            Connect →
          </Button>
        </template>

        <!-- ── Step: Loading repos ── -->
        <template v-else-if="step === 'loading'">
          <div
            class="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground"
          >
            <RefreshCw class="h-5 w-5 animate-spin" />
            <span class="font-mono text-xs">Fetching repositories…</span>
          </div>
        </template>

        <!-- ── Step: Fetch error ── -->
        <template v-else-if="step === 'error'">
          <div
            class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5"
          >
            <AlertCircle class="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <p class="font-mono text-[11px] text-destructive">
              {{ fetchError }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              v-if="!hasEnvToken"
              variant="outline"
              class="flex-1"
              @click="step = 'token'"
            >
              ← Back
            </Button>
            <Button class="flex-1" @click="handleConnect"> Retry </Button>
          </div>
        </template>

        <!-- ── Step: Repo list ── -->
        <template v-else-if="step === 'repos'">
          <!-- Search -->
          <div class="relative">
            <Search
              class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none"
            />
            <Input
              v-model="search"
              placeholder="Filter repositories…"
              class="pl-7 h-8"
            />
          </div>

          <!-- Repo list -->
          <div
            v-if="availableRepos.length"
            class="rounded-md border border-border overflow-hidden"
          >
            <!-- Select all row -->
            <button
              class="flex w-full items-center gap-2.5 border-b border-border px-3 py-2 hover:bg-muted/40 transition-colors"
              @click="toggleAll"
            >
              <span
                class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors"
                :class="
                  allFilteredSelected
                    ? 'border-primary bg-primary'
                    : 'border-border'
                "
              >
                <svg
                  v-if="allFilteredSelected"
                  viewBox="0 0 10 10"
                  class="h-2 w-2 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M1.5 5l2.5 2.5 4.5-4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="font-mono text-[11px] text-muted-foreground">
                {{ allFilteredSelected ? "Deselect all" : "Select all" }}
              </span>
            </button>

            <!-- Individual repos -->
            <div class="max-h-56 overflow-y-auto">
              <button
                v-for="repo in filteredRepos"
                :key="repo"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/40 transition-colors border-b border-border last:border-0"
                @click="toggleRepo(repo)"
              >
                <span
                  class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors"
                  :class="
                    selectedRepos.includes(repo)
                      ? 'border-primary bg-primary'
                      : 'border-border'
                  "
                >
                  <svg
                    v-if="selectedRepos.includes(repo)"
                    viewBox="0 0 10 10"
                    class="h-2 w-2 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M1.5 5l2.5 2.5 4.5-4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span class="font-mono text-[11px] text-foreground truncate">
                  {{ repo }}
                </span>
              </button>

              <div
                v-if="filteredRepos.length === 0"
                class="px-3 py-4 text-center font-mono text-[11px] text-muted-foreground"
              >
                No repositories match your filter.
              </div>
            </div>
          </div>

          <p
            v-else
            class="font-mono text-[11px] text-muted-foreground text-center py-4"
          >
            No repositories found for this token.
          </p>

          <!-- Connect error (from App.vue after Start Watching) -->
          <p
            v-if="error"
            class="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 font-mono text-[11px] text-destructive"
          >
            {{ error }}
          </p>

          <Button
            class="w-full"
            :disabled="loading || selectedRepos.length === 0"
            @click="handleStart"
          >
            <RefreshCw v-if="loading" class="h-3 w-3 animate-spin" />
            <span v-else>
              Start Watching
              <span v-if="selectedRepos.length" class="opacity-60 ml-1">
                {{ selectedRepos.length }}
                {{ selectedRepos.length === 1 ? "repo" : "repos" }}
              </span>
            </span>
          </Button>
        </template>
      </div>
    </Card>
  </div>
</template>
