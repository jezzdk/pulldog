<script setup lang="ts">
import { computed } from "vue";
import type { GithubRateLimit } from "@/composables/useGithub";

const props = defineProps<{
  rateLimit: GithubRateLimit | null;
}>();

const resetLabel = computed(() => {
  if (props.rateLimit?.reset === null || props.rateLimit === null) {
    return "unknown";
  }

  return props.rateLimit.reset.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
});
</script>

<template>
  <span>
    GitHub rate limit:
    <template v-if="rateLimit">
      {{ rateLimit.remaining ?? "?" }}/{{ rateLimit.limit ?? "?" }} remaining
      · used {{ rateLimit.used ?? "?" }} · reset {{ resetLabel }}
    </template>
    <template v-else>unknown</template>
  </span>
</template>
