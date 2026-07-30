// composables/usePersistedOpenAIKey.ts
import { ref, type Ref } from "vue";

export const OPENAI_KEY_KEY = "pulldog-openai-key";
const ENV_OPENAI_KEY =
  (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? "";

interface UsePersistedOpenAIKeyReturn {
  openAIKey: Ref<string>;
  hasEnvOpenAIKey: boolean;
  save: (value: string) => void;
}

const hasEnvOpenAIKey = ENV_OPENAI_KEY.length > 0;

function load(): string {
  if (hasEnvOpenAIKey) {
    return ENV_OPENAI_KEY;
  }

  return localStorage.getItem(OPENAI_KEY_KEY) ?? "";
}

// Shared across callers: useOpenAI() runs deep inside useAudio at playback time
// and must see the key the settings dialog just saved, without prop drilling.
const openAIKey = ref(load());

export function usePersistedOpenAIKey(): UsePersistedOpenAIKeyReturn {
  function save(value: string): void {
    if (hasEnvOpenAIKey) {
      return;
    }

    openAIKey.value = value;

    if (value) {
      localStorage.setItem(OPENAI_KEY_KEY, value);
    } else {
      localStorage.removeItem(OPENAI_KEY_KEY);
    }
  }

  return { openAIKey, hasEnvOpenAIKey, save };
}
