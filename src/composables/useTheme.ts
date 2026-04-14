// composables/useTheme.ts
import { ref, watchEffect, onMounted, type Ref } from "vue";
import type { Theme } from "@/types";

const STORAGE_KEY = "pulldog-theme";
const VALID_THEMES: Theme[] = ["light", "dark", "system"];

function getSystemPreference(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(value: Theme): void {
  const resolved = value === "system" ? getSystemPreference() : value;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

// Read persisted theme before creating the ref so watchEffect never
// overwrites localStorage with the "system" default on first run.
function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;

    if (stored && VALID_THEMES.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable (e.g. private-browsing restrictions)
  }

  return "system";
}

// Module-level so state is shared across all consumers
const theme = ref<Theme>(readStoredTheme());
applyTheme(theme.value);

interface UseThemeReturn {
  theme: Ref<Theme>;
  setTheme: (value: Theme) => void;
}

export function useTheme(): UseThemeReturn {
  onMounted(() => {
    // React to OS-level preference changes when theme is set to "system"
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (theme.value === "system") {
          applyTheme("system");
        }
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
