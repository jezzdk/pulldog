// composables/useSla.ts
import type { SlaStatus } from "@/types";

const WARNING_HOURS = Number(import.meta.env.VITE_SLA_WARNING_HOURS ?? 24);
const BREACH_HOURS = Number(import.meta.env.VITE_SLA_BREACH_HOURS ?? 72);

export const SLA = {
  warningHours: WARNING_HOURS,
  breachHours: BREACH_HOURS,
} as const;

/** Returns 'breach' | 'warning' | 'ok' for a given PR creation date. */
export function slaStatus(createdAt: Date): SlaStatus {
  const hours = (Date.now() - createdAt.getTime()) / 3_600_000;
  if (hours >= BREACH_HOURS) return "breach";
  if (hours >= WARNING_HOURS) return "warning";
  return "ok";
}

/** CSS class object for Tailwind binding. */
export function slaRowClass(createdAt: Date): Record<string, boolean> {
  const s = slaStatus(createdAt);
  return {
    "row-sla-breach": s === "breach",
    "row-sla-warning": s === "warning",
  };
}
