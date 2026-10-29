// composables/useAudio.ts
import { ref, type Ref } from "vue";
import { useOpenAI } from "./useOpenAI";
import openPrUrl from "@/assets/open_pr.mp3?url";
import mergedPrUrl from "@/assets/merged_pr.mp3?url";
import approvedPrUrl from "@/assets/approved_pr.mp3?url";
import closedPrUrl from "@/assets/closed_pr.mp3?url";

type SoundEvent = "open" | "approved" | "merged" | "closed";

interface UseAudioReturn {
  playTestSound: (event: SoundEvent, authorName: string) => Promise<void>;
  soundEnabled: Ref<boolean>;
  ttsEnabled: Ref<boolean>;
  prTtsEnabled: Ref<boolean>;
  closeTtsEnabled: Ref<boolean>;
  prSoundEnabled: Ref<boolean>;
  mergeSoundEnabled: Ref<boolean>;
  closeSoundEnabled: Ref<boolean>;
  approvalTtsEnabled: Ref<boolean>;
  approvalSoundEnabled: Ref<boolean>;
  customApprovalSoundEnabled: Ref<boolean>;
  customSoundEnabled: Ref<boolean>;
  customPrSoundEnabled: Ref<boolean>;
  customClosePrSoundEnabled: Ref<boolean>;
  toggle: () => void;
  toggleTts: () => void;
  togglePrTts: () => void;
  togglePrSound: () => void;
  toggleMergeSound: () => void;
  toggleApprovalTts: () => void;
  toggleApprovalSound: () => void;
  toggleCustomApprovalSound: () => void;
  toggleCloseSound: () => void;
  toggleCustomSound: () => void;
  toggleCustomPrSound: () => void;
  toggleCustomClosePrSound: () => void;
  playNewPR: (authorName: string) => Promise<void>;
  playMerged: (authorName: string) => Promise<void>;
  playClosed: (authorName: string) => Promise<void>;
  playApproved: (authorName: string) => Promise<void>;
  playDefaultNewPR: () => Promise<void>;
  playDefaultApprovedPR: () => Promise<void>;
  playDefaultMerged: () => Promise<void>;
  playDefaultClosed: () => Promise<void>;
}

const STORAGE_KEY = "pulldog-sound";
const TTS_STORAGE_KEY = "pulldog-tts-enabled";
const CLOSE_TTS_KEY = "pulldog-close-tts-enabled";
const PR_TTS_KEY = "pulldog-pr-tts-enabled";
const APPROVAL_TTS_KEY = "pulldog-approval-tts-enabled";
const PR_SOUND_KEY = "pulldog-pr-sound-enabled";
const MERGE_SOUND_KEY = "pulldog-merge-sound-enabled";
const CLOSE_SOUND_KEY = "pulldog-close-sound-enabled";
const APPROVAL_SOUND_KEY = "pulldog-approval-sound-enabled";
const CUSTOM_SOUND_KEY = "pulldog-custom-sound-enabled";
const CUSTOM_PR_SOUND_KEY = "pulldog-custom-pr-sound-enabled";
const CUSTOM_CLOSE_PR_SOUND_KEY = "pulldog-custom-close-pr-sound-enabled";
const CUSTOM_APPROVAL_SOUND_KEY = "pulldog-custom-approval-sound-enabled";
/** Max playback length for per-author custom MP3s (built-in sounds play full length). */
const CUSTOM_SOUND_MAX_SEC = 10;

