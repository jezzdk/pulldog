<script setup lang="ts">
import { cn } from "@/lib/utils";
const props = withDefaults(
  defineProps<{
    class?: string;
    modelValue?: string;
    type?: string;
    placeholder?: string;
  }>(),
  { class: "", type: "text" },
);
defineEmits<{ "update:modelValue": [value: string] }>();
</script>
<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :class="
      cn(
        'flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 font-mono text-xs text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @input="
      $emit('update:modelValue', ($event.target as HTMLInputElement).value)
    "
    v-bind="$attrs"
  />
</template>
