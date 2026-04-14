<script setup lang="ts">
import { cn } from "@/lib/utils";
const props = withDefaults(
  defineProps<{
    class?: string;
    modelValue?: string;
    placeholder?: string;
  }>(),
  { class: "" },
);
defineEmits<{ "update:modelValue": [value: string] }>();
</script>
<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :class="
      cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-vertical',
        props.class,
      )
    "
    @input="
      $emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)
    "
  />
</template>
