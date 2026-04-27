<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Card from "@/components/ui/Card.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import RepoPickerList from "@/components/RepoPickerList.vue";
import { useRepoSelector } from "@/composables/useRepoSelector";
import {
  RefreshCw,
  Zap,
  Lock,
  AlertCircle,
  ChevronDown,
  Github,
} from "lucide-vue-next";

const props = defineProps<{
  hasEnvToken: boolean;
  initialToken: string;
  initialSelected: string[];
  fetchRepos: (token?: string) => Promise<string[]>;
  loading: boolean;
  error: string;
  clientId: string;
  oauthState: {
    status: "idle" | "redirecting" | "exchanging" | "success" | "error";
    message?: string;
    token?: string;
  };
}>();

const emit = defineEmits<{
  connect: [repos: string[], token?: string];
  connectWithGithub: [];
  resetToken: [];
}>();

const hasExistingToken = computed(
  () => props.hasEnvToken || props.initialToken.length > 0,
);

type Step = "token" | "loading" | "repos" | "error";
const step = ref<Step>(hasExistingToken.value ? "loading" : "token");

const tokenInput = ref(props.initialToken);
const tokenGuideOpen = ref(false);
const showManualPat = ref(!props.clientId);

const {
  search,
  availableRepos,
  selectedRepos,
  filteredRepos,
  allFilteredSelected,
  fetchState,
  fetchError,
  toggleRepo,
  toggleAll,
  load,
} = useRepoSelector(props.fetchRepos, props.initialSelected);

watch(
  () => props.oauthState,
  (s) => {
    if (s.status === "error") {
      showManualPat.value = true;
    }

    if (s.status === "success" && s.token) {
      tokenInput.value = s.token;
      void doFetchRepos(s.token);
    }
  },
  { deep: true },
);

