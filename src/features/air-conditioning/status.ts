import {AIRCO_MAINTENANCE, AIRCO_SETTING_KEY} from "@/config/airco";

export type MaintenanceState = "OK" | "DUE_SOON" | "OVERDUE" | "UNKNOWN";

export function parseIntervalMonths(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function getMaintenanceState(
  lastMaintenanceAt: string | null,
  intervalMonths: number | null = AIRCO_MAINTENANCE.intervalMonths,
): MaintenanceState {
  if (intervalMonths == null || !lastMaintenanceAt) {
    return "UNKNOWN";
  }

  const last = new Date(lastMaintenanceAt);
  if (Number.isNaN(last.getTime())) {
    return "UNKNOWN";
  }

  const due = new Date(last);
  due.setMonth(due.getMonth() + intervalMonths);
  const now = new Date();
  if (now.getTime() > due.getTime()) {
    return "OVERDUE";
  }

  const dueSoonFrom = new Date(due);
  dueSoonFrom.setDate(dueSoonFrom.getDate() - AIRCO_MAINTENANCE.dueSoonDays);
  if (now.getTime() >= dueSoonFrom.getTime()) {
    return "DUE_SOON";
  }

  return "OK";
}

export function getNextMaintenanceDate(
  lastMaintenanceAt: string | null,
  intervalMonths: number | null = AIRCO_MAINTENANCE.intervalMonths,
) {
  if (intervalMonths == null || !lastMaintenanceAt) {
    return null;
  }

  const last = new Date(lastMaintenanceAt);
  if (Number.isNaN(last.getTime())) {
    return null;
  }

  last.setMonth(last.getMonth() + intervalMonths);
  return last.toISOString().slice(0, 10);
}

export function remainingMaintenanceLabel(
  lastMaintenanceAt: string | null,
  intervalMonths: number | null,
  locale: string,
) {
  const next = getNextMaintenanceDate(lastMaintenanceAt, intervalMonths);
  if (!next) {
    return null;
  }
  const due = new Date(next);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return locale === "fr" ? `${overdue} j de retard` : `${overdue} d te laat`;
  }
  return locale === "fr" ? `${diffDays} j restants` : `${diffDays} d resterend`;
}

export {AIRCO_SETTING_KEY};
