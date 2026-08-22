"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {cancelDispatchDossierAction, markDispatchProductionReadyAction} from "@/features/dispatch/actions";
import type {DispatchDossierDetail} from "@/features/dispatch/types";
import {formatGroundPositionLabel, formatLevelLabel} from "@/lib/format";

export function DossierProductionOverview({
  dossier,
  canMarkReady,
  canCancel,
}: {
  dossier: DispatchDossierDetail;
  canMarkReady: boolean;
  canCancel: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markReady(moduleId: string) {
    if (pendingId) {
      return;
    }
    setPendingId(moduleId);
    setError(null);
    const result = await markDispatchProductionReadyAction(moduleId);
    setPendingId(null);
    if (!result.ok) {
      setError(t(`errors.${result.code}`));
      return;
    }
    router.refresh();
  }

  async function cancel() {
    if (pendingId) {
      return;
    }
    setPendingId("cancel");
    setError(null);
    const result = await cancelDispatchDossierAction(dossier.id);
    setPendingId(null);
    if (!result.ok) {
      setError(t(`errors.${result.code}`));
      return;
    }
    router.push("/dossiers");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4 font-bold">{error}</p>
      ) : null}
      <ol className="space-y-3">
        {dossier.slots.map((slot) => {
          const statusKey = slot.productionStatus ?? "TO_PRODUCTION";
          return (
            <li key={slot.id} className="border-4 border-loxam-black bg-white p-4">
              <p className="text-2xl font-black">
                {slot.sequenceNumber}. {t("module.label")} {slot.moduleNumber ?? "—"}
              </p>
              <p className="mt-1 text-sm font-bold text-loxam-muted">
                {slot.positionId
                  ? `${formatGroundPositionLabel({
                      blockCode: slot.blockCode,
                      rowCode: slot.rowCode,
                      positionCode: slot.positionCode,
                    })} · ${formatLevelLabel(slot.level)}`
                  : t("dispatch.unassigned")}
              </p>
              <p className="mt-2 text-lg font-black">{t(`dispatch.productionStatus.${statusKey}`)}</p>
              {canMarkReady && slot.moduleId && slot.productionStatus === "IN_PRODUCTION" ? (
                <TouchButton
                  className="mt-3"
                  disabled={pendingId !== null}
                  onClick={() => void markReady(slot.moduleId as string)}
                >
                  {pendingId === slot.moduleId ? t("dispatch.markingReady") : t("dispatch.markReady")}
                </TouchButton>
              ) : null}
            </li>
          );
        })}
      </ol>
      {canCancel && (dossier.status === "DRAFT" || dossier.status === "ACTIVE") ? (
        <TouchButton variant="danger" disabled={pendingId !== null} onClick={() => void cancel()}>
          {t("dispatch.cancelDossier")}
        </TouchButton>
      ) : null}
    </div>
  );
}