async function doFetchRepos(tok?: string): Promise<void> {
  step.value = "loading";
  await load(tok);
  step.value = fetchState.value === "error" ? "error" : "repos";
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
            🐕‍🦺 Pulldog
          </div>
          <div class="text-[11px] text-muted-foreground mt-0.5">
            The faithful watchdog for your pull requests
          </div>
        </div>
      </div>

      <div class="space-y-5">
        <!-- ── Step: Token input ── -->
        <template v-if="step === 'token'">
          <!-- OAuth: redirecting to GitHub -->
          <template v-if="oauthState.status === 'redirecting'">
            <div
              class="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground"
            >
              <RefreshCw class="h-5 w-5 animate-spin" />
              <span class="font-mono text-xs">Redirecting to GitHub…</span>
            </div>
          </template>

          <!-- OAuth: exchanging code for token (callback landed) -->
          <template v-else-if="oauthState.status === 'exchanging'">
            <div
              class="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground"
            >
              <RefreshCw class="h-5 w-5 animate-spin" />
              <span class="font-mono text-xs">Completing authorization…</span>
            </div>
          </template>

          <!-- OAuth: error -->
          <template v-else-if="oauthState.status === 'error'">
            <div
              class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5"
            >
              <AlertCircle
                class="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5"
              />
              <p class="font-mono text-[11px] text-destructive">
                {{ oauthState.message }}
              </p>
            </div>
            <Button class="w-full gap-2" @click="emit('connectWithGithub')">
              <Github class="h-4 w-4" />
              Try again with GitHub
            </Button>
            <div class="relative flex items-center gap-3">
              <div class="flex-1 border-t border-border" />
              <span class="font-mono text-[10px] text-muted-foreground"
                >or</span
              >
              <div class="flex-1 border-t border-border" />
            </div>
          </template>

          <!-- OAuth idle: primary connect button -->
          <template v-else-if="clientId && oauthState.status === 'idle'">
            <Button class="w-full gap-2" @click="emit('connectWithGithub')">
              <Github class="h-4 w-4" />
              Connect with GitHub
            </Button>

            <div class="relative flex items-center gap-3">
              <div class="flex-1 border-t border-border" />
              <span class="font-mono text-[10px] text-muted-foreground"
                >or</span
              >
              <div class="flex-1 border-t border-border" />
            </div>

            <button
              v-if="!showManualPat"
              type="button"
              class="w-full font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors text-center"
              @click="showManualPat = true"
            >
              enter a token manually
            </button>
          </template>

          <!-- Manual PAT input -->
          <template v-if="!clientId || showManualPat">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <Label>GitHub Token</Label>
                <button
                  type="button"
                  class="flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground hover:text-foreground transition-colors"
                  @click="tokenGuideOpen = !tokenGuideOpen"
                >
                  How to create one
                  <ChevronDown
                    class="h-3 w-3 transition-transform duration-200"
                    :class="tokenGuideOpen ? 'rotate-180' : ''"
                  />
                </button>
              </div>

              <div
                v-if="tokenGuideOpen"
                class="rounded-md border border-border bg-muted/30 px-3.5 py-3 space-y-2.5"
              >
                <p
                  class="font-mono text-[10.5px] font-semibold text-foreground/80 uppercase tracking-widest"
                >
                  Fine-grained token (recommended)
                </p>
                <ol class="space-y-1.5 list-none">
                  <li
                    class="flex gap-2.5 font-mono text-[11px] text-muted-foreground"
                  >
                    <span class="shrink-0 text-primary font-semibold">1.</span>
                    <span>
                      Open
                      <a
                        href="https://github.com/settings/personal-access-tokens/new"
                        target="_blank"
                        class="text-primary hover:underline"
                        >github.com → Settings → Developer settings →
                        Fine-grained tokens</a
                      >
                    </span>
                  </li>
                  <li
                    class="flex gap-2.5 font-mono text-[11px] text-muted-foreground"
                  >
                    <span class="shrink-0 text-primary font-semibold">2.</span>
                    <span>Give the token a name and set an expiry date.</span>
                  </li>
                  <li
                    class="flex gap-2.5 font-mono text-[11px] text-muted-foreground"
                  >
                    <span class="shrink-0 text-primary font-semibold">3.</span>
                    <span
                      >Under
                      <em class="text-foreground/70 not-italic font-medium"
                        >Repository access</em
                      >, select the repos you want to monitor.</span
                    >
                  </li>
                  <li
                    class="flex gap-2.5 font-mono text-[11px] text-muted-foreground"
                  >
                    <span class="shrink-0 text-primary font-semibold">4.</span>
                    <span>
                      Under
                      <em class="text-foreground/70 not-italic font-medium"
                        >Permissions → Repository permissions</em
                      >, set
                      <em class="text-foreground/70 not-italic font-medium"
                        >Pull requests</em
                      >
                      to
                      <span class="text-foreground/80 font-semibold"
                        >Read-only</span
                      >.
                    </span>
                  </li>
                  <li
                    class="flex gap-2.5 font-mono text-[11px] text-muted-foreground"
                  >
                    <span class="shrink-0 text-primary font-semibold">5.</span>
                    <span
                      >Click
                      <em class="text-foreground/70 not-italic font-medium"
                        >Generate token</em
                      >
                      and paste it below.</span
                    >
                  </li>
                </ol>
              </div>

              <Input
                v-model="tokenInput"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                @keydown.enter="handleConnect"
              />
            </div>

            <div
              class="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <Lock class="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              <p class="font-mono text-[10.5px] text-muted-foreground">
                Everything stays in your browser. Your token and repo list are
                never sent to any server — all GitHub API calls are made
                directly from your machine.
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
          <RepoPickerList
            v-model="search"
            :repos="filteredRepos"
            :available="availableRepos"
            :selected="selectedRepos"
            :all-selected="allFilteredSelected"
            @toggle="toggleRepo"
            @toggle-all="toggleAll"
          />

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

          <button
            v-if="clientId"
            type="button"
            class="w-full font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors text-center"
            @click="emit('resetToken')"
          >
            Wrong permissions? Reconnect with GitHub
          </button>
        </template>
      </div>
    </Card>
  </div>
</template>
