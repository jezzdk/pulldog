<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { PullRequest } from "@/types";
import Tooltip from "@/components/ui/Tooltip.vue";

const props = defineProps<{ prs: PullRequest[] }>();
const emit = defineEmits<{
  "play-opened-sound": [login: string];
  "play-merged-sound": [login: string];
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

// x-axis: midnight → midnight (local calendar day)
const dayStart = computed(() => {
  const d = new Date(now.value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
});
const DAY_MS = 86_400_000;

function toPct(date: Date): number {
  return ((date.getTime() - dayStart.value) / DAY_MS) * 100;
}

const nowPct = computed(() => toPct(now.value));

const TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24] as const;
const LABEL_HOURS = new Set([3, 6, 9, 12, 15, 18, 21]);

function hourLabel(h: number): string {
  if (h === 12) {
    return "12pm";
  }

  return h < 12 ? `${h}am` : `${h - 12}pm`;
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
  type: "opened" | "merged";
  avatar: string;
  login: string;
  tooltip: string;
  row: number;
};

const events = computed<TlEvent[]>(() => {
  const start = dayStart.value;
  const end = start + DAY_MS;
  const raw: Omit<TlEvent, "row">[] = [];

  for (const pr of props.prs) {
    const openedMs = pr.createdAt.getTime();

    if (openedMs >= start && openedMs < end) {
      raw.push({
        pct: toPct(pr.createdAt),
        type: "opened",
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
          avatar: pr.author.avatar_url + "&s=48",
          login: pr.author.login,
          tooltip: `${pr.repo}#${pr.number} merged by ${pr.author.login} at ${timeLabel(pr.mergedAt)}`,
        });
      }
    }
  }

  raw.sort((a, b) => a.pct - b.pct);
  return raw.map((e) => ({ ...e, row: e.type === "opened" ? 0 : 1 }));
});

// Layout constants (px)
const TRACK_BOTTOM = 22;
const AVATAR_SIZE = 16;
const ROW_HEIGHT = 24;
const CONTAINER_HEIGHT = 100;

function playEventSound(event: TlEvent): void {
  if (event.type === "merged") {
    emit("play-merged-sound", event.login);
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
    <template v-for="h in 23" :key="`hour-${h}`">
      <div
        class="absolute top-0 w-px bg-muted-foreground/10 pointer-events-none"
        :style="{
          left: `${(h / 24) * 100}%`,
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
    <template v-for="h in TICK_HOURS" :key="`tick-${h}`">
      <div
        class="absolute w-px bg-muted-foreground/20"
        :style="{
          left: `${(h / 24) * 100}%`,
          bottom: `${TRACK_BOTTOM - 1}px`,
          height: '5px',
        }"
      />
      <div
        v-if="LABEL_HOURS.has(h)"
        class="absolute -translate-x-1/2 font-mono text-[9px] text-muted-foreground/50 select-none"
        :style="{ left: `${(h / 24) * 100}%`, bottom: '4px' }"
      >
        {{ hourLabel(h) }}
      </div>
    </template>

    <!-- Current time line -->
    <div
      class="absolute top-0 bottom-0 w-px bg-foreground pointer-events-none z-10"
      :style="{ left: `${nowPct}%` }"
    />
    <!-- Now dot -->
    <div
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
            class="rounded-full overflow-hidden ring-2 ring-offset-1 ring-offset-card"
            :class="ev.type === 'opened' ? 'ring-blue-500' : 'ring-purple-500'"
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
