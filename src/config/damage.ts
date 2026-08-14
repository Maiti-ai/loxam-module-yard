/**
 * Future damage workflow — architecture only, no UI in Phase 2.
 *
 * Intended flow:
 * 1. Forklift driver scans a module after unloading from a truck.
 * 2. Creates a damage_reports row (DRAFT → SUBMITTED).
 * 3. Attaches module_photos (category DAMAGE) via damage_report_photos.
 * 4. Later: email the person responsible for damage management.
 *
 * Tables already exist: public.damage_reports, public.damage_report_photos.
 * Do not send email from this codebase until that requirement is implemented.
 */
export const DAMAGE_REPORT_STATUSES = ["DRAFT", "SUBMITTED"] as const;

export type DamageReportStatus = (typeof DAMAGE_REPORT_STATUSES)[number];
