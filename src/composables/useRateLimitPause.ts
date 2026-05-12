import { computed, ref } from "vue";
import type { Ref } from "vue";
import type { GithubRateLimit } from "@/composables/useGithub";

export function useRateLimitPause(
  rateLimit: Readonly<Ref<GithubRateLimit | null>>,
) {
  const countdown = ref(0);

  const isPaused = computed(() => countdown.value > 0);

  function currentPauseSeconds(): number {
    const current = rateLimit.value;

    if (
      current === null ||
      current.remaining !== 0 ||
      current.reset === null
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.ceil((current.reset.getTime() - Date.now()) / 1_000),
    );
  }

  function sync(): number {
    countdown.value = currentPauseSeconds();
    return countdown.value;
  }

  function clear(): void {
    countdown.value = 0;
  }

  return {
    countdown,
    isPaused,
    sync,
    clear,
  };
}