export function useAudio(): UseAudioReturn {
  const soundEnabled = ref(localStorage.getItem(STORAGE_KEY) === "true");
  const ttsEnabled = ref(localStorage.getItem(TTS_STORAGE_KEY) === "true");
  const prTtsEnabled = ref(localStorage.getItem(PR_TTS_KEY) === "true");
  const closeTtsEnabled = ref(localStorage.getItem(CLOSE_TTS_KEY) === "true");
  const approvalTtsEnabled = ref(
    localStorage.getItem(APPROVAL_TTS_KEY) === "true",
  );
  const prSoundEnabled = ref(localStorage.getItem(PR_SOUND_KEY) !== "false");
  const mergeSoundEnabled = ref(
    localStorage.getItem(MERGE_SOUND_KEY) !== "false",
  );
  const closeSoundEnabled = ref(
    localStorage.getItem(CLOSE_SOUND_KEY) !== "false",
  );
  const approvalSoundEnabled = ref(
    localStorage.getItem(APPROVAL_SOUND_KEY) !== "false",
  );
  const customSoundEnabled = ref(
    localStorage.getItem(CUSTOM_SOUND_KEY) === "true",
  );
  const customPrSoundEnabled = ref(
    localStorage.getItem(CUSTOM_PR_SOUND_KEY) === "true",
  );
  const customClosePrSoundEnabled = ref(
    localStorage.getItem(CUSTOM_CLOSE_PR_SOUND_KEY) === "true",
  );
  const customApprovalSoundEnabled = ref(
    localStorage.getItem(CUSTOM_APPROVAL_SOUND_KEY) === "true",
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

  async function playDefaultSound(url: string): Promise<void> {
    try {
      const buffer = await loadBuffer(url);
      playBuffer(buffer);
    } catch (_) {
      /* audio not available */
    }
  }

  async function playTestSound(
    event: SoundEvent,
    authorName: string,
  ): Promise<void> {
    if (!soundEnabled.value) {
      return;
    }

    const defaultUrl = {
      open: openPrUrl,
      approved: approvedPrUrl,
      merged: mergedPrUrl,
      closed: closedPrUrl,
    }[event];
    const author = authorName.trim();

    if (author) {
      try {
        const buffer = await loadBuffer(
          `https://raw.githubusercontent.com/${author}/pulldog-sounds/main/pr_${event}.mp3`,
        );
        playBuffer(buffer, CUSTOM_SOUND_MAX_SEC);
        return;
      } catch (_) {
        // Preview the built-in sound when the author's file is unavailable.
      }
    }

    await playDefaultSound(defaultUrl);
  }

  function playDefaultNewPR(): Promise<void> {
    return playDefaultSound(openPrUrl);
  }

  function playDefaultApprovedPR(): Promise<void> {
    return playDefaultSound(approvedPrUrl);
  }

  function playDefaultMerged(): Promise<void> {
    return playDefaultSound(mergedPrUrl);
  }

  function playDefaultClosed(): Promise<void> {
    return playDefaultSound(closedPrUrl);
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

  async function playApproved(authorName: string): Promise<void> {
    if (!soundEnabled.value) {
      return;
    }

    if (approvalSoundEnabled.value) {
      try {
        const customUrl =
          customApprovalSoundEnabled.value && authorName
            ? `https://raw.githubusercontent.com/${authorName}/pulldog-sounds/main/pr_approved.mp3`
            : null;
        const buffer = customUrl
          ? await loadBuffer(customUrl).catch(() => loadBuffer(approvedPrUrl))
          : await loadBuffer(approvedPrUrl);
        playBuffer(buffer, customUrl ? CUSTOM_SOUND_MAX_SEC : undefined);
      } catch (_) {
        /* approval sound unavailable */
      }
    }

    if (!approvalTtsEnabled.value) {
      return;
    }

    try {
      const { textToSpeech } = useOpenAI();
      const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const voice = voices[Math.floor(Math.random() * voices.length)]!;
      const audioBuffer = await textToSpeech(
        `A pull request by ${authorName} was approved`,
        voice,
      );
      playBuffer(await ctx().decodeAudioData(audioBuffer));
    } catch (_) {
      /* TTS not available */
    }
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
        playBuffer(buffer, customUrl ? CUSTOM_SOUND_MAX_SEC : undefined);
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
        playBuffer(buffer, customUrl ? CUSTOM_SOUND_MAX_SEC : undefined);
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

  // ── Closed-without-merging sound ─────────────────────────────────────
  // Plays the close sound and optional voice announcement.
  async function playClosed(authorName: string): Promise<void> {
    if (!soundEnabled.value) {
      return;
    }

    if (closeSoundEnabled.value) {
      try {
        const customUrl =
          customClosePrSoundEnabled.value && authorName
            ? `https://raw.githubusercontent.com/${authorName}/pulldog-sounds/main/pr_closed.mp3`
            : null;
        const buffer = customUrl
          ? await loadBuffer(customUrl).catch(() => loadBuffer(closedPrUrl))
          : await loadBuffer(closedPrUrl);
        playBuffer(buffer, customUrl ? CUSTOM_SOUND_MAX_SEC : undefined);
      } catch (_) {
        /* close sound unavailable */
      }
    }

    if (!closeTtsEnabled.value) {
      return;
    }

    try {
      const { textToSpeech } = useOpenAI();
      const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const voice = voices[Math.floor(Math.random() * voices.length)]!;
      const audioBuffer = await textToSpeech(
        `A pull request by ${authorName} was closed without merging`,
        voice,
      );
      playBuffer(await ctx().decodeAudioData(audioBuffer));
    } catch (_) {
      /* TTS not available */
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

  function toggleApprovalTts(): void {
    approvalTtsEnabled.value = !approvalTtsEnabled.value;
    localStorage.setItem(APPROVAL_TTS_KEY, String(approvalTtsEnabled.value));
  }

  function toggleApprovalSound(): void {
    approvalSoundEnabled.value = !approvalSoundEnabled.value;
    localStorage.setItem(
      APPROVAL_SOUND_KEY,
      String(approvalSoundEnabled.value),
    );
  }

  function toggleCustomApprovalSound(): void {
    customApprovalSoundEnabled.value = !customApprovalSoundEnabled.value;
    localStorage.setItem(
      CUSTOM_APPROVAL_SOUND_KEY,
      String(customApprovalSoundEnabled.value),
    );
  }

  function toggleCloseSound(): void {
    closeSoundEnabled.value = !closeSoundEnabled.value;
    localStorage.setItem(CLOSE_SOUND_KEY, String(closeSoundEnabled.value));
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

  function toggleCustomClosePrSound(): void {
    customClosePrSoundEnabled.value = !customClosePrSoundEnabled.value;
    localStorage.setItem(
      CUSTOM_CLOSE_PR_SOUND_KEY,
      String(customClosePrSoundEnabled.value),
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
    playTestSound,
    soundEnabled,
    ttsEnabled,
    prTtsEnabled,
    closeTtsEnabled,
    prSoundEnabled,
    mergeSoundEnabled,
    closeSoundEnabled,
    approvalTtsEnabled,
    approvalSoundEnabled,
    customApprovalSoundEnabled,
    customSoundEnabled,
    customPrSoundEnabled,
    customClosePrSoundEnabled,
    toggle,
    toggleTts,
    togglePrTts,
    togglePrSound,
    toggleMergeSound,
    toggleApprovalTts,
    toggleApprovalSound,
    toggleCustomApprovalSound,
    toggleCloseSound,
    toggleCustomSound,
    toggleCustomPrSound,
    toggleCustomClosePrSound,
    playNewPR,
    playMerged,
    playClosed,
    playApproved,
    playDefaultNewPR,
    playDefaultApprovedPR,
    playDefaultMerged,
    playDefaultClosed,
  } as UseAudioReturn;
}
