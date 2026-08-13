import {AIRCO_MAINTENANCE} from "@/config/airco";

export type MaintenanceState = "OK" | "DUE_SOON" | "OVERDUE" | "UNKNOWN";

export function getMaintenanceState(lastMaintenanceAt: string | null): MaintenanceState {
  if (AIRCO_MAINTENANCE.intervalDays == null || !lastMaintenanceAt) {
    return "UNKNOWN";
  }

  const last = new Date(lastMaintenanceAt);
  if (Number.isNaN(last.getTime())) {
    return "UNKNOWN";
  }

  const due = new Date(last);
  due.setDate(due.getDate() + AIRCO_MAINTENANCE.intervalDays);
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

export function getNextMaintenanceDate(lastMaintenanceAt: string | null) {
  if (AIRCO_MAINTENANCE.intervalDays == null || !lastMaintenanceAt) {
    return null;
  }

  const last = new Date(lastMaintenanceAt);
  if (Number.isNaN(last.getTime())) {
    return null;
  }

  last.setDate(last.getDate() + AIRCO_MAINTENANCE.intervalDays);
  return last.toISOString().slice(0, 10);
}
