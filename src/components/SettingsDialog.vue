<script setup lang="ts">
import { ref, watch, computed } from "vue";
import Dialog from "@/components/ui/Dialog.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import { RefreshCw } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  hasEnvToken: boolean;
  currentToken: string;
  currentTitleFilter: string;
  fetchRepos: (token?: string) => Promise<string[]>;
}>();

const emit = defineEmits<{
  close: [];
  save: [token?: string, titleFilter?: string];
}>();

const tokenInput = ref(props.currentToken);
const titleFilterInput = ref(props.currentTitleFilter);

watch(
  () => props.open,
  (open) => {
    if (open) {
      tokenInput.value = props.currentToken;
      titleFilterInput.value = props.currentTitleFilter;
    }
  },
);

const titleFilterValid = computed(() => {
  if (!titleFilterInput.value) {
    return true;
  }

  try {
    new RegExp(titleFilterInput.value);
    return true;
  } catch {
    return false;
  }
});

function handleSave(): void {
  emit(
    "save",
    props.hasEnvToken ? undefined : tokenInput.value.trim(),
    titleFilterInput.value,
  );
}
</script>

<template>
  <Dialog :open="open" @close="$emit('close')">
    <div class="space-y-4">
      <h2 class="font-mono text-sm font-semibold text-foreground">Settings</h2>

      <!-- Token (only when not sourced from .env) -->
      <div v-if="!hasEnvToken" class="space-y-1.5">
        <Label>GitHub Token</Label>
        <div class="flex gap-2">
          <Input
            v-model="tokenInput"
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            class="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            @click="fetchRepos(tokenInput.trim())"
          >
            <RefreshCw class="h-3 w-3" />
          </Button>
        </div>
        <p class="font-mono text-[10.5px] text-muted-foreground">
          Saved to localStorage — never sent to any server.
        </p>
      </div>

      <!-- PR Title Filter -->
      <div class="space-y-1.5">
        <Label>PR Title Filter</Label>
        <Input
          v-model="titleFilterInput"
          type="text"
          placeholder="e.g. ^WIP|dependabot"
          :class="!titleFilterValid ? 'border-destructive' : ''"
        />
        <p
          v-if="!titleFilterValid"
          class="font-mono text-[10.5px] text-destructive"
        >
          Invalid regular expression.
        </p>
        <p v-else class="font-mono text-[10.5px] text-muted-foreground">
          Regex — PRs with matching titles are hidden from the table and stats.
        </p>
      </div>

      <div class="flex gap-2 pt-1">
        <Button variant="outline" class="flex-1" @click="$emit('close')">
          Cancel
        </Button>
        <Button
          class="flex-1"
          :disabled="!titleFilterValid"
          @click="handleSave"
        >
          Save
        </Button>
      </div>
    </div>
  </Dialog>
</template>
