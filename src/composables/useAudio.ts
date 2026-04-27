// composables/useAudio.ts
import { ref, type Ref } from "vue";
import { useOpenAI } from "./useOpenAI";
import openPrUrl from "@/assets/open_pr.mp3?url";
import mergedPrUrl from "@/assets/merged_pr.mp3?url";

interface UseAudioReturn {
  soundEnabled: Ref<boolean>;
  ttsEnabled: Ref<boolean>;
  prTtsEnabled: Ref<boolean>;
  prSoundEnabled: Ref<boolean>;
  mergeSoundEnabled: Ref<boolean>;
  customSoundEnabled: Ref<boolean>;
  customPrSoundEnabled: Ref<boolean>;
  toggle: () => void;
  toggleTts: () => void;
  togglePrTts: () => void;
  togglePrSound: () => void;
  toggleMergeSound: () => void;
  toggleCustomSound: () => void;
  toggleCustomPrSound: () => void;
  playNewPR: (authorName: string) => Promise<void>;
  playMerged: (authorName: string) => Promise<void>;
}

const STORAGE_KEY = "pulldog-sound";
const TTS_STORAGE_KEY = "pulldog-tts-enabled";
const PR_TTS_KEY = "pulldog-pr-tts-enabled";
const PR_SOUND_KEY = "pulldog-pr-sound-enabled";
const MERGE_SOUND_KEY = "pulldog-merge-sound-enabled";
const CUSTOM_SOUND_KEY = "pulldog-custom-sound-enabled";
const CUSTOM_PR_SOUND_KEY = "pulldog-custom-pr-sound-enabled";

