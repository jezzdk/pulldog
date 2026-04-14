<script setup lang="ts">
import Badge from "@/components/ui/Badge.vue";
import Avatar from "@/components/ui/Avatar.vue";
import Tooltip from "@/components/ui/Tooltip.vue";
import SlaIndicator from "@/components/SlaIndicator.vue";
import type { PullRequest, ReviewStatus } from "@/types";

defineProps<{
  prs: PullRequest[];
  commentFireThreshold: number;
}>();

// ── display helpers ───────────────────────────────────────────────
type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
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
  changes: "outline",
};

function statusLabel(pr: PullRequest): string {
  return STATUS_LABELS[pr.reviewStatus] ?? "Open";
}
function ageText(d: Date): string {
  const m = (Date.now() - d.getTime()) / 60_000;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  const dy = h / 24;
  if (dy < 30) return `${Math.floor(dy)}d`;
  return `${Math.floor(dy / 30)}mo`;
}
function ageClass(d: Date): string {
  const days = (Date.now() - d.getTime()) / 86_400_000;
  if (days < 1) return "text-emerald-400";
  if (days < 3) return "text-muted-foreground";
  if (days < 7) return "text-yellow-400";
  return "text-destructive";
}
function hex2rgb(hex: string): string {
  const n = parseInt(hex, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
function slaRowCss(pr: PullRequest): string {
  // imported logic inlined to avoid circular dep with SlaIndicator
  return pr._flashClass;
}
function openPR(url: string): void {
  window.open(url, "_blank");
}
</script>

<template>
  <div class="rounded-lg border border-border overflow-hidden">
    <table class="w-full border-collapse text-xs">
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
            class="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-3 py-2 w-28 hidden lg:table-cell"
          >
            Labels
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
            pr._slaRowCss,
            pr.reviewStatus === 'approved' ? 'row-approved' : '',
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
                :variant="STATUS_BADGE_VARIANT[pr.reviewStatus] ?? 'secondary'"
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
              >{{ pr.title }}</a
            >
            <span class="font-mono text-[10px] text-muted-foreground"
              >#{{ pr.number }}</span
            >
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
              <Tooltip v-for="u in pr.assignees" :key="u.login" :text="u.login">
                <Avatar :src="u.avatar_url + '&s=48'" :alt="u.login" />
              </Tooltip>
            </div>
            <span v-else class="font-mono text-[11px] text-muted-foreground/40"
              >—</span
            >
          </td>

          <!-- Reviewers -->
          <td class="px-3 py-2.5">
            <div v-if="pr.requestedReviewers.length" class="flex -space-x-1.5">
              <Tooltip
                v-for="u in pr.requestedReviewers"
                :key="u.login"
                :text="u.login"
              >
                <Avatar :src="u.avatar_url + '&s=48'" :alt="u.login" />
              </Tooltip>
            </div>
            <span v-else class="font-mono text-[11px] text-muted-foreground/40"
              >—</span
            >
          </td>

          <!-- Labels -->
          <td class="px-3 py-2.5 hidden lg:table-cell">
            <div v-if="pr.labels.length" class="flex flex-wrap gap-1">
              <span
                v-for="l in pr.labels.slice(0, 2)"
                :key="l.name"
                class="inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] whitespace-nowrap"
                :style="{
                  borderColor: `rgba(${hex2rgb(l.color)}, 0.4)`,
                  color: `#${l.color}`,
                  background: `rgba(${hex2rgb(l.color)}, 0.07)`,
                }"
                >{{ l.name }}</span
              >
            </div>
            <span v-else class="font-mono text-[11px] text-muted-foreground/40"
              >—</span
            >
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
              <span
                v-if="pr.commentCount >= commentFireThreshold"
                class="text-sm leading-none"
                title="Hot PR!"
                >🔥</span
              >
            </div>
          </td>

          <!-- Age -->
          <td class="px-3 py-2.5">
            <span class="font-mono text-[11px]" :class="ageClass(pr.createdAt)">
              {{ ageText(pr.createdAt) }}
            </span>
          </td>

          <!-- SLA -->
          <td class="px-3 py-2.5">
            <SlaIndicator :created-at="pr.createdAt" :draft="pr.draft" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
