<script setup lang="ts">
import { ref, watch, computed } from "vue";
import Dialog from "@/components/ui/Dialog.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Tooltip from "@/components/ui/Tooltip.vue";
import { RefreshCw, Info } from "lucide-vue-next";
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
  currentConfettiEnabled: boolean;
  currentTtsEnabled: boolean;
  currentPrTtsEnabled: boolean;
  currentPrSoundEnabled: boolean;
  currentMergeSoundEnabled: boolean;
  currentCustomSoundEnabled: boolean;
  currentCustomPrSoundEnabled: boolean;
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
    confettiEnabled?: boolean,
    ttsEnabled?: boolean,
    prTtsEnabled?: boolean,
    newPrSoundEnabled?: boolean,
    newMergeSoundEnabled?: boolean,
    newCustomSoundEnabled?: boolean,
    newCustomPrSoundEnabled?: boolean,
  ];
}>();

const tokenInput = ref(props.currentToken);
const titleFilterInput = ref(props.currentTitleFilter);
const pollIntervalInput = ref(props.currentPollInterval);
const slaWarningHoursInput = ref(props.currentSlaWarningHours);
const slaBreachHoursInput = ref(props.currentSlaBreachHours);
const commentFireThresholdInput = ref(
  String(props.currentCommentFireThreshold),
);
const hideDraftsInAllInput = ref(props.currentHideDraftsInAll);
const hideMergedInAllInput = ref(props.currentHideMergedInAll);
const confettiEnabledInput = ref(props.currentConfettiEnabled);
const ttsEnabledInput = ref(props.currentTtsEnabled);
const prTtsEnabledInput = ref(props.currentPrTtsEnabled);
const prSoundEnabledInput = ref(props.currentPrSoundEnabled);
const mergeSoundEnabledInput = ref(props.currentMergeSoundEnabled);
const customSoundEnabledInput = ref(props.currentCustomSoundEnabled);
const customPrSoundEnabledInput = ref(props.currentCustomPrSoundEnabled);

watch(
  () => props.open,
  (open) => {
    if (open) {
      tokenInput.value = props.currentToken;
      titleFilterInput.value = props.currentTitleFilter;
      pollIntervalInput.value = props.currentPollInterval;
      slaWarningHoursInput.value = props.currentSlaWarningHours;
      slaBreachHoursInput.value = props.currentSlaBreachHours;
      commentFireThresholdInput.value = String(
        props.currentCommentFireThreshold,
      );
      hideDraftsInAllInput.value = props.currentHideDraftsInAll;
      hideMergedInAllInput.value = props.currentHideMergedInAll;
      confettiEnabledInput.value = props.currentConfettiEnabled;
      ttsEnabledInput.value = props.currentTtsEnabled;
      prTtsEnabledInput.value = props.currentPrTtsEnabled;
      prSoundEnabledInput.value = props.currentPrSoundEnabled;
      mergeSoundEnabledInput.value = props.currentMergeSoundEnabled;
      customSoundEnabledInput.value = props.currentCustomSoundEnabled;
      customPrSoundEnabledInput.value = props.currentCustomPrSoundEnabled;
    }
  },
);

watch(prTtsEnabledInput, (v) => {
  if (v) {
    customPrSoundEnabledInput.value = false;
  }
});
watch(customPrSoundEnabledInput, (v) => {
  if (v) {
    prTtsEnabledInput.value = false;
  }
});
watch(ttsEnabledInput, (v) => {
  if (v) {
    customSoundEnabledInput.value = false;
  }
});
watch(customSoundEnabledInput, (v) => {
  if (v) {
    ttsEnabledInput.value = false;
  }
});

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
    confettiEnabledInput.value,
    ttsEnabledInput.value,
    prTtsEnabledInput.value,
    prSoundEnabledInput.value,
    mergeSoundEnabledInput.value,
    customSoundEnabledInput.value,
    customPrSoundEnabledInput.value,
  );
}
</script>

