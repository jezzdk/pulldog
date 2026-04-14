<script setup lang="ts">
import { computed } from "vue";
import Tooltip from "@/components/ui/Tooltip.vue";

type StatPeriod = "12h" | "24h" | "7d" | "14d" | "30d";

const PERIODS: { value: StatPeriod; label: string }[] = [
  { value: "12h", label: "12h" },
  { value: "24h", label: "24h" },
  { value: "7d",  label: "7d"  },
  { value: "14d", label: "14d" },
  { value: "30d", label: "30d" },
];

const PERIOD_LABEL: Record<StatPeriod, string> = {
  "12h": "last 12 hours",
  "24h": "last 24 hours",
  "7d":  "last 7 days",
  "14d": "last 14 days",
  "30d": "last 30 days",
};

const props = withDefaults(
  defineProps<{
    totalOpen: number;
    created7d: number | null;
    merged7d: number | null;
    avgLeadTimeHours: number | null;
    avgTimeToReviewHours: number | null;
    avgTimeToMergeHours: number | null;
    loading: boolean;
    period: StatPeriod;
  }>(),
  {
    totalOpen: 0,
    created7d: null,
    merged7d: null,
    avgLeadTimeHours: null,
    avgTimeToReviewHours: null,
    avgTimeToMergeHours: null,
    loading: false,
    period: "7d",
  },
);

defineEmits<{ "update:period": [value: StatPeriod] }>();

const periodLabel = computed(() => PERIOD_LABEL[props.period]);

function fmtTime(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  return d < 7 ? `${d.toFixed(1)}d` : `${Math.round(d)}d`;
}

const leadClass = computed((): string => {
  const h = props.avgLeadTimeHours;
  if (h === null) return "text-foreground";
  if (h <= 24) return "text-emerald-400";
  if (h <= 72) return "text-yellow-400";
  return "text-destructive";
});

function timeClass(h: number | null): string {
  if (h === null) return "text-foreground";
  if (h <= 4)  return "text-emerald-400";
  if (h <= 24) return "text-yellow-400";
  return "text-destructive";
}

// Throughput: merged / created, unbounded — above 100% means burning backlog
const throughput = computed((): number | null => {
  if ((props.created7d ?? 0) === 0) return null;
  return Math.round(((props.merged7d ?? 0) / props.created7d!) * 100);
});

const throughputLabel = computed(() =>
  throughput.value === null ? "—" : `${throughput.value}%`,
);

const throughputClass = computed((): string => {
  const v = throughput.value;
  if (v === null) return "text-foreground";
  if (v >= 100) return "text-emerald-400";
  if (v >= 60)  return "text-yellow-400";
  return "text-destructive";
});

const throughputTooltip = computed(() => {
  if (throughput.value === null) return undefined;
  const direction =
    throughput.value >= 100
      ? "You are shipping faster than new work arrives — backlog is shrinking."
      : "New work is arriving faster than you are shipping — backlog is growing.";
  return `${props.merged7d} merged vs. ${props.created7d} opened ${periodLabel.value}. ${direction}`;
});
</script>

<template>
  <div
    class="flex items-center gap-0 overflow-x-auto border-b border-border bg-card px-6"
  >
    <!-- Open PRs -->
    <div class="py-4 pr-8 shrink-0">
      <div class="font-mono text-2xl font-bold tracking-tight text-foreground leading-none mb-1">
        <span v-if="loading && totalOpen === 0" class="skeleton w-8 h-6 rounded" />
        <span v-else>{{ totalOpen }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">Open PRs</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">right now</div>
    </div>

    <div class="h-10 w-px bg-border shrink-0 mr-8" />

    <!-- Created -->
    <div class="py-4 pr-8 shrink-0">
      <div class="font-mono text-2xl font-bold tracking-tight text-foreground leading-none mb-1">
        <span v-if="created7d === null" class="skeleton w-8 h-6 rounded inline-block" />
        <span v-else>{{ created7d }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">PRs opened</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">{{ periodLabel }}</div>
    </div>

    <div class="h-10 w-px bg-border shrink-0 mr-8" />

    <!-- Merged -->
    <div class="py-4 pr-8 shrink-0">
      <div class="font-mono text-2xl font-bold tracking-tight text-purple-400 leading-none mb-1">
        <span v-if="merged7d === null" class="skeleton w-8 h-6 rounded inline-block" />
        <span v-else>{{ merged7d }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">PRs merged</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">{{ periodLabel }}</div>
    </div>

    <div class="h-10 w-px bg-border shrink-0 mr-8" />

    <!-- Throughput -->
    <div class="py-4 pr-8 shrink-0">
      <Tooltip :text="throughputTooltip" side="bottom">
        <div
          class="font-mono text-2xl font-bold tracking-tight leading-none mb-1"
          :class="throughputClass"
        >
          <span v-if="throughput === null && loading" class="skeleton w-10 h-6 rounded inline-block" />
          <span v-else>{{ throughputLabel }}</span>
        </div>
      </Tooltip>
      <div class="text-xs font-medium text-foreground/80">Throughput</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">merged / opened</div>
    </div>

    <div class="h-10 w-px bg-border shrink-0 mr-8" />

    <!-- Avg lead time -->
    <div class="py-4 pr-8 shrink-0">
      <div
        class="font-mono text-2xl font-bold tracking-tight leading-none mb-1"
        :class="leadClass"
      >
        <span v-if="avgLeadTimeHours === null && loading" class="skeleton w-10 h-6 rounded inline-block" />
        <span v-else>{{ fmtTime(avgLeadTimeHours) }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">Avg lead time</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">{{ periodLabel }}</div>
    </div>

    <div class="h-10 w-px bg-border shrink-0 mr-8" />

    <!-- Avg time to review -->
    <div class="py-4 pr-8 shrink-0">
      <div
        class="font-mono text-2xl font-bold tracking-tight leading-none mb-1"
        :class="timeClass(avgTimeToReviewHours)"
      >
        <span v-if="avgTimeToReviewHours === null && loading" class="skeleton w-10 h-6 rounded inline-block" />
        <span v-else>{{ fmtTime(avgTimeToReviewHours) }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">Avg time to review</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">{{ periodLabel }}</div>
    </div>

    <div class="h-10 w-px bg-border shrink-0 mr-8" />

    <!-- Avg time to merge -->
    <div class="py-4 pr-8 shrink-0">
      <div
        class="font-mono text-2xl font-bold tracking-tight leading-none mb-1"
        :class="timeClass(avgTimeToMergeHours)"
      >
        <span v-if="avgTimeToMergeHours === null && loading" class="skeleton w-10 h-6 rounded inline-block" />
        <span v-else>{{ fmtTime(avgTimeToMergeHours) }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">Avg time to merge</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">{{ periodLabel }}</div>
    </div>

    <!-- Period selector -->
    <div class="ml-auto flex items-center gap-1 pl-6 shrink-0 py-4 border-l border-border">
      <span class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mr-1">
        Period
      </span>
      <button
        v-for="p in PERIODS"
        :key="p.value"
        @click="$emit('update:period', p.value)"
        class="rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors"
        :class="
          period === p.value
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
        "
      >
        {{ p.label }}
      </button>
    </div>
  </div>
</template>
