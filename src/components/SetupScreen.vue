<script setup lang="ts">
import { ref } from "vue";
import Card from "@/components/ui/Card.vue";
import Button from "@/components/ui/Button.vue";
import Textarea from "@/components/ui/Textarea.vue";
import Label from "@/components/ui/Label.vue";
import { RefreshCw, Zap } from "lucide-vue-next";

const props = defineProps<{
  initialRepos: string;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  connect: [repos: string];
}>();

const hasToken = Boolean(import.meta.env.VITE_GITHUB_TOKEN);
const repos = ref(props.initialRepos);

function handleConnect(): void {
  emit("connect", repos.value);
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,hsl(217_89%_65%_/_0.07)_0%,transparent_70%)]"
  >
    <Card class="w-full max-w-[480px] p-10">
      <!-- Brand -->
      <div class="flex items-center gap-3 mb-9">
        <div
          class="h-9 w-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary"
        >
          <Zap class="h-4 w-4" />
        </div>
        <div>
          <div
            class="font-mono text-base font-semibold text-foreground tracking-tight"
          >
            Pulldog 🐕
          </div>
          <div class="text-[11px] text-muted-foreground mt-0.5">
            The faithful watchdog for your pull requests
          </div>
        </div>
      </div>

      <!-- Missing token error -->
      <div
        v-if="!hasToken"
        class="mb-5 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 font-mono text-[11px] text-destructive"
      >
        <code>VITE_GITHUB_TOKEN</code> is not set. Add it to your
        <code>.env</code> file and restart the dev server.
      </div>

      <div class="space-y-5">
        <!-- Repos -->
        <div class="space-y-1.5">
          <Label>Repositories</Label>
          <Textarea
            v-model="repos"
            placeholder="owner/repo&#10;owner/another-repo"
            class="min-h-[88px]"
            :disabled="!hasToken"
          />
          <p class="font-mono text-[10.5px] text-muted-foreground">
            One per line — format:
            <code class="text-foreground/70">owner/repo</code>.
            <span class="text-primary/80"
              >Saved automatically between sessions.</span
            >
          </p>
        </div>

        <!-- CTA -->
        <Button
          class="w-full mt-2"
          :disabled="loading || !hasToken"
          @click="handleConnect"
        >
          <RefreshCw v-if="loading" class="h-3 w-3 animate-spin" />
          <span>{{
            loading ? "Connecting…" : "Connect & Start Watching →"
          }}</span>
        </Button>

        <!-- Error -->
        <p
          v-if="error"
          class="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 font-mono text-[11px] text-destructive"
        >
          {{ error }}
        </p>
      </div>
    </Card>
  </div>
</template>
