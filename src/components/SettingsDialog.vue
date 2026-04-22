<script setup lang="ts">
import { ref, watch, computed } from "vue";
import Dialog from "@/components/ui/Dialog.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import { RefreshCw } from "lucide-vue-next";

const POLL_INTERVAL_OPTIONS: { label: string; value: number }[] = [
  { label: "15 seconds", value: 15 },
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "2 minutes", value: 120 },
  { label: "5 minutes", value: 300 },
  { label: "10 minutes", value: 600 },
  { label: "15 minutes", value: 900 },
  { label: "30 minutes", value: 1800 },
];

const props = defineProps<{
  open: boolean;
  hasEnvToken: boolean;
  currentToken: string;
  currentTitleFilter: string;
  currentPollInterval: number;
  fetchRepos: (token?: string) => Promise<string[]>;
}>();

const emit = defineEmits<{
  close: [];
  save: [token?: string, titleFilter?: string, pollInterval?: number];
}>();

const tokenInput = ref(props.currentToken);
const titleFilterInput = ref(props.currentTitleFilter);
const pollIntervalInput = ref(props.currentPollInterval);

watch(
  () => props.open,
  (open) => {
    if (open) {
      tokenInput.value = props.currentToken;
      titleFilterInput.value = props.currentTitleFilter;
      pollIntervalInput.value = props.currentPollInterval;
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
    props.hasEnvToken ? undefined : tokenInput.value.trim(),
    titleFilterInput.value,
    pollIntervalInput.value,
  );
}
</script>

<template>
  <Dialog :open="open" @close="$emit('close')">
    <div class="space-y-4">
      <h2 class="font-mono text-sm font-semibold text-foreground">Settings</h2>

      <!-- Poll Interval -->
      <div class="space-y-1.5">
        <Label>Poll Interval</Label>
        <select
          v-model.number="pollIntervalInput"
          class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option
            v-for="opt in POLL_INTERVAL_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
        <p class="font-mono text-[10.5px] text-muted-foreground">
          How often to refresh pull requests.
        </p>
      </div>

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
            @click="fetchRepos(tokenInput.trim())"
          >
            <RefreshCw class="h-3 w-3" />
          </Button>
        </div>
        <p class="font-mono text-[10.5px] text-muted-foreground">
          Saved to localStorage — never sent to any server.
        </p>
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
          :disabled="!titleFilterValid"
          @click="handleSave"
        >
          Save
        </Button>
      </div>
    </div>
  </Dialog>
</template>
