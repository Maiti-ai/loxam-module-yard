/**
 * Maintenance interval is read from app_settings.AIRCO_MAINTENANCE_INTERVAL_MONTHS.
 * Keep null until Loxam provides a real interval — never invent a due date.
 */
export const AIRCO_SETTING_KEY = "AIRCO_MAINTENANCE_INTERVAL_MONTHS";

export const AIRCO_MAINTENANCE = {
  /** @deprecated use getAircoIntervalMonths() from app settings */
  intervalMonths: null as number | null,
  dueSoonDays: 30,
};
