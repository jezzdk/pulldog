import { onUnmounted, ref } from "vue";
import type { Ref } from "vue";

export function usePollingTimer(
  intervalSeconds: Ref<number>,
  onTick: () => void,
  getPauseSeconds: () => number,
) {
  const countdown = ref(intervalSeconds.value);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  function stop(): void {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function start(): void {
    stop();

    const pausedSeconds = getPauseSeconds();

    if (pausedSeconds > 0) {
      countdown.value = pausedSeconds;

      countdownTimer = setInterval(() => {
        const remaining = getPauseSeconds();
        countdown.value = remaining;

        if (remaining === 0) {
          start();
          onTick();
        }
      }, 1_000);
      return;
    }

    countdown.value = intervalSeconds.value;

    pollTimer = setInterval(() => {
      countdown.value = intervalSeconds.value;
      onTick();
    }, intervalSeconds.value * 1_000);

    countdownTimer = setInterval(() => {
      countdown.value = Math.max(0, countdown.value - 1);
    }, 1_000);
  }

  onUnmounted(stop);

  return {
    countdown,
    start,
    stop,
  };
}
