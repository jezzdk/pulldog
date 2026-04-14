// composables/useAudio.ts
import { ref, type Ref } from "vue";

interface UseAudioReturn {
  soundEnabled: Ref<boolean>;
  toggle: () => void;
  playNewPR: () => void;
  playMerged: () => void;
}

export function useAudio(): UseAudioReturn {
  const soundEnabled = ref(false);
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

  function playNewPR(): void {
    if (!soundEnabled.value) return;
    try {
      const c = ctx(),
        t = c.currentTime;
      const notes: [number, number, number][] = [
        [523.25, 0, 0.18],
        [783.99, 0.13, 0.22],
        [1046.5, 0.24, 0.18],
      ];
      notes.forEach(([freq, delay, dur]) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + delay);
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.22, t + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
        osc.start(t + delay);
        osc.stop(t + delay + dur + 0.05);
      });
    } catch (_) {
      /* audio not available */
    }
  }

  function playMerged(): void {
    if (!soundEnabled.value) return;
    try {
      const c = ctx(),
        t = c.currentTime;
      const partials: [number, number, number, number][] = [
        [110, 0, 0.7, 0.55],
        [220, 0, 0.35, 0.5],
        [293, 0.01, 0.28, 0.45],
        [440, 0.02, 0.18, 0.38],
        [550, 0.03, 0.1, 0.3],
        [880, 0.04, 0.06, 0.22],
      ];
      partials.forEach(([freq, delay, vol, decay]) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t + delay);
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(vol * 0.28, t + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + decay + 1.6);
        osc.start(t + delay);
        osc.stop(t + delay + decay + 1.8);
      });
      // Mallet transient click
      const buf = c.createBuffer(
        1,
        Math.floor(c.sampleRate * 0.04),
        c.sampleRate,
      );
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      }
      const src = c.createBufferSource();
      const cg = c.createGain();
      cg.gain.setValueAtTime(0.15, t);
      src.buffer = buf;
      src.connect(cg);
      cg.connect(c.destination);
      src.start(t);
    } catch (_) {
      /* audio not available */
    }
  }

  function toggle(): void {
    soundEnabled.value = !soundEnabled.value;
    if (soundEnabled.value) {
      try {
        void ctx().resume();
      } catch (_) {
        /* ignore */
      }
      playNewPR();
    }
  }

  return { soundEnabled, toggle, playNewPR, playMerged };
}
