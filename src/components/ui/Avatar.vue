<script setup lang="ts">
withDefaults(defineProps<{
  src?:  string
  alt?:  string
  size?: 'sm' | 'md'
}>(), { alt: '', size: 'sm' })
</script>
<template>
  <div
    class="relative inline-flex shrink-0 rounded-full border-2 border-background overflow-hidden bg-secondary"
    :class="size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'"
  >
    <img v-if="src" :src="src" :alt="alt" loading="lazy" class="h-full w-full object-cover" />
    <span v-else class="flex h-full w-full items-center justify-center font-mono text-[8px] text-muted-foreground uppercase">
      {{ alt.slice(0, 2) }}
    </span>
  </div>
</template>
