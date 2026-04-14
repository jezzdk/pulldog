<script setup lang="ts">
import { computed } from "vue";
import Progress from "@/components/ui/Progress.vue";

const props = withDefaults(
  defineProps<{
    totalOpen: number;
    created7d: number | null;
    merged7d: number | null;
    avgLeadTimeHours: number | null;
    loading: boolean;
  }>(),
  {
    totalOpen: 0,
    created7d: null,
    merged7d: null,
    avgLeadTimeHours: null,
    loading: false,
  },
);

function fmtLeadTime(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  return d < 7 ? `${d.toFixed(1)}d` : `${Math.round(d)}d`;
}

const leadLabel = computed(() => fmtLeadTime(props.avgLeadTimeHours));

const leadClass = computed((): string => {
  const h = props.avgLeadTimeHours;
  if (h === null) return "text-foreground";
  if (h <= 24) return "text-emerald-400";
  if (h <= 72) return "text-yellow-400";
  return "text-destructive";
});

const mergeRate = computed((): number =>
  (props.created7d ?? 0) > 0
    ? Math.min(
        100,
        Math.round(((props.merged7d ?? 0) / props.created7d!) * 100),
      )
    : 0,
);
</script>

<template>
  <div
    class="flex items-center gap-0 overflow-x-auto border-b border-border bg-card px-6"
  >
    <!-- Open PRs -->
    <div class="py-4 pr-8 shrink-0">
      <div
        class="font-mono text-2xl font-bold tracking-tight text-foreground leading-none mb-1"
      >
        <span
          v-if="loading && totalOpen === 0"
          class="skeleton w-8 h-6 rounded"
        />
        <span v-else>{{ totalOpen }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">Open PRs</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">
        right now
      </div>
    </div>

    <div class="h-10 w-px bg-border shrink-0 mr-8" />

    <!-- Created 7d -->
    <div class="py-4 pr-8 shrink-0">
      <div
        class="font-mono text-2xl font-bold tracking-tight text-foreground leading-none mb-1"
      >
        <span
          v-if="created7d === null"
          class="skeleton w-8 h-6 rounded inline-block"
        />
        <span v-else>{{ created7d }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">PRs opened</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">
        last 7 days
      </div>
    </div>

    <div class="h-10 w-px bg-border shrink-0 mr-8" />

    <!-- Merged 7d -->
    <div class="py-4 pr-8 shrink-0">
      <div
        class="font-mono text-2xl font-bold tracking-tight text-purple-400 leading-none mb-1"
      >
        <span
          v-if="merged7d === null"
          class="skeleton w-8 h-6 rounded inline-block"
        />
        <span v-else>{{ merged7d }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">PRs merged</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">
        last 7 days
      </div>
    </div>

    <div class="h-10 w-px bg-border shrink-0 mr-8" />

    <!-- Avg lead time -->
    <div class="py-4 pr-8 shrink-0">
      <div
        class="font-mono text-2xl font-bold tracking-tight leading-none mb-1"
        :class="leadClass"
      >
        <span
          v-if="avgLeadTimeHours === null && loading"
          class="skeleton w-10 h-6 rounded inline-block"
        />
        <span v-else>{{ leadLabel }}</span>
      </div>
      <div class="text-xs font-medium text-foreground/80">Avg lead time</div>
      <div class="font-mono text-[10px] text-muted-foreground mt-0.5">
        open → merge, 7d
      </div>
    </div>

    <!-- Merge rate bar -->
    <div
      v-if="created7d !== null && created7d > 0"
      class="ml-auto flex items-center gap-3 pl-4 shrink-0 py-4"
    >
      <span
        class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap"
      >
        Merge rate
      </span>
      <div class="w-24">
        <Progress :value="mergeRate" />
      </div>
      <span class="font-mono text-xs font-semibold text-purple-400 min-w-[3ch]">
        {{ mergeRate }}%
      </span>
    </div>
  </div>
</template>
