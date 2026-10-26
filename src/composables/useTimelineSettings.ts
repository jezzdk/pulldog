import { ref } from "vue";

export interface TimelineSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export function useTimelineSettings() {
  const settings = ref<TimelineSettings>({
    enabled: localStorage.getItem("pulldog-timeline-open") !== "false",
    startTime: localStorage.getItem("pulldog-timeline-start") ?? "06:00",
    endTime: localStorage.getItem("pulldog-timeline-end") ?? "18:00",
  });

  function save(value: TimelineSettings): void {
    settings.value = { ...value };
    localStorage.setItem("pulldog-timeline-open", String(value.enabled));
    localStorage.setItem("pulldog-timeline-start", value.startTime);
    localStorage.setItem("pulldog-timeline-end", value.endTime);
  }

  return { settings, save };
}
