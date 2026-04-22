<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "radix-vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  modelValue: boolean;
  size?: "sm" | "default";
  class?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <SwitchRoot
    :checked="modelValue"
    :class="
      cn(
        'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        props.size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
        modelValue ? 'bg-primary' : 'bg-input',
        props.class,
      )
    "
    @update:checked="emit('update:modelValue', $event)"
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform',
          props.size === 'sm'
            ? 'h-3 w-3 data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0'
            : 'h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        )
      "
    />
  </SwitchRoot>
</template>
