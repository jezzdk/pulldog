<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "default" | "sm" | "icon";

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    class?: string;
    disabled?: boolean;
  }>(),
  {
    variant: "default",
    size: "default",
    class: "",
    disabled: false,
  },
);

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline:
    "border border-border bg-transparent text-muted-foreground hover:border-primary hover:text-primary",
  ghost: "hover:bg-accent/10 text-muted-foreground hover:text-foreground",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizes: Record<Size, string> = {
  default: "h-8 px-3 py-1",
  sm: "h-7 px-2.5 py-1 text-[11px]",
  icon: "h-8 w-8 p-0",
};

const classes = computed(() =>
  cn(base, variants[props.variant!], sizes[props.size!], props.class),
);
</script>

<template>
  <button :class="classes" :disabled="disabled" v-bind="$attrs">
    <slot />
  </button>
</template>
