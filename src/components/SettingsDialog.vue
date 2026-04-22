<script setup lang="ts">
import { ref, watch, computed } from "vue";
import Dialog from "@/components/ui/Dialog.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import { RefreshCw } from "lucide-vue-next";
import Switch from "@/components/ui/Switch.vue";

type Option = { label: string; value: number };

const POLL_INTERVAL_OPTIONS: Option[] = [
  { label: "15 seconds", value: 15 },
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "2 minutes", value: 120 },
  { label: "5 minutes", value: 300 },
  { label: "10 minutes", value: 600 },
  { label: "15 minutes", value: 900 },
  { label: "30 minutes", value: 1800 },
];

const SLA_HOUR_OPTIONS: Option[] = [
  { label: "4 hours", value: 4 },
  { label: "8 hours", value: 8 },
  { label: "12 hours", value: 12 },
  { label: "24 hours", value: 24 },
  { label: "48 hours", value: 48 },
  { label: "72 hours", value: 72 },
  { label: "96 hours", value: 96 },
  { label: "120 hours", value: 120 },
  { label: "168 hours (1 week)", value: 168 },
];

const props = defineProps<{
  open: boolean;
  hasEnvToken: boolean;
  currentToken: string;
  currentTitleFilter: string;
  currentPollInterval: number;
  currentSlaWarningHours: number;
  currentSlaBreachHours: number;
  currentCommentFireThreshold: number;
  currentHideDraftsInAll: boolean;
  currentHideMergedInAll: boolean;
  fetchRepos: (token?: string) => Promise<string[]>;
}>();

const emit = defineEmits<{
  close: [];
  save: [
    token?: string,
    titleFilter?: string,
    pollInterval?: number,
    slaWarningHours?: number,
    slaBreachHours?: number,
    commentFireThreshold?: number,
    hideDraftsInAll?: boolean,
    hideMergedInAll?: boolean,
  ];
}>();

const tokenInput = ref(props.currentToken);
const titleFilterInput = ref(props.currentTitleFilter);
const pollIntervalInput = ref(props.currentPollInterval);
const slaWarningHoursInput = ref(props.currentSlaWarningHours);
const slaBreachHoursInput = ref(props.currentSlaBreachHours);
const commentFireThresholdInput = ref(String(props.currentCommentFireThreshold));
const hideDraftsInAllInput = ref(props.currentHideDraftsInAll);
const hideMergedInAllInput = ref(props.currentHideMergedInAll);

watch(
  () => props.open,
  (open) => {
    if (open) {
      tokenInput.value = props.currentToken;
      titleFilterInput.value = props.currentTitleFilter;
      pollIntervalInput.value = props.currentPollInterval;
      slaWarningHoursInput.value = props.currentSlaWarningHours;
      slaBreachHoursInput.value = props.currentSlaBreachHours;
      commentFireThresholdInput.value = String(props.currentCommentFireThreshold);
      hideDraftsInAllInput.value = props.currentHideDraftsInAll;
      hideMergedInAllInput.value = props.currentHideMergedInAll;
    }
  },
);

const warningOptions = computed(() =>
  SLA_HOUR_OPTIONS.filter((o) => o.value < slaBreachHoursInput.value),
);
const breachOptions = computed(() =>
  SLA_HOUR_OPTIONS.filter((o) => o.value > slaWarningHoursInput.value),
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
    slaWarningHoursInput.value,
    slaBreachHoursInput.value,
    Number(commentFireThresholdInput.value),
    hideDraftsInAllInput.value,
    hideMergedInAllInput.value,
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

      <!-- SLA thresholds -->
      <div class="space-y-1.5">
        <Label>SLA Warning</Label>
        <select
          v-model.number="slaWarningHoursInput"
          class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option v-for="opt in warningOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <p class="font-mono text-[10.5px] text-muted-foreground">
          PRs open longer than this are flagged as warning.
        </p>
      </div>

      <div class="space-y-1.5">
        <Label>SLA Breach</Label>
        <select
          v-model.number="slaBreachHoursInput"
          class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option v-for="opt in breachOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <p class="font-mono text-[10.5px] text-muted-foreground">
          PRs open longer than this are flagged as breach.
        </p>
      </div>

      <!-- Comment fire threshold -->
      <div class="space-y-1.5">
        <Label>Comment Fire Threshold</Label>
        <Input
          v-model="commentFireThresholdInput"
          type="number"
          min="1"
          placeholder="10"
        />
        <p class="font-mono text-[10.5px] text-muted-foreground">
          PRs with at least this many comments show a fire indicator.
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

      <!-- All filter visibility -->
      <div class="space-y-1.5">
        <Label>PR List</Label>
        <div class="flex gap-6">
          <label class="flex cursor-pointer items-center gap-2">
            <Switch v-model="hideDraftsInAllInput" />
            <span class="font-mono text-xs text-foreground">Hide drafts</span>
          </label>
          <label class="flex cursor-pointer items-center gap-2">
            <Switch v-model="hideMergedInAllInput" />
            <span class="font-mono text-xs text-foreground">Hide merged</span>
          </label>
        </div>
        <p class="font-mono text-[10.5px] text-muted-foreground">
          Hide draft and/or merged PRs when the "All" filter is active.
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
