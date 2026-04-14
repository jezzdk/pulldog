<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Dialog from "@/components/ui/Dialog.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import { RefreshCw, Search, AlertCircle } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  hasEnvToken: boolean;
  currentToken: string;
  currentRepos: string[];
  fetchRepos: (token?: string) => Promise<string[]>;
}>();

const emit = defineEmits<{
  close: [];
  save: [repos: string[], token?: string];
}>();

type LoadState = "idle" | "loading" | "loaded" | "error";

const tokenInput = ref(props.currentToken);
const selectedRepos = ref<string[]>([...props.currentRepos]);
const availableRepos = ref<string[]>([]);
const loadState = ref<LoadState>("idle");
const loadError = ref("");
const search = ref("");

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

async function loadRepos(): Promise<void> {
  loadState.value = "loading";
  loadError.value = "";
  try {
    const tok = props.hasEnvToken ? undefined : tokenInput.value.trim();
    const repos = await props.fetchRepos(tok);
    availableRepos.value = repos;
    // Preserve selections for repos still accessible; add back any that
    // were previously saved but not yet in the list (edge case)
    const repoSet = new Set(repos);
    selectedRepos.value = selectedRepos.value.filter((r) => repoSet.has(r));
    loadState.value = "loaded";
  } catch (e) {
    loadError.value =
      e instanceof Error ? e.message : "Failed to fetch repositories";
    loadState.value = "error";
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      tokenInput.value = props.currentToken;
      selectedRepos.value = [...props.currentRepos];
      search.value = "";
      void loadRepos();
    }
  },
);

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

function handleSave(): void {
  emit(
    "save",
    selectedRepos.value,
    props.hasEnvToken ? undefined : tokenInput.value.trim(),
  );
}
</script>

<template>
  <Dialog :open="open" @close="$emit('close')">
    <div class="space-y-4">
      <h2 class="font-mono text-sm font-semibold text-foreground">Settings</h2>

      <!-- Token (only when not sourced from .env) -->
      <div v-if="!hasEnvToken" class="space-y-1.5">
        <Label>GitHub Token</Label>
        <div class="flex gap-2">
          <Input
            v-model="tokenInput"
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            class="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            :disabled="loadState === 'loading'"
            @click="loadRepos"
          >
            <RefreshCw
              class="h-3 w-3"
              :class="loadState === 'loading' ? 'animate-spin' : ''"
            />
          </Button>
        </div>
        <p class="font-mono text-[10.5px] text-muted-foreground">
          Saved to localStorage — never sent to any server.
        </p>
      </div>

      <!-- Repositories -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <Label>Repositories</Label>
          <button
            v-if="hasEnvToken"
            class="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            :disabled="loadState === 'loading'"
            @click="loadRepos"
          >
            <RefreshCw
              class="h-2.5 w-2.5"
              :class="loadState === 'loading' ? 'animate-spin' : ''"
            />
            Refresh
          </button>
        </div>

        <!-- Loading -->
        <div
          v-if="loadState === 'loading'"
          class="flex items-center justify-center gap-2 rounded-md border border-border py-8 text-muted-foreground"
        >
          <RefreshCw class="h-3.5 w-3.5 animate-spin" />
          <span class="font-mono text-xs">Fetching repositories…</span>
        </div>

        <!-- Error -->
        <div v-else-if="loadState === 'error'" class="space-y-2">
          <div
            class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2"
          >
            <AlertCircle class="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <p class="font-mono text-[11px] text-destructive">
              {{ loadError }}
            </p>
          </div>
          <Button variant="outline" size="sm" class="w-full" @click="loadRepos">
            Retry
          </Button>
        </div>

        <!-- Repo list -->
        <template v-else-if="loadState === 'loaded'">
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

          <div
            v-if="availableRepos.length"
            class="rounded-md border border-border overflow-hidden"
          >
            <!-- Select all -->
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

            <div class="max-h-64 overflow-y-auto">
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
        </template>
      </div>

      <div class="flex gap-2 pt-1">
        <Button variant="outline" class="flex-1" @click="$emit('close')">
          Cancel
        </Button>
        <Button
          class="flex-1"
          :disabled="loadState !== 'loaded' || selectedRepos.length === 0"
          @click="handleSave"
        >
          Save &amp; Reload
        </Button>
      </div>
    </div>
  </Dialog>
</template>
