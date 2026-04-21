<script setup lang="ts">
import { ref, watch, computed } from "vue";
import Dialog from "@/components/ui/Dialog.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import RepoPickerList from "@/components/RepoPickerList.vue";
import { useRepoSelector } from "@/composables/useRepoSelector";
import { RefreshCw, AlertCircle } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  hasEnvToken: boolean;
  currentToken: string;
  currentRepos: string[];
  currentTitleFilter: string;
  fetchRepos: (token?: string) => Promise<string[]>;
}>();

const emit = defineEmits<{
  close: [];
  save: [repos: string[], token?: string, titleFilter?: string];
}>();

const tokenInput = ref(props.currentToken);
const titleFilterInput = ref(props.currentTitleFilter);

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
} = useRepoSelector(props.fetchRepos, [...props.currentRepos]);

function loadRepos(): void {
  void load(props.hasEnvToken ? undefined : tokenInput.value.trim());
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      tokenInput.value = props.currentToken;
      titleFilterInput.value = props.currentTitleFilter;
      selectedRepos.value = [...props.currentRepos];
      search.value = "";
      loadRepos();
    }
  },
);

const titleFilterValid = computed(() => {
  if (!titleFilterInput.value) {
    return true;
  }

  try {
    new RegExp(titleFilterInput.value);
    return true;
  } catch {
    return false;
  }
});

function handleSave(): void {
  emit(
    "save",
    selectedRepos.value,
    props.hasEnvToken ? undefined : tokenInput.value.trim(),
    titleFilterInput.value,
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
            :disabled="fetchState === 'loading'"
            @click="loadRepos"
          >
            <RefreshCw
              class="h-3 w-3"
              :class="fetchState === 'loading' ? 'animate-spin' : ''"
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
            :disabled="fetchState === 'loading'"
            @click="loadRepos"
          >
            <RefreshCw
              class="h-2.5 w-2.5"
              :class="fetchState === 'loading' ? 'animate-spin' : ''"
            />
            Refresh
          </button>
        </div>

        <!-- Loading -->
        <div
          v-if="fetchState === 'loading'"
          class="flex items-center justify-center gap-2 rounded-md border border-border py-8 text-muted-foreground"
        >
          <RefreshCw class="h-3.5 w-3.5 animate-spin" />
          <span class="font-mono text-xs">Fetching repositories…</span>
        </div>

        <!-- Error -->
        <div v-else-if="fetchState === 'error'" class="space-y-2">
          <div
            class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2"
          >
            <AlertCircle class="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <p class="font-mono text-[11px] text-destructive">
              {{ fetchError }}
            </p>
          </div>
          <Button variant="outline" size="sm" class="w-full" @click="loadRepos">
            Retry
          </Button>
        </div>

        <!-- Repo list -->
        <template v-else-if="fetchState === 'loaded'">
          <RepoPickerList
            v-model="search"
            :repos="filteredRepos"
            :available="availableRepos"
            :selected="selectedRepos"
            :all-selected="allFilteredSelected"
            max-height="max-h-64"
            @toggle="toggleRepo"
            @toggle-all="toggleAll"
          />
        </template>
      </div>

      <!-- PR Title Filter -->
      <div class="space-y-1.5">
        <Label>PR Title Filter</Label>
        <Input
          v-model="titleFilterInput"
          type="text"
          placeholder="e.g. ^WIP|dependabot"
          :class="!titleFilterValid ? 'border-destructive' : ''"
        />
        <p
          v-if="!titleFilterValid"
          class="font-mono text-[10.5px] text-destructive"
        >
          Invalid regular expression.
        </p>
        <p v-else class="font-mono text-[10.5px] text-muted-foreground">
          Regex — PRs with matching titles are hidden from the table and stats.
        </p>
      </div>

      <div class="flex gap-2 pt-1">
        <Button variant="outline" class="flex-1" @click="$emit('close')">
          Cancel
        </Button>
        <Button
          class="flex-1"
          :disabled="
            fetchState !== 'loaded' ||
            selectedRepos.length === 0 ||
            !titleFilterValid
          "
          @click="handleSave"
        >
          Save &amp; Reload
        </Button>
      </div>
    </div>
  </Dialog>
</template>
