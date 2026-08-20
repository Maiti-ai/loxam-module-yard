"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {confirmDispatchPlacementAction} from "@/features/dispatch/actions";
import type {DispatchAssignment} from "@/features/dispatch/types";
import {formatGroundPositionLabel, formatLevelLabel} from "@/lib/format";
import type {ModuleSummary} from "@/features/yard-locations/types";

export function PlacementInstruction({
  module,
  assignment,
}: {
  module: ModuleSummary;
  assignment: DispatchAssignment;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{placedCount: number; totalModules: number; ready: boolean} | null>(
    null,
  );

  const target = formatGroundPositionLabel({
    blockCode: assignment.blockCode,
    rowCode: assignment.rowCode,
    positionCode: assignment.positionCode,
  });

  async function confirm() {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await confirmDispatchPlacementAction(module.id);
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.code}`));
      return;
    }
    setDone({
      placedCount: result.placedCount,
      totalModules: result.totalModules,
      ready: result.ready,
    });
  }

  if (done) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-bold tracking-[0.22em] text-loxam-free uppercase">OK</p>
        <h1 className="text-4xl font-black uppercase">
          {t("module.label")} {module.moduleNumber} {t("move.success")}
        </h1>
        <p className="text-3xl font-black">
          {target} · {formatLevelLabel(assignment.level)}
        </p>
        <p className="text-2xl font-black">
          {t("dispatch.progress", {placed: done.placedCount, total: done.totalModules})}
        </p>
        {done.ready ? (
          <p className="border-4 border-loxam-free bg-loxam-free-soft p-4 text-xl font-black">
            {t("dispatch.status.READY_FOR_SHIPPING")}
          </p>
        ) : null}
        <TouchButton onClick={() => router.push(`/modules/${module.moduleNumber}`)}>
          {t("common.open")}
        </TouchButton>
        <Link href="/dossiers" className="block text-center text-sm font-black uppercase">
          {t("nav.dossiers")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
        {t("dispatch.dossier")} {assignment.dossierNumber}
      </p>
      <h1 className="text-4xl font-black">
        {t("dispatch.moduleOf", {
          sequence: assignment.sequenceNumber,
          total: assignment.totalModules,
        })}
      </h1>
      <div className="border-4 border-loxam-black bg-white p-5">
        <p className="text-sm font-bold uppercase text-loxam-muted">{t("dispatch.customer")}</p>
        <p className="text-2xl font-black">{assignment.customerName}</p>
        <p className="mt-4 text-sm font-bold uppercase text-loxam-muted">{t("dispatch.site")}</p>
        <p className="text-2xl font-black">{assignment.siteLocation}</p>
      </div>
      <div className="border-4 border-loxam-red bg-white p-6 text-center">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-loxam-muted">
          {t("dispatch.placeOn")}
        </p>
        <p className="mt-3 text-6xl font-black tracking-tight">{assignment.blockCode}</p>
        <p className="mt-2 text-5xl font-black">{target}</p>
        <p className="mt-4 text-4xl font-black uppercase">{formatLevelLabel(assignment.level)}</p>
      </div>
      {error ? (
        <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4 font-bold">{error}</p>
      ) : null}
      <TouchButton disabled={pending} onClick={() => void confirm()}>
        {pending ? t("dispatch.confirming") : t("dispatch.confirmPlaced")}
      </TouchButton>
      <Link
        href={`/modules/${module.moduleNumber}`}
        className="block text-center text-sm font-black uppercase text-loxam-muted"
      >
        {t("common.cancel")}
      </Link>
    </div>
  );
}
