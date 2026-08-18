import type {StackLevel} from "../types/database";

export function formatDimensions(lengthM: number, widthM: number) {
  const length = Number(lengthM).toString().replace(/\.0$/, "");
  const width = Number(widthM).toString().replace(/\.0$/, "");
  return `${length} × ${width} m`;
}

export function formatCodeNumber(code: string) {
  const numeric = Number(code);
  return Number.isFinite(numeric) ? String(numeric) : code;
}

/** Permanent P-row identifier from the Schelle plan, e.g. P2. */
export function formatRowCode(code: string) {
  const trimmed = code.trim().toUpperCase();
  const prefixed = trimmed.match(/^P(\d+)$/);
  if (prefixed) {
    return `P${Number(prefixed[1])}`;
  }
  if (/^\d+$/.test(trimmed)) {
    return `P${Number(trimmed)}`;
  }
  return trimmed;
}

export function formatPositionCode(code: string) {
  return formatCodeNumber(code);
}

export function formatLevelCode(level: StackLevel, locale?: string) {
  void locale;
  if (level === "LEVEL_1") {
    return "1";
  }
  if (level === "LEVEL_2") {
    return "2";
  }
  return "0";
}

export function formatLevelLabel(level: StackLevel, locale?: string) {
  return `Niveau ${formatLevelCode(level, locale)}`;
}

export function formatYardLocation(parts: {
  blockCode: string;
  rowCode: string;
  positionCode: string;
  level: StackLevel;
  locale: string;
}) {
  const level = formatLevelLabel(parts.level, parts.locale);
  return `${parts.blockCode} · ${formatRowCode(parts.rowCode)} · ${formatPositionCode(parts.positionCode)} · ${level}`;
}

export function formatCompactLocation(parts: {
  blockCode: string;
  rowCode: string;
  positionCode: string;
  level: StackLevel;
  locale: string;
}) {
  const level = formatLevelLabel(parts.level, parts.locale);
  return `${parts.blockCode} / ${formatRowCode(parts.rowCode)} / ${formatPositionCode(parts.positionCode)} / ${level}`;
}

export function formatDateTime(value: string | null, locale: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-BE" : "nl-BE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string | null, locale: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-BE" : "nl-BE", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatTypeLabel(typeNumber: string | null | undefined, typeCode: string) {
  return typeNumber?.trim() || typeCode;
}
