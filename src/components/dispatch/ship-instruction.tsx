"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {shipDispatchModuleAction} from "@/features/dispatch/actions";
import type {DispatchAssignment} from "@/features/dispatch/types";
import {formatGroundPositionLabel, formatLevelLabel} from "@/lib/format";
import type {ModuleSummary} from "@/features/yard-locations/types";

export function ShipInstruction({
  module,
  assignment,
}: {
  module: ModuleSummary;
  assignment: DispatchAssignment;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{shippedCount: number; totalModules: number} | null>(null);

  const target = formatGroundPositionLabel({
    blockCode: assignment.blockCode,
    rowCode: assignment.rowCode,
    positionCode: assignment.positionCode,
  });

  async function ship() {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await shipDispatchModuleAction(module.id);
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.code}`));
      return;
    }
    setDone({shippedCount: result.shippedCount, totalModules: result.totalModules});
  }

  if (done) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-bold tracking-[0.22em] text-loxam-free uppercase">OK</p>
        <h1 className="text-4xl font-black uppercase">
          {t("module.label")} {module.moduleNumber} {t("dispatch.shippedOk")}
        </h1>
        <p className="text-3xl font-black">{t("dispatch.lifecycle.shipped")}</p>
        <p className="text-2xl font-black">
          {t("dispatch.shipProgress", {shipped: done.shippedCount, total: done.totalModules})}
        </p>
        <TouchButton onClick={() => router.push(`/modules/${module.moduleNumber}`)}>
          {t("common.open")}
        </TouchButton>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-black">
          {t("dispatch.shipConfirm", {
            module: module.moduleNumber,
            dossier: assignment.dossierNumber,
            customer: assignment.customerName,
            site: assignment.siteLocation,
          })}
        </h1>
        {error ? (
          <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4 font-bold">{error}</p>
        ) : null}
        <TouchButton disabled={pending} onClick={() => void ship()}>
          {pending ? t("dispatch.shipping") : t("dispatch.confirmShip")}
        </TouchButton>
        <TouchButton variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
          {t("common.cancel")}
        </TouchButton>
      </div>
    );
  }

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
          {t("module.status")}
        </p>
        <p className="mt-3 text-4xl font-black uppercase">{t("dispatch.lifecycle.readyToShip")}</p>
        <p className="mt-4 text-2xl font-black">
          {target} · {formatLevelLabel(assignment.level)}
        </p>
      </div>
      {error ? (
        <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4 font-bold">{error}</p>
      ) : null}
      <TouchButton onClick={() => setConfirming(true)}>{t("dispatch.ship")}</TouchButton>
      <Link
        href={`/modules/${module.moduleNumber}`}
        className="block text-center text-sm font-black uppercase text-loxam-muted"
      >
        {t("common.cancel")}
      </Link>
    </div>
  );
}
