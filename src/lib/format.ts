import type {StackLevel} from "@/types/database";

export function formatDimensions(lengthM: number, widthM: number) {
  const length = Number(lengthM).toString().replace(/\.0$/, "");
  const width = Number(widthM).toString().replace(/\.0$/, "");
  return `${length} × ${width} m`;
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

export function formatYardLocation(parts: {
  blockCode: string;
  rowCode: string;
  positionCode: string;
  level: StackLevel;
  locale: string;
}) {
  const level = formatLevelCode(parts.level, parts.locale);
  return `${parts.blockCode} · ${parts.rowCode} · ${parts.positionCode} · ${level}`;
}

export function formatDateTime(value: string | null, locale: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-BE" : "nl-BE", {
    dateStyle: "short",
    timeStyle: "short",
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
