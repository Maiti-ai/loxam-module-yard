"use client";

import {useTranslations} from "next-intl";
import {formatTypeLabel} from "@/lib/format";

export function TechnicalDrawing({
  typeCode,
  typeNumber,
  drawingUrl,
  drawingMimeType,
}: {
  typeCode: string;
  typeNumber?: string | null;
  drawingUrl?: string | null;
  drawingMimeType?: string | null;
}) {
  const t = useTranslations("module");
  const label = formatTypeLabel(typeNumber, typeCode);

  return (
    <details className="border border-loxam-line bg-white p-4">
      <summary className="cursor-pointer text-lg font-black">
        {t("drawing")} · {label}
      </summary>
      {drawingUrl ? (
        drawingMimeType === "application/pdf" ? (
          <a
            href={drawingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex min-h-16 items-center justify-center border-2 border-loxam-black text-sm font-black uppercase"
          >
            {t("drawingOpen")}
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={drawingUrl} alt={label} className="mt-4 w-full border border-loxam-line" />
        )
      ) : (
        <>
          <p className="mt-3 text-sm text-loxam-muted">{t("drawingNote")}</p>
          <div className="mt-4 flex min-h-40 items-center justify-center border border-dashed border-loxam-line bg-loxam-paper text-sm font-bold text-loxam-muted">
            {t("drawingOpen")}
          </div>
        </>
      )}
    </details>
  );
}
