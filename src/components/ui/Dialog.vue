<script setup lang="ts">
import { cn } from "@/lib/utils";
withDefaults(defineProps<{ open?: boolean; class?: string }>(), {
  open: false,
  class: "",
});
defineEmits<{ close: [] }>();
</script>
<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4"
      >
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="$emit('close')"
        />
        <div
          :class="
            cn(
              'relative z-10 min-h-0 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto overscroll-y-contain rounded-xl border border-border bg-card p-6 shadow-2xl',
              $props.class,
            )
          "
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
