// composables/useFullscreen.ts
// Wraps the browser Fullscreen API with a reactive isFullscreen flag.
// Falls back gracefully if the API is unavailable (e.g. iOS Safari).

import { ref, onMounted, onUnmounted, type Ref } from "vue";

interface UseFullscreenReturn {
  isFullscreen: Ref<boolean>;
  isSupported: Ref<boolean>;
  toggle: () => Promise<void>;
}

export function useFullscreen(): UseFullscreenReturn {
  const isFullscreen = ref(false);
  const isSupported = ref(
    typeof document !== "undefined" &&
      "fullscreenEnabled" in document &&
      document.fullscreenEnabled,
  );

  function sync(): void {
    isFullscreen.value = !!document.fullscreenElement;
  }

  onMounted(() => {
    document.addEventListener("fullscreenchange", sync);
    sync();
  });

  onUnmounted(() => {
    document.removeEventListener("fullscreenchange", sync);
  });

  async function enter(): Promise<void> {
    if (!isSupported.value) {
      return;
    }

    try {
      await document.documentElement.requestFullscreen({
        navigationUI: "hide",
      });
    } catch (_) {
      /* user denied or browser blocked */
    }
  }

  async function exit(): Promise<void> {
    if (!document.fullscreenElement) {
      return;
    }

    try {
      await document.exitFullscreen();
    } catch (_) {
      /* ignore */
    }
  }

  async function toggle(): Promise<void> {
    if (isFullscreen.value) {
      await exit();
    } else {
      await enter();
    }
  }

  return { isFullscreen, isSupported, toggle };
}
