"use client";

import {useTranslations} from "next-intl";

export function YardLegend() {
  const t = useTranslations();

  return (
    <div className="flex flex-wrap gap-4 border border-loxam-line bg-white px-4 py-3 text-sm font-bold">
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 bg-loxam-free" />
        {t("common.free")}
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 bg-loxam-occupied" />
        {t("common.occupied")}
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 bg-loxam-rented" />
        {t("status.RENTED")}
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-6 bg-loxam-occupied" />
        6×3
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-3 bg-loxam-occupied" />
        3×3
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 bg-loxam-rented" />
        {t("move.productionZone")}
      </span>
    </div>
  );
}
