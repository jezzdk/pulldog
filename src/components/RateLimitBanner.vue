<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle } from "lucide-vue-next";
import type { GithubRateLimit } from "@/composables/useGithub";

const props = defineProps<{
  paused: boolean;
  rateLimit: GithubRateLimit | null;
}>();

const resetLabel = computed(() => {
  if (props.rateLimit?.reset === null || props.rateLimit === null) {
    return "";
  }

  return props.rateLimit.reset.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
});
</script>

<template>
  <div
    v-if="paused"
    class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 font-mono text-[11px] text-amber-700 dark:text-amber-300"
  >
    <span class="inline-flex items-center gap-1.5 font-semibold">
      <AlertTriangle class="h-3.5 w-3.5" />
      GitHub rate limit reached
    </span>
    <span>Polling resumes at {{ resetLabel }}.</span>
    <span class="text-muted-foreground">
      limit {{ rateLimit?.limit ?? "?" }} · used {{ rateLimit?.used ?? "?" }} ·
      remaining {{ rateLimit?.remaining ?? "?" }}
    </span>
  </div>
</template>
