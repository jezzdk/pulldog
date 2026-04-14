<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    text?: string;
    delay?: number;
    side?: "top" | "bottom";
  }>(),
  { delay: 1000, side: "top" },
);

const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

function show() {
  if (!props.text) {
    return;
  }

  timer = setTimeout(() => {
    visible.value = true;
  }, props.delay);
}
function hide() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }

  visible.value = false;
}
</script>

<template>
  <div class="relative inline-flex" @mouseenter="show" @mouseleave="hide">
    <slot />
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="text && visible"
        class="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 font-mono text-[10px] text-popover-foreground shadow-lg z-50"
        :class="side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'"
      >
        {{ text }}
      </div>
    </Transition>
  </div>
</template>
