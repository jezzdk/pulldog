<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    label: string;
    options?: string[];
    selected?: string[];
    avatars?: Record<string, string>;
  }>(),
  {
    options: () => [],
    selected: () => [],
    avatars: () => ({}),
  },
);

const emit = defineEmits<{
  "update:selected": [value: string[]];
}>();

const open = ref(false);
const root = ref<HTMLDivElement | null>(null);

const activeCount = computed(() => props.selected.length);
const isActive = computed(() => activeCount.value > 0);

function toggle(value: string): void {
  const next = props.selected.includes(value)
    ? props.selected.filter((v) => v !== value)
    : [...props.selected, value];
  emit("update:selected", next);
}

function clear(e: MouseEvent): void {
  e.stopPropagation();
  emit("update:selected", []);
}

function handleOutside(e: MouseEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", handleOutside));
onUnmounted(() => document.removeEventListener("mousedown", handleOutside));
</script>

<template>
  <div ref="root" class="relative">
    <!-- Trigger pill -->
    <button
      @click="open = !open"
      :class="
        cn(
          'flex items-center gap-1 rounded-full border px-3 py-0.5 font-mono text-[11px] transition-colors whitespace-nowrap select-none',
          isActive
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
        )
      "
    >
      {{ label }}
      <span
        v-if="isActive"
        class="flex items-center justify-center rounded-full bg-primary text-primary-foreground h-3.5 min-w-[14px] px-0.5 text-[9px] font-bold leading-none"
      >
        {{ activeCount }}
      </span>
      <span
        v-if="isActive"
        @click="clear"
        class="ml-0.5 flex items-center text-primary/70 hover:text-primary transition-colors"
      >
        <X class="h-2.5 w-2.5" />
      </span>
      <ChevronDown
        v-else
        class="h-2.5 w-2.5 transition-transform duration-150"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="open && options.length"
        class="absolute left-0 top-full mt-1.5 z-50 min-w-[160px] max-w-[240px] rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
      >
        <div class="max-h-56 overflow-y-auto py-1">
          <button
            v-for="opt in options"
            :key="opt"
            @click="toggle(opt)"
            class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-muted/60 transition-colors"
          >
            <span
              class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors"
              :class="
                selected.includes(opt)
                  ? 'border-primary bg-primary'
                  : 'border-border bg-transparent'
              "
            >
              <svg
                v-if="selected.includes(opt)"
                viewBox="0 0 10 10"
                class="h-2 w-2 text-primary-foreground"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M1.5 5l2.5 2.5 4.5-4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <img
              v-if="avatars[opt]"
              :src="avatars[opt] + '&s=32'"
              :alt="opt"
              class="h-4 w-4 rounded-full shrink-0 object-cover"
            />
            <span class="font-mono text-[11px] text-foreground truncate">
              {{ opt }}
            </span>
          </button>
        </div>
        <div v-if="isActive" class="border-t border-border px-3 py-1.5">
          <button
            @click="
              emit('update:selected', []);
              open = false;
            "
            class="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
