<script setup lang="ts">
import { computed } from "vue";
import { slaStatus, SLA } from "@/composables/useSla";
import Badge from "@/components/ui/Badge.vue";
import { AlertTriangle, XCircle } from "lucide-vue-next";

const props = defineProps<{ createdAt: Date }>();

const status = computed(() => slaStatus(props.createdAt));
const hoursOpen = computed(() =>
  Math.floor((Date.now() - props.createdAt.getTime()) / 3_600_000),
);
const overBy = computed(() => hoursOpen.value - SLA.breachHours);
</script>

<template>
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
      <span v-if="status === 'breach'">Breach +{{ overBy }}h</span>
      <span v-else>Warn {{ hoursOpen }}h / {{ SLA.breachHours }}h</span>
    </Badge>
  </div>
</template>
