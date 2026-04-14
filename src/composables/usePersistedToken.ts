// composables/usePersistedToken.ts
import { ref, type Ref } from "vue";

const STORAGE_KEY = "pulldog-token";
const ENV_TOKEN =
  (import.meta.env.VITE_GITHUB_TOKEN as string | undefined) ?? "";

interface UsePersistedTokenReturn {
  token: Ref<string>;
  hasEnvToken: boolean;
  save: (value: string) => void;
}

export function usePersistedToken(): UsePersistedTokenReturn {
  const hasEnvToken = ENV_TOKEN.length > 0;

  function load(): string {
    if (hasEnvToken) return ENV_TOKEN;
    return localStorage.getItem(STORAGE_KEY) ?? "";
  }

  function save(value: string): void {
    if (!hasEnvToken) {
      localStorage.setItem(STORAGE_KEY, value);
    }
  }

  const token = ref(load());

  return { token, hasEnvToken, save };
}
