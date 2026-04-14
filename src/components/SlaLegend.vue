<script setup lang="ts">
import { SLA } from "@/composables/useSla";
import Badge from "@/components/ui/Badge.vue";
import { AlertTriangle, XCircle } from "lucide-vue-next";
</script>

<template>
  <div class="flex items-center gap-2">
    <span
      class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60"
    >
      SLA:
    </span>
    <Badge variant="warning" class="border-yellow-500/25 gap-1">
      <AlertTriangle class="h-2.5 w-2.5" />
      {{ SLA.warningHours }}h warn
    </Badge>
    <Badge variant="destructive" class="border-destructive/25 gap-1">
      <XCircle class="h-2.5 w-2.5" />
      {{ SLA.breachHours }}h breach
    </Badge>
  </div>
</template>
