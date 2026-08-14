"use client";

import {useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {TouchButton} from "@/components/ui/touch-button";
import {saveAircoAction} from "@/features/air-conditioning/actions";
import {getMaintenanceState, getNextMaintenanceDate} from "@/features/air-conditioning/status";
import {formatDate} from "@/lib/format";
import type {AircoSummary} from "@/features/yard-locations/types";

export function AircoCard({
  moduleId,
  airco,
  canManage,
  canMaintenance,
  intervalMonths = null,
}: {
  moduleId: string;
  airco: AircoSummary | null;
  canManage: boolean;
  canMaintenance: boolean;
  intervalMonths?: number | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState(airco?.brand ?? "");
  const [serialNumber, setSerialNumber] = useState(airco?.serialNumber ?? "");
  const [internalNumber, setInternalNumber] = useState(airco?.internalNumber ?? "");
  const [lastMaintenanceAt, setLastMaintenanceAt] = useState(airco?.lastMaintenanceAt ?? "");
  const [notes, setNotes] = useState(airco?.notes ?? "");

  const state = getMaintenanceState(airco?.lastMaintenanceAt ?? null, intervalMonths);
  const next = getNextMaintenanceDate(airco?.lastMaintenanceAt ?? null, intervalMonths);
  const stateLabel =
    state === "OK"
      ? t("airco.stateOk")
      : state === "DUE_SOON"
        ? t("airco.stateDueSoon")
        : state === "OVERDUE"
          ? t("airco.stateOverdue")
          : t("airco.stateUnknown");

  async function save() {
    setPending(true);
    setError(null);
    const result = await saveAircoAction({
      moduleId,
      aircoId: airco?.id,
      brand,
      serialNumber,
      internalNumber,
      lastMaintenanceAt: lastMaintenanceAt || null,
      notes: notes || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.code}`));
      return;
    }
    setEditing(false);
  }

  return (
    <section className="border border-loxam-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">{t("airco.title")}</h2>
        <span className="text-xs font-black uppercase text-loxam-muted">{stateLabel}</span>
      </div>
      {!airco && !editing ? (
        <p className="mt-3 text-sm text-loxam-muted">{t("airco.empty")}</p>
      ) : null}
      {airco && !editing ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs font-bold uppercase text-loxam-muted">{t("airco.brand")}</dt>
            <dd className="font-bold">{airco.brand}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-loxam-muted">{t("airco.internal")}</dt>
            <dd className="font-bold">{airco.internalNumber}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-bold uppercase text-loxam-muted">{t("airco.serial")}</dt>
            <dd className="font-bold">{airco.serialNumber}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-loxam-muted">{t("airco.last")}</dt>
            <dd className="font-bold">{formatDate(airco.lastMaintenanceAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-loxam-muted">{t("airco.next")}</dt>
            <dd className="font-bold">{next ? formatDate(next, locale) : t("airco.nextUnknown")}</dd>
          </div>
        </dl>
      ) : null}
      {editing ? (
        <div className="mt-4 space-y-3">
          {canManage ? (
            <>
              <input
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder={t("airco.brand")}
                className="min-h-14 w-full border-2 border-loxam-line px-3"
              />
              <input
                value={serialNumber}
                onChange={(event) => setSerialNumber(event.target.value)}
                placeholder={t("airco.serial")}
                className="min-h-14 w-full border-2 border-loxam-line px-3"
              />
              <input
                value={internalNumber}
                onChange={(event) => setInternalNumber(event.target.value)}
                placeholder={t("airco.internal")}
                className="min-h-14 w-full border-2 border-loxam-line px-3"
              />
            </>
          ) : null}
          <input
            type="date"
            value={lastMaintenanceAt ?? ""}
            onChange={(event) => setLastMaintenanceAt(event.target.value)}
            className="min-h-14 w-full border-2 border-loxam-line px-3"
          />
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 w-full border-2 border-loxam-line px-3 py-2"
          />
          <TouchButton disabled={pending} onClick={save}>
            {t("common.save")}
          </TouchButton>
        </div>
      ) : null}
      {(canManage || (canMaintenance && airco)) && !editing ? (
        <div className="mt-4">
          <TouchButton variant="secondary" onClick={() => setEditing(true)}>
            {airco ? t("airco.edit") : t("airco.add")}
          </TouchButton>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm font-bold text-loxam-occupied">{error}</p> : null}
    </section>
  );
}
