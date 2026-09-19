"use client";

import {useTranslations} from "next-intl";
import {MoveWizard} from "@/components/move/move-wizard";
import {findBlockByCode} from "@/features/dispatch/availability";
import {PRODUCTION_BLOCK_CODE} from "@/config/yard";
import type {DispatchAssignment} from "@/features/dispatch/types";
import type {ModuleSummary, YardSnapshot} from "@/features/yard-locations/types";

export function ToProductionMove({
  module,
  snapshot,
  assignment,
}: {
  module: ModuleSummary;
  snapshot: YardSnapshot;
  assignment: DispatchAssignment;
}) {
  const t = useTranslations();
  const blockF = findBlockByCode(snapshot, PRODUCTION_BLOCK_CODE);

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
        {t("dispatch.dossier")} {assignment.dossierNumber}
      </p>
      <h1 className="text-4xl font-black">
        {t("module.label")} {module.moduleNumber}
      </h1>
      <div className="border-4 border-loxam-black bg-white p-5">
        <p className="text-sm font-bold uppercase text-loxam-muted">{t("dispatch.customer")}</p>
        <p className="text-2xl font-black">{assignment.customerName}</p>
        <p className="mt-4 text-sm font-bold uppercase text-loxam-muted">{t("dispatch.site")}</p>
        <p className="text-2xl font-black">{assignment.siteLocation}</p>
      </div>
      <div className="border-4 border-loxam-red bg-white p-6 text-center">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-loxam-muted">
          {t("dispatch.destination")}
        </p>
        <p className="mt-3 text-5xl font-black tracking-tight">{t("dispatch.toProductionF")}</p>
      </div>
      {blockF ? (
        <MoveWizard
          module={module}
          snapshot={snapshot}
          lockBlockId={blockF.id}
          allowedBlockCodes={[PRODUCTION_BLOCK_CODE]}
        />
      ) : (
        <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4 font-bold">
          {t("errors.SLOT_MISSING")}
        </p>
      )}
    </div>
  );
}
