<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

type Variant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "purple";

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    class?: string;
  }>(),
  {
    variant: "default",
    class: "",
  },
);

const base =
  "inline-flex items-center gap-1 rounded-full border font-mono text-[10px] font-medium px-2 py-0.5 transition-colors";

const variants: Record<Variant, string> = {
  default: "border-transparent bg-primary/15 text-primary",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-destructive/15 text-destructive",
  outline: "border-border text-muted-foreground",
  success: "border-transparent bg-emerald-500/10 text-emerald-400",
  warning: "border-transparent bg-yellow-500/10 text-yellow-400",
  purple: "border-transparent bg-purple-500/10 text-purple-400",
};

const classes = computed(() =>
  cn(base, variants[props.variant!] ?? variants.default, props.class),
);
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
