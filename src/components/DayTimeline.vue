<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { PullRequest } from "@/types";
import Tooltip from "@/components/ui/Tooltip.vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  prs: PullRequest[];
  startTime: string;
  endTime: string;
}>();
const emit = defineEmits<{
  "play-opened-sound": [login: string];
  "play-merged-sound": [login: string];
  "play-closed-sound": [login: string];
}>();

const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date();
  }, 60_000);
});
onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});

function timeOnToday(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(now.value);
  date.setHours(hours!, minutes!, 0, 0);
  return date;
}

const rangeStart = computed(() => timeOnToday(props.startTime).getTime());
const rangeEnd = computed(() => timeOnToday(props.endTime).getTime());

function toPct(date: Date): number {
  return (
    ((date.getTime() - rangeStart.value) /
      (rangeEnd.value - rangeStart.value)) *
    100
  );
}

const nowPct = computed(() => toPct(now.value));
const nowVisible = computed(() => nowPct.value >= 0 && nowPct.value <= 100);
const hourTicks = computed(() => {
  const ticks: Date[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const date = new Date(now.value);
    date.setHours(hour, 0, 0, 0);

    if (date.getTime() > rangeStart.value && date.getTime() < rangeEnd.value) {
      ticks.push(date);
    }
  }

  return ticks;
});
const labelInterval = computed(() =>
  Math.ceil((rangeEnd.value - rangeStart.value) / 3_600_000 / 8),
);

function hourLabel(hour: number): string {
  return `${hour % 12 || 12}${hour < 12 ? "am" : "pm"}`;
}

function timeLabel(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const period = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m}${period}`;
}

type TlEvent = {
  pct: number;
  type: "opened" | "merged" | "closed";
  ringClass: string;
  avatar: string;
  login: string;
  tooltip: string;
  row: number;
};

const events = computed<TlEvent[]>(() => {
  const start = rangeStart.value;
  const end = rangeEnd.value;
  const raw: Omit<TlEvent, "row">[] = [];

  for (const pr of props.prs) {
    const openedMs = pr.createdAt.getTime();

    if (openedMs >= start && openedMs < end) {
      raw.push({
        pct: toPct(pr.createdAt),
        type: "opened",
        ringClass:
          pr.reviewStatus === "approved"
            ? "ring-[hsl(var(--color-green))]"
            : pr.reviewStatus === "changes"
              ? "ring-[hsl(var(--color-orange))]"
              : "ring-blue-500",
        avatar: pr.author.avatar_url + "&s=48",
        login: pr.author.login,
        tooltip: `${pr.repo}#${pr.number} opened by ${pr.author.login} at ${timeLabel(pr.createdAt)}`,
      });
    }

    if (pr.mergedAt) {
      const mergedMs = pr.mergedAt.getTime();

      if (mergedMs >= start && mergedMs < end) {
        raw.push({
          pct: toPct(pr.mergedAt),
          type: "merged",
          ringClass: "ring-purple-500",
          avatar: pr.author.avatar_url + "&s=48",
          login: pr.author.login,
          tooltip: `${pr.repo}#${pr.number} merged by ${pr.author.login} at ${timeLabel(pr.mergedAt)}`,
        });
      }
    }

    if (pr.closedAt) {
      const closedMs = pr.closedAt.getTime();

      if (closedMs >= start && closedMs < end) {
        raw.push({
          pct: toPct(pr.closedAt),
          type: "closed",
          ringClass: "ring-red-500",
          avatar: pr.author.avatar_url + "&s=48",
          login: pr.author.login,
          tooltip: `${pr.repo}#${pr.number} closed by ${pr.author.login} at ${timeLabel(pr.closedAt)}`,
        });
      }
    }
  }

  raw.sort((a, b) => a.pct - b.pct);
  const ROW_BY_TYPE = { opened: 0, merged: 1, closed: 2 } as const;
  return raw.map((e) => ({ ...e, row: ROW_BY_TYPE[e.type] }));
});

// Layout constants (px)
const TRACK_BOTTOM = 22;
const AVATAR_SIZE = 16;
const ROW_HEIGHT = 24;
const CONTAINER_HEIGHT = 104;

function playEventSound(event: TlEvent): void {
  if (event.type === "merged") {
    emit("play-merged-sound", event.login);
    return;
  }

  if (event.type === "closed") {
    emit("play-closed-sound", event.login);
    return;
  }

  emit("play-opened-sound", event.login);
}
</script>

<template>
  <div
    class="relative w-full rounded-lg border border-border bg-card overflow-hidden"
    :style="{ height: `${CONTAINER_HEIGHT}px` }"
  >
    <!-- Today label -->
    <span
      class="absolute top-1.5 left-3 font-mono text-[9px] text-muted-foreground/50 select-none uppercase tracking-widest z-10"
    >
      Today
    </span>

    <!-- Hourly vertical lines -->
    <template v-for="tick in hourTicks" :key="`hour-${tick.getHours()}`">
      <div
        class="absolute top-0 w-px bg-muted-foreground/10 pointer-events-none"
        :style="{
          left: `${toPct(tick)}%`,
          bottom: `${TRACK_BOTTOM}px`,
        }"
      />
    </template>

    <!-- Track line -->
    <div
      class="absolute left-0 right-0 h-px bg-border"
      :style="{ bottom: `${TRACK_BOTTOM}px` }"
    />

    <!-- Hour ticks + labels -->
    <template v-for="tick in hourTicks" :key="`tick-${tick.getHours()}`">
      <div
        class="absolute w-px bg-muted-foreground/20"
        :style="{
          left: `${toPct(tick)}%`,
          bottom: `${TRACK_BOTTOM - 1}px`,
          height: '5px',
        }"
      />
      <div
        v-if="tick.getHours() % labelInterval === 0"
        class="absolute -translate-x-1/2 font-mono text-[9px] text-muted-foreground/50 select-none"
        :style="{ left: `${toPct(tick)}%`, bottom: '4px' }"
      >
        {{ hourLabel(tick.getHours()) }}
      </div>
    </template>

    <!-- Current time line -->
    <div
      v-if="nowVisible"
      class="absolute top-0 bottom-0 w-px bg-foreground pointer-events-none z-10"
      :style="{ left: `${nowPct}%` }"
    />
    <!-- Now dot -->
    <div
      v-if="nowVisible"
      class="absolute w-1.5 h-1.5 rounded-full bg-foreground -translate-x-1/2 z-10"
      :style="{ left: `${nowPct}%`, top: '0' }"
    />

    <!-- Avatars -->
    <template v-for="(ev, i) in events" :key="i">
      <div
        class="absolute -translate-x-1/2 cursor-default z-20"
        :style="{
          left: `${ev.pct}%`,
          bottom: `${TRACK_BOTTOM + 3 + ev.row * ROW_HEIGHT}px`,
        }"
      >
        <Tooltip :text="ev.tooltip">
          <button
            type="button"
            :class="
              cn(
                'rounded-full overflow-hidden ring-2 ring-offset-1 ring-offset-card',
                ev.ringClass,
              )
            "
            :style="{ width: `${AVATAR_SIZE}px`, height: `${AVATAR_SIZE}px` }"
            @click="playEventSound(ev)"
          >
            <img
              :src="ev.avatar"
              :alt="ev.login"
              loading="lazy"
              class="h-full w-full object-cover"
            />
          </button>
        </Tooltip>
      </div>
    </template>
  </div>
</template>
