// composables/useAudio.ts
import { ref, type Ref } from "vue";
import { useOpenAI } from "./useOpenAI";

interface UseAudioReturn {
  soundEnabled: Ref<boolean>;
  toggle: () => void;
  playNewPR: () => void;
  playMerged: (authorName: string) => Promise<void>;
}

const STORAGE_KEY = "pulldog-sound";

export function useAudio(): UseAudioReturn {
  const soundEnabled = ref(localStorage.getItem(STORAGE_KEY) === "true");
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

  // ── Reception desk bell ──────────────────────────────────────────
  // Sharp metallic strike transient + clean high-pitched ring that
  // decays over ~1.5 s.
  function playNewPR(): void {
    if (!soundEnabled.value) {
      return;
    }

    try {
      const c = ctx(),
        t = c.currentTime;

      // Strike transient: brief filtered noise burst
      const bufLen = Math.floor(c.sampleRate * 0.007);
      const buf = c.createBuffer(1, bufLen, c.sampleRate);
      const d = buf.getChannelData(0);

      for (let i = 0; i < bufLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
      }

      const click = c.createBufferSource();
      const clickGain = c.createGain();
      const clickFilter = c.createBiquadFilter();
      clickFilter.type = "highpass";
      clickFilter.frequency.value = 3000;
      click.buffer = buf;
      click.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.gain.setValueAtTime(0.35, t);
      clickGain.connect(c.destination);
      click.start(t);

      // Bell ring partials — fundamental ~2800 Hz (small metal bell)
      const partials: [number, number, number][] = [
        [2800, 0.38, 1.6], // fundamental
        [5620, 0.14, 0.9], // 2nd harmonic (slightly inharmonic)
        [8400, 0.05, 0.5], // 3rd
        [900, 0.04, 1.2], //  body resonance (the "ting" warmth)
      ];

      for (const [freq, vol, decay] of partials) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.004); // instant attack
        gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + decay + 0.05);
      }
    } catch (_) {
      /* audio not available */
    }
  }

  // ── TTS merge announcement with gong ──────────────────────────
  // Always plays gong immediately, then tries to play TTS
  async function playMerged(authorName: string): Promise<void> {
    if (!soundEnabled.value) {
      return;
    }

    // Play gong immediately
    playGong();

    // Try to play TTS on top (don't wait for it)
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
            /* TTS playback failed, gong already played */
          }
        },
        () => {
          /* TTS decode failed, gong already played */
        },
      );
    } catch (_) {
      /* TTS not available, gong already played */
    }
  }

  function playGong(): void {
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
      /* gong unavailable */
    }
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

      playNewPR();
    }
  }

  return { soundEnabled, toggle, playNewPR, playMerged } as UseAudioReturn;
}
