// composables/useAudio.ts
import { ref, type Ref } from "vue";
import { useOpenAI } from "./useOpenAI";

interface UseAudioReturn {
  soundEnabled: Ref<boolean>;
  ttsEnabled: Ref<boolean>;
  prTtsEnabled: Ref<boolean>;
  prSoundEnabled: Ref<boolean>;
  mergeSoundEnabled: Ref<boolean>;
  toggle: () => void;
  toggleTts: () => void;
  togglePrTts: () => void;
  togglePrSound: () => void;
  toggleMergeSound: () => void;
  playNewPR: (authorName: string) => Promise<void>;
  playMerged: (authorName: string) => Promise<void>;
}

const STORAGE_KEY = "pulldog-sound";
const TTS_STORAGE_KEY = "pulldog-tts-enabled";
const PR_TTS_KEY = "pulldog-pr-tts-enabled";
const PR_SOUND_KEY = "pulldog-pr-sound-enabled";
const MERGE_SOUND_KEY = "pulldog-merge-sound-enabled";

export function useAudio(): UseAudioReturn {
  const soundEnabled = ref(localStorage.getItem(STORAGE_KEY) === "true");
  const ttsEnabled = ref(localStorage.getItem(TTS_STORAGE_KEY) === "true");
  const prTtsEnabled = ref(localStorage.getItem(PR_TTS_KEY) === "true");
  const prSoundEnabled = ref(localStorage.getItem(PR_SOUND_KEY) !== "false");
  const mergeSoundEnabled = ref(
    localStorage.getItem(MERGE_SOUND_KEY) !== "false",
  );
  let audioCtx: AudioContext | null = null;

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

  // ── Two-tone ascending chime ─────────────────────────────────────
  // A4 (440 Hz) followed by E5 (660 Hz), soft doorbell feel, ~0.4 s each.
  async function playNewPR(authorName: string): Promise<void> {
    if (!soundEnabled.value) {
      return;
    }

    if (prSoundEnabled.value) {
      try {
        const c = ctx(),
          t = c.currentTime;

        const tones: [number, number, number][] = [
          [440, t, 0.4],
          [660, t + 0.18, 0.4],
        ];

        for (const [freq, start, decay] of tones) {
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.3, start + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.001, start + decay);
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(start);
          osc.stop(start + decay + 0.05);
        }
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

    // Play merge sound immediately
    if (mergeSoundEnabled.value) {
      playMergeSound();
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

  function playMergeSound(): void {
    try {
      const c = ctx(),
        t = c.currentTime;

      // Mallet strike: low-passed thump
      const bufLen = Math.floor(c.sampleRate * 0.025);
      const buf = c.createBuffer(1, bufLen, c.sampleRate);
      const d = buf.getChannelData(0);

      for (let i = 0; i < bufLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 5);
      }

      const strike = c.createBufferSource();
      const strikeFilter = c.createBiquadFilter();
      strikeFilter.type = "lowpass";
      strikeFilter.frequency.value = 400;
      const strikeGain = c.createGain();
      strike.buffer = buf;
      strike.connect(strikeFilter);
      strikeFilter.connect(strikeGain);
      strikeGain.gain.setValueAtTime(0.5, t);
      strikeGain.connect(c.destination);
      strike.start(t);

      // Gong partials — slightly inharmonic, all with bloom envelope.
      const partials: [number, number, number, number, number][] = [
        [85, 0.05, 0.55, 0.08, 4.5],
        [172, 0.03, 0.28, 0.07, 4.0],
        [268, 0.02, 0.18, 0.06, 3.5],
        [365, 0.01, 0.12, 0.055, 3.0],
        [490, 0.01, 0.07, 0.05, 2.5],
        [640, 0.0, 0.04, 0.04, 2.0],
        [880, 0.0, 0.025, 0.03, 1.4],
        [1200, 0.0, 0.012, 0.025, 0.9],
      ];

      for (const [freq, initVol, peakVol, bloomTime, decay] of partials) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(initVol, t);
        gain.gain.linearRampToValueAtTime(peakVol, t + bloomTime);
        gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + decay + 0.1);
      }
    } catch (_) {
      /* merge sound unavailable */
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
    toggle,
    toggleTts,
    togglePrTts,
    togglePrSound,
    toggleMergeSound,
    playNewPR,
    playMerged,
  } as UseAudioReturn;
}
