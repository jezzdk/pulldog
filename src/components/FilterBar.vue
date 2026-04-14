<script setup lang="ts">
import Input from "@/components/ui/Input.vue";
import MultiSelect from "@/components/ui/MultiSelect.vue";
import Tooltip from "@/components/ui/Tooltip.vue";

interface FilterOption {
  v: string;
  l: string;
}

const FILTERS: FilterOption[] = [
  { v: "all", l: "All" },
  { v: "open", l: "Open" },
  { v: "approved", l: "Approved" },
  { v: "changes", l: "Changes" },
  { v: "draft", l: "Draft" },
  { v: "merged", l: "Merged" },
  { v: "sla-warn", l: "⚠ Warning" },
  { v: "sla-breach", l: "🔴 Breach" },
];

defineProps<{
  activeFilter: string;
  searchQ: string;
  repoOptions: string[];
  authorOptions: string[];
  authorAvatars: Record<string, string>;
  selectedRepos: string[];
  selectedAuthors: string[];
}>();

const emit = defineEmits<{
  "update:activeFilter": [value: string];
  "update:searchQ": [value: string];
  "update:selectedRepos": [value: string[]];
  "update:selectedAuthors": [value: string[]];
}>();
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-2.5"
  >
    <span
      class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mr-1"
    >
      Filter:
    </span>

    <!-- Status filters -->
    <button
      v-for="f in FILTERS"
      :key="f.v"
      @click="emit('update:activeFilter', f.v)"
      class="rounded-full border px-3 py-0.5 font-mono text-[11px] transition-colors whitespace-nowrap"
      :class="
        activeFilter === f.v
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
      "
    >
      {{ f.l }}
    </button>

    <div class="h-4 w-px bg-border mx-1" />

    <!-- Repo + Author dropdowns -->
    <MultiSelect
      label="Repo"
      :options="repoOptions"
      :selected="selectedRepos"
      @update:selected="emit('update:selectedRepos', $event)"
    />
    <MultiSelect
      label="Author"
      :options="authorOptions"
      :avatars="authorAvatars"
      :selected="selectedAuthors"
      @update:selected="emit('update:selectedAuthors', $event)"
    />

    <!-- Search -->
    <Input
      :model-value="searchQ"
      @update:model-value="emit('update:searchQ', $event ?? '')"
      placeholder="Search PRs…"
      class="ml-auto w-44 h-7"
    />
  </div>
</template>