<template>
  <Dialog :open="open" @close="$emit('close')">
    <div class="space-y-3">
      <h2 class="font-mono text-sm font-semibold text-foreground">Settings</h2>

      <div class="space-y-3">
        <!-- Sync -->
        <fieldset class="rounded border border-border px-3 pb-2.5 pt-1">
          <legend
            class="px-1 font-mono text-[10px] font-medium text-muted-foreground"
          >
            Sync
          </legend>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-1.5">
                <Label>Poll Interval</Label>
                <Tooltip
                  text="How often to refresh pull requests."
                  :delay="300"
                >
                  <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                </Tooltip>
              </div>
              <select
                v-model.number="pollIntervalInput"
                class="w-40 rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option
                  v-for="opt in POLL_INTERVAL_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
        </fieldset>

        <!-- SLA -->
        <fieldset class="rounded border border-border px-3 pb-2.5 pt-1">
          <legend
            class="px-1 font-mono text-[10px] font-medium text-muted-foreground"
          >
            SLA
          </legend>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-1.5">
                <Label>Warning</Label>
                <Tooltip
                  text="PRs open longer than this are flagged as warning."
                  :delay="300"
                >
                  <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                </Tooltip>
              </div>
              <select
                v-model.number="slaWarningHoursInput"
                class="w-40 rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option
                  v-for="opt in warningOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-1.5">
                <Label>Breach</Label>
                <Tooltip
                  text="PRs open longer than this are flagged as breach."
                  :delay="300"
                >
                  <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                </Tooltip>
              </div>
              <select
                v-model.number="slaBreachHoursInput"
                class="w-40 rounded border border-input bg-background px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option
                  v-for="opt in breachOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-1.5">
                <Label>Comment Fire</Label>
                <Tooltip
                  text="PRs with at least this many comments show a fire indicator."
                  :delay="300"
                >
                  <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                </Tooltip>
              </div>
              <Input
                v-model="commentFireThresholdInput"
                type="number"
                min="1"
                placeholder="10"
                class="w-40"
              />
            </div>
          </div>
        </fieldset>

        <!-- PR List -->
        <fieldset class="rounded border border-border px-3 pb-2.5 pt-1">
          <legend
            class="px-1 font-mono text-[10px] font-medium text-muted-foreground"
          >
            PR List
          </legend>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-1.5">
                <Label>Hide Drafts</Label>
                <Tooltip
                  text='Hide draft PRs when the "All" filter is active.'
                  :delay="300"
                >
                  <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                </Tooltip>
              </div>
              <label class="flex w-40 cursor-pointer items-center">
                <Switch v-model="hideDraftsInAllInput" size="sm" />
              </label>
            </div>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-1.5">
                <Label>Hide Merged</Label>
                <Tooltip
                  text='Hide merged PRs when the "All" filter is active.'
                  :delay="300"
                >
                  <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                </Tooltip>
              </div>
              <label class="flex w-40 cursor-pointer items-center">
                <Switch v-model="hideMergedInAllInput" size="sm" />
              </label>
            </div>
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-1.5">
                <Label>Title Filter</Label>
                <Tooltip
                  text="Regex — PRs with matching titles are hidden from the table and stats."
                  :delay="300"
                >
                  <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                </Tooltip>
              </div>
              <div class="w-40">
                <Input
                  v-model="titleFilterInput"
                  type="text"
                  placeholder="e.g. ^WIP"
                  :class="!titleFilterValid ? 'border-destructive' : ''"
                />
                <p
                  v-if="!titleFilterValid"
                  class="mt-0.5 font-mono text-[10px] text-destructive"
                >
                  Invalid regex.
                </p>
              </div>
            </div>
          </div>
        </fieldset>

        <!-- Notifications -->
        <fieldset class="rounded border border-border px-3 pb-2.5 pt-1">
          <legend
            class="px-1 font-mono text-[10px] font-medium text-muted-foreground"
          >
            Notifications
          </legend>
          <div class="space-y-3">
            <!-- New PR -->
            <div class="space-y-2">
              <p class="font-mono text-[10px] text-muted-foreground">New PR</p>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <Label>Sound</Label>
                  <Tooltip
                    text="Play a sound when a new PR is detected."
                    :delay="300"
                  >
                    <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                  </Tooltip>
                </div>
                <label class="flex w-40 cursor-pointer items-center">
                  <Switch v-model="prSoundEnabledInput" size="sm" />
                </label>
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <Label>Voice</Label>
                  <Tooltip
                    text="Speak an announcement when a new PR is opened. Requires sound to be enabled."
                    :delay="300"
                  >
                    <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                  </Tooltip>
                </div>
                <label class="flex w-40 cursor-pointer items-center">
                  <Switch v-model="prTtsEnabledInput" size="sm" />
                </label>
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <Label>Custom sound</Label>
                  <Tooltip
                    text="Looks for a pr_open.mp3 file in a [author]/pulldog-sounds repo"
                    :delay="300"
                  >
                    <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                  </Tooltip>
                </div>
                <label class="flex w-40 cursor-pointer items-center">
                  <Switch v-model="customPrSoundEnabledInput" size="sm" />
                </label>
              </div>
            </div>

            <div class="border-t border-border" />

            <!-- Merge -->
            <div class="space-y-2">
              <p class="font-mono text-[10px] text-muted-foreground">Merge</p>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <Label>Confetti</Label>
                  <Tooltip
                    text="Show a confetti animation when a PR is merged."
                    :delay="300"
                  >
                    <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                  </Tooltip>
                </div>
                <label class="flex w-40 cursor-pointer items-center">
                  <Switch v-model="confettiEnabledInput" size="sm" />
                </label>
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <Label>Sound</Label>
                  <Tooltip
                    text="Play a sound when a PR is merged."
                    :delay="300"
                  >
                    <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                  </Tooltip>
                </div>
                <label class="flex w-40 cursor-pointer items-center">
                  <Switch v-model="mergeSoundEnabledInput" size="sm" />
                </label>
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <Label>Voice</Label>
                  <Tooltip
                    text="Speak an announcement when a PR is merged. Requires sound to be enabled."
                    :delay="300"
                  >
                    <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                  </Tooltip>
                </div>
                <label class="flex w-40 cursor-pointer items-center">
                  <Switch v-model="ttsEnabledInput" size="sm" />
                </label>
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <Label>Custom sound</Label>
                  <Tooltip
                    text="Looks for a pr_merged.mp3 file in a [author]/pulldog-sounds repo"
                    :delay="300"
                  >
                    <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                  </Tooltip>
                </div>
                <label class="flex w-40 cursor-pointer items-center">
                  <Switch v-model="customSoundEnabledInput" size="sm" />
                </label>
              </div>
            </div>
          </div>
        </fieldset>

        <!-- Authentication -->
        <fieldset
          v-if="!hasEnvToken"
          class="rounded border border-border px-3 pb-2.5 pt-1"
        >
          <legend
            class="px-1 font-mono text-[10px] font-medium text-muted-foreground"
          >
            Authentication
          </legend>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-1.5">
                <Label>GitHub Token</Label>
                <Tooltip
                  text="Saved to localStorage — never sent to any server."
                  :delay="300"
                >
                  <Info class="h-3 w-3 cursor-help text-muted-foreground" />
                </Tooltip>
              </div>
              <div class="flex w-40 gap-1">
                <Input
                  v-model="tokenInput"
                  type="password"
                  placeholder="ghp_..."
                  class="min-w-0 flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  @click="fetchRepos(tokenInput.trim())"
                >
                  <RefreshCw class="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </fieldset>
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
