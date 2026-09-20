const TYPE_CODE_PATTERN = /^[0-9A-Za-z._-]+$/;

export function normalizeTypeCode(typeCode: string | null | undefined): string | null {
  const code = typeCode?.trim() ?? "";
  return code.length > 0 ? code : null;
}

/** type_code = 60146 → /module-types/60146.png */
export function moduleTypeDrawingUrl(typeCode: string | null | undefined): string | null {
  const code = normalizeTypeCode(typeCode);
  if (!code || !TYPE_CODE_PATTERN.test(code)) {
    return null;
  }
  return `/module-types/${code}.png`;
}
