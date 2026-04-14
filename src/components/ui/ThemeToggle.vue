<script setup lang="ts">
import { useTheme } from "@/composables/useTheme";
import { Sun, Moon, Monitor } from "lucide-vue-next";
import type { Component } from "vue";
import { cn } from "@/lib/utils";
import type { Theme } from "@/types";
import Tooltip from "@/components/ui/Tooltip.vue";

const { theme, setTheme } = useTheme();

interface ThemeOption {
  value: Theme;
  icon: Component;
  label: string;
}

const options: ThemeOption[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];
</script>

<template>
  <div
    class="flex items-center rounded-md border border-border bg-muted/40 p-0.5 gap-0.5"
  >
    <Tooltip
      v-for="opt in options"
      :key="opt.value"
      :text="opt.label"
      side="bottom"
    >
      <button
        @click="setTheme(opt.value)"
        :class="
          cn(
            'flex items-center justify-center h-6 w-6 rounded transition-all duration-150',
            theme === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )
        "
      >
        <component :is="opt.icon" class="h-3 w-3" />
      </button>
    </Tooltip>
  </div>
</template>
