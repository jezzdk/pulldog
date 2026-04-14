<script setup lang="ts">
withDefaults(defineProps<{ value?: number }>(), { value: 0 })
</script>
<template>
  <div class="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
    <div
      class="h-full bg-gradient-to-r from-purple-500 to-primary transition-all duration-700 ease-out rounded-full"
      :style="{ width: Math.min(100, value) + '%' }"
    />
  </div>
</template>