export function useAudio(): UseAudioReturn {
  const soundEnabled = ref(localStorage.getItem(STORAGE_KEY) === "true");
  const ttsEnabled = ref(localStorage.getItem(TTS_STORAGE_KEY) === "true");
  const prTtsEnabled = ref(localStorage.getItem(PR_TTS_KEY) === "true");
  const prSoundEnabled = ref(localStorage.getItem(PR_SOUND_KEY) !== "false");
  const mergeSoundEnabled = ref(
    localStorage.getItem(MERGE_SOUND_KEY) !== "false",
  );
  const customSoundEnabled = ref(
    localStorage.getItem(CUSTOM_SOUND_KEY) === "true",
  );
  const customPrSoundEnabled = ref(
    localStorage.getItem(CUSTOM_PR_SOUND_KEY) === "true",
  );
  let audioCtx: AudioContext | null = null;
  const bufferCache = new Map<string, AudioBuffer>();

  async function loadBuffer(url: string): Promise<AudioBuffer> {
    if (bufferCache.has(url)) {
      return bufferCache.get(url)!;
    }

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const decoded = await ctx().decodeAudioData(arrayBuffer);
    bufferCache.set(url, decoded);
    return decoded;
  }

  function playBuffer(buffer: AudioBuffer, maxDuration?: number): void {
    const c = ctx();
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0, 0, maxDuration);
  }

  function ctx(): AudioContext {
    if (!audioCtx) {
      audioCtx = new (
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext!
      )();
    }

    return audioCtx;
  }

  async function playNewPR(authorName: string): Promise<void> {
    if (!soundEnabled.value) {
      return;
    }

    if (prSoundEnabled.value) {
      try {
        const customUrl =
          customPrSoundEnabled.value && authorName
            ? `https://raw.githubusercontent.com/${authorName}/pulldog-sounds/main/pr_open.mp3`
            : null;
        const buffer = customUrl
          ? await loadBuffer(customUrl).catch(() => loadBuffer(openPrUrl))
          : await loadBuffer(openPrUrl);
        playBuffer(buffer, customUrl ? 5 : undefined);
      } catch (_) {
        /* audio not available */
      }
    }

    if (!prTtsEnabled.value) {
      return;
    }

    try {
      const { textToSpeech } = useOpenAI();
      const templates = [
        `${authorName} opened a new pull request`,
        `New PR from ${authorName}`,
        `${authorName} just opened a PR`,
        `A new pull request by ${authorName}`,
        `${authorName} has a new PR up for review`,
        `Pull request from ${authorName}`,
      ];
      const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const message = templates[Math.floor(Math.random() * templates.length)]!;
      const voice = voices[Math.floor(Math.random() * voices.length)]!;
      const audioBuffer = await textToSpeech(message, voice);

      const c = ctx();
      c.decodeAudioData(
        audioBuffer,
        (decodedBuffer) => {
          try {
            const source = c.createBufferSource();
            source.buffer = decodedBuffer;
            source.connect(c.destination);
            source.start(0);
          } catch (_) {
            /* TTS playback failed */
          }
        },
        () => {
          /* TTS decode failed */
        },
      );
    } catch (_) {
      /* TTS not available */
    }
  }

  // ── TTS merge announcement with merge sound ──────────────────────────
  // Always plays merge sound immediately, then tries to play TTS
  async function playMerged(authorName: string): Promise<void> {
    if (!soundEnabled.value) {
      return;
    }

    // Play merge sound immediately — prefer author's custom sound if enabled and available
    if (mergeSoundEnabled.value) {
      try {
        const customUrl =
          customSoundEnabled.value && authorName
            ? `https://raw.githubusercontent.com/${authorName}/pulldog-sounds/main/pr_merged.mp3`
            : null;
        const buffer = customUrl
          ? await loadBuffer(customUrl).catch(() => loadBuffer(mergedPrUrl))
          : await loadBuffer(mergedPrUrl);
        playBuffer(buffer, customUrl ? 5 : undefined);
      } catch (_) {
        /* merge sound unavailable */
      }
    }

    // Try to play TTS on top (don't wait for it)
    if (!ttsEnabled.value) {
      return;
    }

    try {
      const { textToSpeech } = useOpenAI();
      const templates = [
        `A PR by ${authorName} has been merged`,
        `${authorName}'s PR is now merged`,
        `PR from ${authorName} merged successfully`,
        `${authorName} just got a PR merged`,
        `Merged: a PR by ${authorName}`,
        `${authorName}'s code made it`,
      ];
      const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const message = templates[Math.floor(Math.random() * templates.length)]!;
      const voice = voices[Math.floor(Math.random() * voices.length)]!;
      const audioBuffer = await textToSpeech(message, voice);

      const c = ctx();
      c.decodeAudioData(
        audioBuffer,
        (decodedBuffer) => {
          try {
            const source = c.createBufferSource();
            source.buffer = decodedBuffer;
            source.connect(c.destination);
            source.start(0);
          } catch (_) {
            /* TTS playback failed, merge sound already played */
          }
        },
        () => {
          /* TTS decode failed, merge sound already played */
        },
      );
    } catch (_) {
      /* TTS not available, merge sound already played */
    }
  }

  function toggleTts(): void {
    ttsEnabled.value = !ttsEnabled.value;
    localStorage.setItem(TTS_STORAGE_KEY, String(ttsEnabled.value));
  }

  function togglePrTts(): void {
    prTtsEnabled.value = !prTtsEnabled.value;
    localStorage.setItem(PR_TTS_KEY, String(prTtsEnabled.value));
  }

  function togglePrSound(): void {
    prSoundEnabled.value = !prSoundEnabled.value;
    localStorage.setItem(PR_SOUND_KEY, String(prSoundEnabled.value));
  }

  function toggleMergeSound(): void {
    mergeSoundEnabled.value = !mergeSoundEnabled.value;
    localStorage.setItem(MERGE_SOUND_KEY, String(mergeSoundEnabled.value));
  }

  function toggleCustomSound(): void {
    customSoundEnabled.value = !customSoundEnabled.value;
    localStorage.setItem(CUSTOM_SOUND_KEY, String(customSoundEnabled.value));
  }

  function toggleCustomPrSound(): void {
    customPrSoundEnabled.value = !customPrSoundEnabled.value;
    localStorage.setItem(
      CUSTOM_PR_SOUND_KEY,
      String(customPrSoundEnabled.value),
    );
  }

  function toggle(): void {
    soundEnabled.value = !soundEnabled.value;
    localStorage.setItem(STORAGE_KEY, String(soundEnabled.value));

    if (soundEnabled.value) {
      try {
        void ctx().resume();
      } catch (_) {
        /* ignore */
      }

      void playNewPR("");
    }
  }

  return {
    soundEnabled,
    ttsEnabled,
    prTtsEnabled,
    prSoundEnabled,
    mergeSoundEnabled,
    customSoundEnabled,
    customPrSoundEnabled,
    toggle,
    toggleTts,
    togglePrTts,
    togglePrSound,
    toggleMergeSound,
    toggleCustomSound,
    toggleCustomPrSound,
    playNewPR,
    playMerged,
  } as UseAudioReturn;
}
