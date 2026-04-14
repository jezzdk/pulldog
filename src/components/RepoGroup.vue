<script setup lang="ts">
import Badge from "@/components/ui/Badge.vue";
import PrTable from "@/components/PrTable.vue";
import { GitPullRequest } from "lucide-vue-next";
import type { PullRequest } from "@/types";

defineProps<{
  repo: string;
  prs: PullRequest[];
  error: string | null;
  commentFireThreshold: number;
}>();
</script>

<template>
  <div>
    <!-- Repo header -->
    <div class="flex items-center gap-2 pb-2 mb-1 border-b border-border">
      <GitPullRequest class="h-3.5 w-3.5 text-muted-foreground" />
      <a
        :href="'https://github.com/' + repo"
        target="_blank"
        class="font-mono text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
      >
        {{ repo }}
      </a>
      <Badge variant="secondary" class="text-[10px] px-1.5 py-0">
        {{ prs.length }}
      </Badge>
      <span v-if="error" class="font-mono text-[11px] text-destructive ml-1">
        ⚠ {{ error }}
      </span>
    </div>

    <!-- Table -->
    <PrTable
      v-if="prs.length"
      :prs="prs"
      :comment-fire-threshold="commentFireThreshold"
    />
  </div>
</template>
