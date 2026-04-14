<script setup lang="ts">
import { computed } from "vue";
import { slaStatus, SLA } from "@/composables/useSla";
import Badge from "@/components/ui/Badge.vue";
import { AlertTriangle, XCircle } from "lucide-vue-next";

const props = defineProps<{
  createdAt: Date;
  draft: boolean;
}>();

const status = computed(() =>
  props.draft ? "ok" : slaStatus(props.createdAt),
);
const hoursOpen = computed(() =>
  Math.floor((Date.now() - props.createdAt.getTime()) / 3_600_000),
);
const hoursUntilBreach = computed(() => SLA.breachHours - hoursOpen.value);
const overBy = computed(() => hoursOpen.value - SLA.breachHours);
const overByLabel = computed(() => {
  if (overBy.value < 48) {
    return `+${overBy.value}h`;
  }

  return `+${Math.floor(overBy.value / 24)}d`;
});
</script>

<template>
  <!-- Only show SLA indicator for open PRs that are nearing or past breach -->
  <div v-if="status !== 'ok'">
    <Badge
      :variant="status === 'breach' ? 'destructive' : 'warning'"
      :class="
        status === 'breach'
          ? 'animate-breach-pulse border-destructive/30'
          : 'border-yellow-500/30'
      "
    >
      <XCircle v-if="status === 'breach'" class="h-2.5 w-2.5" />
      <AlertTriangle v-else class="h-2.5 w-2.5" />
      <span v-if="status === 'breach'" class="whitespace-nowrap"
        >Breach {{ overByLabel }}</span
      >
      <span v-else class="whitespace-nowrap">{{ hoursUntilBreach }}h left</span>
    </Badge>
  </div>
</template>
