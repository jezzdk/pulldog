<script setup lang="ts">
import { ref, watch } from "vue";
import Dialog from "@/components/ui/Dialog.vue";
import Button from "@/components/ui/Button.vue";
import Textarea from "@/components/ui/Textarea.vue";
import Label from "@/components/ui/Label.vue";

const props = defineProps<{
  open: boolean;
  currentRepos: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [repos: string];
}>();

const repos = ref(props.currentRepos);

watch(
  () => props.open,
  (open) => {
    if (open) repos.value = props.currentRepos;
  },
);

function handleSave(): void {
  emit("save", repos.value);
}
</script>

<template>
  <Dialog :open="open" @close="$emit('close')">
    <div class="space-y-5">
      <h2 class="font-mono text-sm font-semibold text-foreground">Settings</h2>

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
