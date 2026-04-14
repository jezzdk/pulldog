<script setup lang="ts">
import { cn } from "@/lib/utils";
const props = withDefaults(defineProps<{ class?: string }>(), { class: "" });
</script>
<template>
  <label
    :class="
      cn(
        'block font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground',
        props.class,
      )
    "
  >
    <slot />
  </label>
</template>
