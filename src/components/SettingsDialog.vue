<script setup lang="ts">
import { ref, watch } from "vue";
import Dialog from "@/components/ui/Dialog.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Textarea from "@/components/ui/Textarea.vue";
import Label from "@/components/ui/Label.vue";

const props = defineProps<{
  open: boolean;
  currentRepos: string;
  hasEnvToken: boolean;
  currentToken: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [repos: string, token?: string];
}>();

const repos = ref(props.currentRepos);
const token = ref(props.currentToken);

watch(
  () => props.open,
  (open) => {
    if (open) {
      repos.value = props.currentRepos;
      token.value = props.currentToken;
    }
  },
);

function handleSave(): void {
  emit("save", repos.value, props.hasEnvToken ? undefined : token.value);
}
</script>

<template>
  <Dialog :open="open" @close="$emit('close')">
    <div class="space-y-5">
      <h2 class="font-mono text-sm font-semibold text-foreground">Settings</h2>

      <!-- Token (only when not sourced from .env) -->
      <div v-if="!hasEnvToken" class="space-y-1.5">
        <Label>GitHub Token</Label>
        <Input
          v-model="token"
          type="password"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        />
        <p class="font-mono text-[10.5px] text-muted-foreground">
          Saved to localStorage — never sent to any server.
        </p>
      </div>

      <div class="space-y-1.5">
        <Label>Repositories</Label>
        <Textarea
          v-model="repos"
          class="min-h-[110px]"
          placeholder="owner/repo&#10;owner/another-repo"
        />
        <p class="font-mono text-[10.5px] text-muted-foreground">
          Saved to localStorage automatically.
        </p>
      </div>

      <div class="flex gap-2 pt-1">
        <Button variant="outline" class="flex-1" @click="$emit('close')"
          >Cancel</Button
        >
        <Button class="flex-1" @click="handleSave">Save &amp; Reload</Button>
      </div>
    </div>
  </Dialog>
</template>
