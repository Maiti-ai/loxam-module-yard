"use client";

import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import type {DispatchAssignment} from "@/features/dispatch/types";
import type {ModuleSummary} from "@/features/yard-locations/types";

export function ProductionHoldNotice({
  module,
  assignment,
}: {
  module: ModuleSummary;
  assignment: DispatchAssignment;
}) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
        {t("dispatch.dossier")} {assignment.dossierNumber}
      </p>
      <h1 className="text-4xl font-black">
        {t("module.label")} {module.moduleNumber}
      </h1>
      <div className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-6 text-center">
        <p className="text-4xl font-black uppercase">{t("dispatch.stillInProduction")}</p>
        <p className="mt-4 text-lg font-bold">{t("dispatch.stillInProductionBody")}</p>
      </div>
      <Link
        href={`/modules/${module.moduleNumber}`}
        className="block text-center text-sm font-black uppercase"
      >
        {t("common.back")}
      </Link>
    </div>
  );
}
