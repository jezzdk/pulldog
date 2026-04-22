<script setup lang="ts">
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import ThemeToggle from "@/components/ui/ThemeToggle.vue";
import Tooltip from "@/components/ui/Tooltip.vue";
import { useFullscreen } from "@/composables/useFullscreen";
import {
  RefreshCw,
  Settings,
  GitBranch,
  Volume2,
  VolumeX,
  Zap,
  Maximize2,
  Minimize2,
  Power,
} from "lucide-vue-next";

defineProps<{
  statOpen: number;
  statApproved: number;
  statWarn: number;
  statBreach: number;
  soundEnabled: boolean;
  confettiEnabled: boolean;
  loading: boolean;
  lastUpdated: string;
  pollCountdown: number;
  testMode: boolean;
  hasEnvToken: boolean;
  onTestNewPr: () => void;
  onTestMerged: () => void;
}>();

defineEmits<{
  refresh: [];
  toggleSound: [];
  openRepos: [];
  openSettings: [];
  logout: [];
}>();

const { isFullscreen, isSupported, toggle: toggleFullscreen } = useFullscreen();
</script>

<template>
  <header
    class="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 backdrop-blur-md px-5"
  >
    <!-- Left: brand + stat pills -->
    <div class="flex items-center gap-4">
      <div
        class="flex items-center gap-2 font-mono text-base font-semibold text-foreground"
      >
        <Zap class="h-4 w-4 text-primary" />
        Pulldog
      </div>
      <div class="hidden sm:flex items-center gap-1.5">
        <Badge variant="default">{{ statOpen }} open</Badge>
        <Badge variant="success">{{ statApproved }} approved</Badge>

        <Badge variant="warning" v-if="statWarn > 0">
          ⚠ {{ statWarn }} warn
        </Badge>
        <Badge
          variant="destructive"
          v-if="statBreach > 0"
          class="animate-breach-pulse"
        >
          🔴 {{ statBreach }} breach
        </Badge>
      </div>
    </div>

    <!-- Right: actions -->
    <div class="flex items-center gap-2">
      <span
        v-if="lastUpdated"
        class="hidden lg:block font-mono text-xs text-muted-foreground"
      >
        {{ lastUpdated }}
      </span>

      <Button
        variant="outline"
        size="sm"
        :class="loading ? 'opacity-60' : ''"
        @click="$emit('refresh')"
      >
        <RefreshCw class="h-3.5 w-3.5" :class="loading ? 'animate-spin' : ''" />
        Refresh ({{ pollCountdown }}s)
      </Button>

      <Button
        variant="outline"
        size="sm"
        :class="
          soundEnabled
            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5'
            : ''
        "
        @click="$emit('toggleSound')"
      >
        <Volume2 v-if="soundEnabled" class="h-3.5 w-3.5" />
        <VolumeX v-else class="h-3.5 w-3.5" />
        {{ soundEnabled ? "Sound on" : "Sound off" }}
      </Button>

      <ThemeToggle />

      <!-- Fullscreen toggle — only shown if the Fullscreen API is available -->
      <Tooltip
        v-if="isSupported"
        :text="
          isFullscreen
            ? 'Exit fullscreen (Esc)'
            : 'Enter fullscreen / kiosk mode'
        "
        side="bottom"
      >
        <Button variant="ghost" size="icon" @click="toggleFullscreen">
          <Minimize2 v-if="isFullscreen" class="h-4 w-4" />
          <Maximize2 v-else class="h-4 w-4" />
        </Button>
      </Tooltip>

      <Tooltip text="Repositories" side="bottom">
        <Button variant="ghost" size="icon" @click="$emit('openRepos')">
          <GitBranch class="h-4 w-4" />
        </Button>
      </Tooltip>

      <Tooltip text="Settings" side="bottom">
        <Button variant="ghost" size="icon" @click="$emit('openSettings')">
          <Settings class="h-4 w-4" />
        </Button>
      </Tooltip>

      <Tooltip v-if="!hasEnvToken" text="Disconnect" side="bottom">
        <Button
          variant="ghost"
          size="icon"
          class="text-muted-foreground hover:text-destructive"
          @click="$emit('logout')"
        >
          <Power class="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  </header>

  <!-- Test buttons (shown only in test mode) -->
  <div
    v-if="testMode"
    class="flex items-center gap-1.5 border-b border-border bg-card px-5 py-2"
  >
    <span class="font-mono text-[10px] text-muted-foreground/40 mr-0.5">
      test:
    </span>
    <Button
      variant="outline"
      size="sm"
      class="h-6 px-2 font-mono text-[10px]"
      :disabled="!soundEnabled"
      @click="onTestNewPr()"
    >
      🔔 new PR
    </Button>
    <Button
      variant="outline"
      size="sm"
      class="h-6 px-2 font-mono text-[10px]"
      :disabled="!soundEnabled && !confettiEnabled"
      @click="onTestMerged()"
    >
      🎉 merge
    </Button>
  </div>
</template>
