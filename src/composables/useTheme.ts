// composables/useTheme.ts
import { ref, watchEffect, onMounted, type Ref } from "vue";
import type { Theme } from "@/types";

const STORAGE_KEY = "pulldog-theme";

// Module-level so state is shared across all consumers
const theme = ref<Theme>("system");

function getSystemPreference(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(value: Theme): void {
  const resolved = value === "system" ? getSystemPreference() : value;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

interface UseThemeReturn {
  theme: Ref<Theme>;
  setTheme: (value: Theme) => void;
}

export function useTheme(): UseThemeReturn {
  onMounted(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && (["light", "dark", "system"] as Theme[]).includes(stored)) {
      theme.value = stored;
    }
    applyTheme(theme.value);

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (theme.value === "system") applyTheme("system");
      });
  });

  watchEffect(() => {
    applyTheme(theme.value);
    localStorage.setItem(STORAGE_KEY, theme.value);
  });

  function setTheme(value: Theme): void {
    theme.value = value;
  }

  return { theme, setTheme };
}
