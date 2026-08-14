import type {StackLevel} from "@/types/database";

export function formatDimensions(lengthM: number, widthM: number) {
  const length = Number(lengthM).toString().replace(/\.0$/, "");
  const width = Number(widthM).toString().replace(/\.0$/, "");
  return `${length} × ${width} m`;
}

export function formatCodeNumber(code: string) {
  const numeric = Number(code);
  return Number.isFinite(numeric) ? String(numeric) : code;
}

export function formatLevelCode(level: StackLevel, locale: string) {
  if (level === "GROUND") {
    return locale === "fr" ? "RDC" : "GV";
  }
  if (level === "LEVEL_1") {
    return "1";
  }
  return "2";
}

export function formatLevelLabel(level: StackLevel, locale: string) {
  if (level === "GROUND") {
    return locale === "fr" ? "RDC" : "GV";
  }
  return locale === "fr" ? `Niveau ${formatLevelCode(level, locale)}` : `Level ${formatLevelCode(level, locale)}`;
}

export function formatYardLocation(parts: {
  blockCode: string;
  rowCode: string;
  positionCode: string;
  level: StackLevel;
  locale: string;
}) {
  const level = formatLevelCode(parts.level, parts.locale);
  return `${parts.blockCode} · ${formatCodeNumber(parts.rowCode)} · ${formatCodeNumber(parts.positionCode)} · ${level}`;
}

export function formatCompactLocation(parts: {
  blockCode: string;
  rowCode: string;
  positionCode: string;
  level: StackLevel;
  locale: string;
}) {
  const level = formatLevelLabel(parts.level, parts.locale);
  return `${parts.blockCode} / R${formatCodeNumber(parts.rowCode)} / P${formatCodeNumber(parts.positionCode)} / ${level}`;
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
