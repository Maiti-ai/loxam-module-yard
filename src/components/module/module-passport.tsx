"use client";

import {useLocale, useTranslations} from "next-intl";
import {ModuleStatusBadge} from "@/components/module/module-status";
import {formatPositionCode, formatRowCode, formatDimensions, formatLevelLabel, formatTypeLabel} from "@/lib/format";
import type {ModuleSummary} from "@/features/yard-locations/types";

export function ModulePassport({
  module,
  emphasize = false,
}: {
  module: ModuleSummary;
  emphasize?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <article
      className={`border-4 bg-white p-5 ${
        emphasize ? "border-loxam-red" : "border-loxam-black"
      }`}
    >
      <header className="flex items-start justify-between gap-3 sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.22em] text-loxam-muted uppercase">
            {t("module.label")}
          </p>
          <h1 className="mt-1 text-5xl font-black tracking-tight">{module.moduleNumber}</h1>
        </div>
        <div className="max-w-[48%] text-right">
          <p className="text-xs font-bold leading-tight tracking-[0.22em] text-loxam-muted uppercase">
            {t("module.serialNumber")}
          </p>
          <p className="mt-1 text-xl font-black tracking-tight text-loxam-muted sm:text-2xl">
            —
          </p>
        </div>
      </header>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs font-bold uppercase text-loxam-muted">{t("module.type")}</dt>
          <dd className="mt-1 text-xl font-black">
            {formatTypeLabel(module.moduleTypeNumber, module.moduleTypeCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-loxam-muted">{t("module.dimensions")}</dt>
          <dd className="mt-1 text-xl font-black">{formatDimensions(module.lengthM, module.widthM)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-loxam-muted">{t("module.status")}</dt>
          <dd className="mt-2">
            <ModuleStatusBadge status={module.status} />
          </dd>
        </div>
        {module.rentedToProject ? (
          <div>
            <dt className="text-xs font-bold uppercase text-loxam-muted">{t("module.project")}</dt>
            <dd className="mt-1 text-lg font-black">{module.rentedToProject}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-6 border-t-4 border-loxam-black pt-5">
        {module.location ? (
          <div className="grid grid-cols-2 gap-3">
            <LocationCell label={t("move.block")} value={module.location.blockCode} />
            <LocationCell label={t("move.pLabel")} value={formatRowCode(module.location.rowCode)} />
            <LocationCell
              label={t("move.position")}
              value={formatPositionCode(module.location.positionCode)}
            />
            <LocationCell
              label={t("module.level")}
              value={formatLevelLabel(module.location.level, locale)}
            />
          </div>
        ) : (
          <p className="text-lg font-black text-loxam-muted">{t("module.noLocation")}</p>
        )}
      </div>
    </article>
  );
}

function LocationCell({label, value}: {label: string; value: string}) {
  return (
    <div className="border border-loxam-line bg-loxam-paper px-3 py-3">
      <p className="text-[11px] font-bold tracking-[0.16em] text-loxam-muted uppercase">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}
