<script setup lang="ts">
defineProps<{ text?: string }>()
</script>
<template>
  <div class="relative group inline-flex">
    <slot />
    <div v-if="text" class="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 font-mono text-[10px] text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
      {{ text }}
    </div>
  </div>
</template>
