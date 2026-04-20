<script setup lang="ts">
import Input from "@/components/ui/Input.vue";
import { Search } from "lucide-vue-next";

defineProps<{
  modelValue: string;
  repos: string[];
  available: string[];
  selected: string[];
  allSelected: boolean;
  maxHeight?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  toggle: [repo: string];
  toggleAll: [];
}>();
</script>

<template>
  <div class="relative">
    <Search
      class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none"
    />
    <Input
      :model-value="modelValue"
      placeholder="Filter repositories…"
      class="pl-7 h-8"
      @update:model-value="emit('update:modelValue', String($event))"
    />
  </div>

  <div
    v-if="available.length"
    class="rounded-md border border-border overflow-hidden"
  >
    <button
      class="flex w-full items-center gap-2.5 border-b border-border px-3 py-2 hover:bg-muted/40 transition-colors"
      @click="emit('toggleAll')"
    >
      <span
        class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors"
        :class="allSelected ? 'border-primary bg-primary' : 'border-border'"
      >
        <svg
          v-if="allSelected"
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
      <span class="font-mono text-[11px] text-muted-foreground">
        {{ allSelected ? "Deselect all" : "Select all" }}
      </span>
    </button>

    <div :class="['overflow-y-auto', maxHeight ?? 'max-h-56']">
      <button
        v-for="repo in repos"
        :key="repo"
        class="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/40 transition-colors border-b border-border last:border-0"
        @click="emit('toggle', repo)"
      >
        <span
          class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors"
          :class="
            selected.includes(repo)
              ? 'border-primary bg-primary'
              : 'border-border'
          "
        >
          <svg
            v-if="selected.includes(repo)"
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
        <span class="font-mono text-[11px] text-foreground truncate">{{
          repo
        }}</span>
      </button>

      <div
        v-if="repos.length === 0"
        class="px-3 py-4 text-center font-mono text-[11px] text-muted-foreground"
      >
        No repositories match your filter.
      </div>
    </div>
  </div>

  <p
    v-else
    class="font-mono text-[11px] text-muted-foreground text-center py-4"
  >
    No repositories found for this token.
  </p>
</template>
