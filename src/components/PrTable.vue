<script setup lang="ts">
import Badge from "@/components/ui/Badge.vue";
import Avatar from "@/components/ui/Avatar.vue";
import Tooltip from "@/components/ui/Tooltip.vue";
import SlaIndicator from "@/components/SlaIndicator.vue";
import type { PullRequest, ReviewStatus } from "@/types";

defineProps<{
  prs: PullRequest[];
  commentFireThreshold: number;
  showRepo?: boolean;
}>();

// ── display helpers ───────────────────────────────────────────────
type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "orange"
  | "purple";

const STATUS_LABELS: Record<ReviewStatus, string> = {
  open: "Open",
  approved: "Approved",
  draft: "Draft",
  changes: "Changes",
  merged: "Merged",
};

const STATUS_BADGE_VARIANT: Partial<Record<ReviewStatus, BadgeVariant>> = {
  open: "default",
  approved: "success",
  draft: "secondary",
  changes: "orange",
  merged: "purple",
};

function statusLabel(pr: PullRequest): string {
  return STATUS_LABELS[pr.reviewStatus] ?? "Open";
}
function verboseAge(d: Date): string {
  const ms = Date.now() - d.getTime();
  const totalMin = Math.floor(ms / 60_000);

  if (totalMin < 1) {
    return "just now";
  }

  if (totalMin < 60) {
    return `${totalMin} minute${totalMin === 1 ? "" : "s"} ago`;
  }

  const totalH = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);

  if (totalH < 24) {
    const base = `${totalH} hour${totalH === 1 ? "" : "s"}`;
    return mins === 0
      ? `${base} ago`
      : `${base} and ${mins} minute${mins === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(ms / 86_400_000);
  const hrs = Math.floor((ms % 86_400_000) / 3_600_000);
  const base = `${days} day${days === 1 ? "" : "s"}`;
  return hrs === 0
    ? `${base} ago`
    : `${base} and ${hrs} hour${hrs === 1 ? "" : "s"} ago`;
}
function ageText(d: Date): string {
  const m = (Date.now() - d.getTime()) / 60_000;

  if (m < 60) {
    return `${Math.floor(m)}m`;
  }

  const h = m / 60;

  if (h < 24) {
    return `${Math.floor(h)}h`;
  }

  const dy = h / 24;

  if (dy < 30) {
    return `${Math.floor(dy)}d`;
  }

  return `${Math.floor(dy / 30)}mo`;
}
function openPR(url: string): void {
  window.open(url, "_blank");
}
</script>

<template>
  <div class="rounded-lg border border-border overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full min-w-[700px] border-collapse text-xs">
        <thead>
          <tr class="border-b border-border bg-muted/30">
            <th
              class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-32"
            >
              Status
            </th>
            <th
              class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2"
            >
              Pull Request
            </th>
            <th
              v-if="showRepo"
              class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-32 hidden md:table-cell"
            >
              Repo
            </th>
            <th
              class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-32 hidden sm:table-cell"
            >
              Author
            </th>
            <th
              class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-20"
            >
              Assignee
            </th>
            <th
              class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-24"
            >
              Reviewers
            </th>
            <th
              class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-20 hidden sm:table-cell"
            >
              Comments
            </th>
            <th
              class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-12"
            >
              Age
            </th>
            <th
              class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-36"
            >
              SLA
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="pr in prs"
            :key="pr.id"
            :class="[
              'border-b border-border last:border-0 transition-colors cursor-pointer hover:bg-muted/20',
              pr._flashClass,
              pr.reviewStatus === 'approved' ? 'row-approved' : '',
              pr.reviewStatus === 'changes' ? 'row-changes' : '',
            ]"
            @click="openPR(pr.url)"
          >
            <!-- Status -->
            <td class="px-3 py-2.5">
              <div class="flex items-center gap-1.5">
                <div
                  class="h-1.5 w-1.5 rounded-full shrink-0"
                  :class="`dot-${pr.reviewStatus}`"
                />
                <Badge
                  :variant="
                    STATUS_BADGE_VARIANT[pr.reviewStatus] ?? 'secondary'
                  "
                  class="text-[10px]"
                >
                  {{ statusLabel(pr) }}
                </Badge>
              </div>
            </td>

            <!-- Title -->
            <td class="px-3 py-2.5 max-w-xs">
              <a
                :href="pr.url"
                target="_blank"
                @click.stop
                class="block truncate font-medium text-foreground hover:text-primary transition-colors leading-snug"
              >
                {{ pr.title }}
              </a>
              <span class="font-mono text-[10px] text-muted-foreground">
                #{{ pr.number }} ·
                <template v-if="pr.reviewStatus === 'merged' && pr.mergedAt">
                  Merged
                  <Tooltip :text="pr.mergedAt.toISOString()">{{
                    verboseAge(pr.mergedAt)
                  }}</Tooltip>
                </template>
                <template
                  v-else-if="pr.reviewStatus === 'approved' && pr.reviewedAt"
                >
                  Approved
                  <Tooltip :text="pr.reviewedAt.toISOString()">{{
                    verboseAge(pr.reviewedAt)
                  }}</Tooltip>
                </template>
                <template
                  v-else-if="pr.reviewStatus === 'changes' && pr.reviewedAt"
                >
                  Reviewed
                  <Tooltip :text="pr.reviewedAt.toISOString()">{{
                    verboseAge(pr.reviewedAt)
                  }}</Tooltip>
                </template>
                <template v-else>
                  Opened
                  <Tooltip :text="pr.createdAt.toISOString()">{{
                    verboseAge(pr.createdAt)
                  }}</Tooltip>
                </template>
              </span>
            </td>

            <!-- Repo -->
            <td v-if="showRepo" class="px-3 py-2.5 hidden md:table-cell">
              <a
                :href="'https://github.com/' + pr.repo"
                target="_blank"
                @click.stop
                class="font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                {{ pr.repo.split("/")[1] }}
              </a>
            </td>

            <!-- Author -->
            <td class="px-3 py-2.5 hidden sm:table-cell">
              <a
                :href="'https://github.com/' + pr.author.login"
                target="_blank"
                @click.stop
                class="flex items-center gap-2 group w-fit"
              >
                <Avatar
                  :src="pr.author.avatar_url + '&s=48'"
                  :alt="pr.author.login"
                />
                <span
                  class="font-mono text-[11px] text-muted-foreground group-hover:text-primary transition-colors"
                >
                  {{ pr.author.login }}
                </span>
              </a>
            </td>

            <!-- Assignee -->
            <td class="px-3 py-2.5">
              <div v-if="pr.assignees.length" class="flex -space-x-1.5">
                <Tooltip
                  v-for="u in pr.assignees"
                  :key="u.login"
                  :text="u.login"
                >
                  <Avatar :src="u.avatar_url + '&s=48'" :alt="u.login" />
                </Tooltip>
              </div>
              <span
                v-else
                class="font-mono text-[11px] text-muted-foreground"
              >
                —
              </span>
            </td>

            <!-- Reviewers -->
            <td class="px-3 py-2.5">
              <div
                v-if="pr.requestedReviewers.length"
                class="flex -space-x-1.5"
              >
                <Tooltip
                  v-for="u in pr.requestedReviewers"
                  :key="u.login"
                  :text="u.login"
                >
                  <Avatar :src="u.avatar_url + '&s=48'" :alt="u.login" />
                </Tooltip>
              </div>
              <span
                v-else
                class="font-mono text-[11px] text-muted-foreground"
              >
                —
              </span>
            </td>

            <!-- Comments -->
            <td class="px-3 py-2.5 hidden sm:table-cell">
              <div
                class="flex items-center gap-1 font-mono text-[11px]"
                :class="
                  pr.commentCount >= commentFireThreshold
                    ? 'text-orange-400 font-semibold'
                    : 'text-muted-foreground'
                "
              >
                <span>{{ pr.commentCount }}</span>
                <Tooltip
                  v-if="pr.commentCount >= commentFireThreshold"
                  text="Hot PR!"
                >
                  <span class="text-sm leading-none">🔥</span>
                </Tooltip>
              </div>
            </td>

            <!-- Age -->
            <td class="px-3 py-2.5">
              <Tooltip :text="pr.createdAt.toISOString()">
                <span class="font-mono text-[11px] text-muted-foreground">
                  {{ ageText(pr.createdAt) }}
                </span>
              </Tooltip>
            </td>

            <!-- SLA — only shown for open PRs -->
            <td class="px-3 py-2.5">
              <SlaIndicator
                v-if="pr.reviewStatus === 'open'"
                :created-at="pr.createdAt"
                :draft="pr.draft"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
