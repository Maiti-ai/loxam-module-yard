"use client";

import {useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {cancelDispatchDossierAction} from "@/features/dispatch/actions";
import type {DispatchDossierDetail} from "@/features/dispatch/types";
import {formatDateTime, formatGroundPositionLabel, formatLevelLabel} from "@/lib/format";

export function DossierProductionOverview({
  dossier,
  canCancel,
}: {
  dossier: DispatchDossierDetail;
  canCancel: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          const lifecycleKey =
            slot.status === "SHIPPED"
              ? "shipped"
              : slot.status === "RETURNED"
                ? "returned"
                : slot.status === "PLACED"
                  ? "readyToShip"
                  : null;
          const statusLabel = lifecycleKey
            ? t(`dispatch.lifecycle.${lifecycleKey}`)
            : t(`dispatch.productionStatus.${slot.productionStatus ?? "TO_PRODUCTION"}`);
          const returnLabel =
            slot.returnBlockCode && slot.returnRowCode && slot.returnPositionCode
              ? `${formatGroundPositionLabel({
                  blockCode: slot.returnBlockCode,
                  rowCode: slot.returnRowCode,
                  positionCode: slot.returnPositionCode,
                })}${slot.returnLevel ? ` · ${formatLevelLabel(slot.returnLevel)}` : ""}`
              : null;
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
              <p className="mt-2 text-lg font-black">{statusLabel}</p>
              {slot.shippedAt ? (
                <p className="mt-1 text-sm font-bold text-loxam-muted">
                  {t("dispatch.shippedAt")}: {formatDateTime(slot.shippedAt, locale)}
                </p>
              ) : null}
              {slot.returnedAt ? (
                <p className="mt-1 text-sm font-bold text-loxam-muted">
                  {t("dispatch.returnedAt")}: {formatDateTime(slot.returnedAt, locale)}
                </p>
              ) : null}
              {returnLabel ? (
                <p className="mt-1 text-sm font-bold text-loxam-muted">
                  {t("dispatch.returnLocation")}: {returnLabel}
                </p>
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
