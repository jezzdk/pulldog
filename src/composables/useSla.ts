import { ref } from "vue";
import type { SlaStatus } from "@/types";

export const SLA_WARNING_KEY = "pulldog-sla-warning-hours";
export const SLA_BREACH_KEY = "pulldog-sla-breach-hours";

const ENV_WARNING_HOURS = Number(import.meta.env.VITE_SLA_WARNING_HOURS ?? 24);
const ENV_BREACH_HOURS = Number(import.meta.env.VITE_SLA_BREACH_HOURS ?? 72);

export const slaWarningHours = ref(
  Number(localStorage.getItem(SLA_WARNING_KEY) ?? ENV_WARNING_HOURS),
);
export const slaBreachHours = ref(
  Number(localStorage.getItem(SLA_BREACH_KEY) ?? ENV_BREACH_HOURS),
);

export const SLA = {
  get warningHours() {
    return slaWarningHours.value;
  },
  get breachHours() {
    return slaBreachHours.value;
  },
};

export function slaStatus(createdAt: Date): SlaStatus {
  const hours = (Date.now() - createdAt.getTime()) / 3_600_000;

  if (hours >= slaBreachHours.value) {
    return "breach";
  }

  if (hours >= slaWarningHours.value) {
    return "warning";
  }

  return "ok";
}
