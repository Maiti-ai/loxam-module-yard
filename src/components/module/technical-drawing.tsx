"use client";

import {useTranslations} from "next-intl";

export function TechnicalDrawingPlaceholder() {
  const t = useTranslations("module");

  return (
    <details className="border border-loxam-line bg-white p-4">
      <summary className="cursor-pointer text-lg font-black">{t("drawing")}</summary>
      <p className="mt-3 text-sm text-loxam-muted">{t("drawingNote")}</p>
      <div className="mt-4 flex min-h-40 items-center justify-center border border-dashed border-loxam-line bg-loxam-paper text-sm font-bold text-loxam-muted">
        {t("drawingOpen")}
      </div>
    </details>
  );
}
