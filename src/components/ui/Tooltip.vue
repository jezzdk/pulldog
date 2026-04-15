<script setup lang="ts">
import { ref, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    text?: string;
    delay?: number;
    side?: "top" | "bottom";
  }>(),
  { delay: 1000, side: "top" },
);

const visible = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const tipStyle = ref<{ top: string; left: string }>({
  top: "0px",
  left: "0px",
});
let timer: ReturnType<typeof setTimeout> | null = null;

function calcPosition() {
  if (!triggerRef.value) {
    return;
  }

  const rect = triggerRef.value.getBoundingClientRect();

  if (props.side === "bottom") {
    tipStyle.value = {
      top: `${rect.bottom + 8}px`,
      left: `${rect.left + rect.width / 2}px`,
    };
  } else {
    tipStyle.value = {
      top: `${rect.top - 8}px`,
      left: `${rect.left + rect.width / 2}px`,
    };
  }
}

function show() {
  if (!props.text) {
    return;
  }

  timer = setTimeout(() => {
    calcPosition();
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

onUnmounted(() => {
  if (timer !== null) {
    clearTimeout(timer);
  }
});
</script>

<template>
  <div
    ref="triggerRef"
    class="relative inline-flex"
    @mouseenter="show"
    @mouseleave="hide"
  >
    <slot />
  </div>

  <Teleport to="body">
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
        class="pointer-events-none fixed -translate-x-1/2 w-max max-w-[260px] whitespace-pre-line rounded-md border border-border bg-popover px-2 py-1 font-mono text-[10px] text-popover-foreground shadow-lg z-[9999]"
        :class="side === 'bottom' ? '' : '-translate-y-full'"
        :style="tipStyle"
      >
        {{ text }}
      </div>
    </Transition>
  </Teleport>
</template>
