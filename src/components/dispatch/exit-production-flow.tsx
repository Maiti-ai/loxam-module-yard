"use client";

import {useMemo, useState} from "react";
import {useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {SchelleYardMap, displayBlocks} from "@/components/yard/schelle-yard-map";
import {
  assignModuleToDispatchDossierAction,
  createDispatchDossierAction,
} from "@/features/dispatch/actions";
import {
  countReservableAPositions,
  findBlockByCode,
  isSnapshotPositionReservable,
} from "@/features/dispatch/availability";
import {DISPATCH_BLOCK_CODE, requiredGroundPositions} from "@/features/dispatch/plan";
import type {DispatchAssignment, DispatchDossierSummary} from "@/features/dispatch/types";
import {hasLivePlacementSlots} from "@/features/yard-locations/physical-registry";
import {formatGroundPositionLabel} from "@/lib/format";
import type {ModuleSummary, YardPositionNode, YardSnapshot} from "@/features/yard-locations/types";
import {PlacementInstruction} from "./placement-instruction";

type Step = "choice" | "existing" | "form" | "pick" | "order";

type SelectedCell = {
  position: YardPositionNode;
  blockCode: string;
  rowCode: string;
};

export function ExitProductionFlow({
  module,
  snapshot,
  openDossiers,
}: {
  module: ModuleSummary;
  snapshot: YardSnapshot;
  openDossiers: DispatchDossierSummary[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState<Step>("choice");
  const [assignment, setAssignment] = useState<DispatchAssignment | null>(null);
  const [dossierNumber, setDossierNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [totalModules, setTotalModules] = useState("6");
  const [selected, setSelected] = useState<SelectedCell[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingMatch, setExistingMatch] = useState<DispatchDossierSummary | null>(null);

  const required = requiredGroundPositions(Number(totalModules));
  const available = countReservableAPositions(snapshot);
  const blockA = findBlockByCode(snapshot, DISPATCH_BLOCK_CODE);
  const selectedIds = selected.map((cell) => cell.position.id);

  const duplicateOpen = useMemo(() => {
    const wanted = dossierNumber.trim().toLowerCase();
    if (!wanted) {
      return null;
    }
    return openDossiers.find((dossier) => dossier.dossierNumber.trim().toLowerCase() === wanted) ?? null;
  }, [dossierNumber, openDossiers]);

  if (assignment) {
    return <PlacementInstruction module={module} assignment={assignment} />;
  }

  async function assignTo(dossierId: string) {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await assignModuleToDispatchDossierAction(dossierId, module.id);
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.code}`));
      router.refresh();
      return;
    }
    setAssignment(result.assignment);
  }

  async function createDossier() {
    if (pending || selected.length !== required) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await createDispatchDossierAction({
      dossierNumber,
      customerName,
      siteLocation,
      totalModules: Number(totalModules),
      positionIds: selected.map((cell) => cell.position.id),
      moduleId: module.id,
    });
    setPending(false);
    if (!result.ok) {
      if (result.code === "DOSSIER_EXISTS") {
        setExistingMatch(duplicateOpen);
      }
      setError(t(`errors.${result.code}`));
      router.refresh();
      return;
    }
    setAssignment(result.assignment);
  }

  function goToPick() {
    setError(null);
    setExistingMatch(null);
    const total = Number(totalModules);
    if (
      !dossierNumber.trim() ||
      !customerName.trim() ||
      !siteLocation.trim() ||
      !Number.isInteger(total) ||
      total < 1
    ) {
      setError(t("dispatch.fieldsRequired"));
      return;
    }
    const needed = requiredGroundPositions(total);
    if (available < needed) {
      setError(
        t("dispatch.insufficientSpace", {
          needed,
          available,
        }),
      );
      return;
    }
    setSelected([]);
    setStep("pick");
  }

  function togglePosition(blockCode: string, rowCode: string, position: YardPositionNode) {
    if (pending) {
      return;
    }
    if (blockCode.trim().toUpperCase() !== DISPATCH_BLOCK_CODE) {
      return;
    }
    if (!hasLivePlacementSlots(position) || !isSnapshotPositionReservable(blockCode, position)) {
      if (position.reservation) {
        setError(t("errors.POSITION_RESERVED"));
      } else {
        setError(t("dispatch.positionNotFree"));
      }
      return;
    }
    setError(null);
    const exists = selected.some((cell) => cell.position.id === position.id);
    if (exists) {
      setSelected((current) => current.filter((cell) => cell.position.id !== position.id));
      return;
    }
    if (selected.length >= required) {
      setError(t("dispatch.exactPositions", {count: required}));
      return;
    }
    setSelected((current) => [...current, {position, blockCode, rowCode}]);
  }

  function moveOrder(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= selected.length) {
      return;
    }
    setSelected((current) => {
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
        {t("module.label")} {module.moduleNumber}
      </p>
      <h1 className="text-4xl font-black">{t("dispatch.exitTitle")}</h1>
      <p className="text-lg font-bold text-loxam-muted">{t("dispatch.exitBody")}</p>

      {error ? (
        <div className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4">
          <p className="font-bold">{error}</p>
          {existingMatch ? (
            <TouchButton
              className="mt-4"
              onClick={() => void assignTo(existingMatch.id)}
              disabled={pending}
            >
              {t("dispatch.addToExistingNamed", {number: existingMatch.dossierNumber})}
            </TouchButton>
          ) : null}
        </div>
      ) : null}

      {step === "choice" ? (
        <div className="grid gap-4">
          <TouchButton onClick={() => setStep("existing")}>{t("dispatch.addExisting")}</TouchButton>
          <TouchButton variant="secondary" onClick={() => setStep("form")}>
            {t("dispatch.createNew")}
          </TouchButton>
        </div>
      ) : null}

      {step === "existing" ? (
        <div className="space-y-4">
          {openDossiers.length === 0 ? (
            <p className="border border-dashed border-loxam-line bg-white p-6 font-bold text-loxam-muted">
              {t("dispatch.noOpenDossiers")}
            </p>
          ) : (
            openDossiers.map((dossier) => (
              <button
                key={dossier.id}
                type="button"
                disabled={pending}
                onClick={() => void assignTo(dossier.id)}
                className="block w-full border-4 border-loxam-black bg-white p-5 text-left"
              >
                <p className="text-3xl font-black">{dossier.dossierNumber}</p>
                <p className="mt-2 text-xl font-black">{dossier.customerName}</p>
                <p className="text-lg font-bold text-loxam-muted">{dossier.siteLocation}</p>
                <p className="mt-3 text-lg font-black">
                  {t("dispatch.progress", {
                    placed: dossier.placedCount,
                    total: dossier.totalModules,
                  })}
                </p>
              </button>
            ))
          )}
        </div>
      ) : null}

      {step === "form" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            goToPick();
          }}
        >
          <Field
            label={t("dispatch.dossierNumber")}
            value={dossierNumber}
            onChange={setDossierNumber}
            placeholder="2026-4587"
          />
          <Field label={t("dispatch.customer")} value={customerName} onChange={setCustomerName} placeholder="PORR" />
          <Field
            label={t("dispatch.site")}
            value={siteLocation}
            onChange={setSiteLocation}
            placeholder="Peutie"
          />
          <label className="block">
            <span className="text-xs font-bold uppercase text-loxam-muted">{t("dispatch.totalModules")}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={totalModules}
              onChange={(event) => setTotalModules(event.target.value)}
              className="mt-2 min-h-16 w-full border-4 border-loxam-black bg-white px-4 text-2xl font-black"
            />
          </label>
          {required > 0 ? (
            <p className="border-4 border-loxam-black bg-white p-4 text-lg font-black">
              {t("dispatch.requiredPositions", {modules: Number(totalModules) || 0, count: required})}
            </p>
          ) : null}
          <TouchButton type="submit">{t("common.confirm")}</TouchButton>
        </form>
      ) : null}

      {step === "pick" && blockA ? (
        <div className="space-y-4">
          <p className="text-xl font-black">
            {t("dispatch.pickPositions", {count: required, selected: selected.length})}
          </p>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <SchelleYardMap
              snapshot={snapshot}
              selectedBlockId={blockA.id}
              highlightedPositionIds={selectedIds}
              allowedBlockCodes={[DISPATCH_BLOCK_CODE]}
              lockBlockId={blockA.id}
              onSelectBlock={() => undefined}
              onSelectPosition={(_blockId, position) => {
                const blocks = displayBlocks(snapshot);
                const block = blocks.find((item) => item.rows.some((row) => row.positions.some((cell) => cell.id === position.id)));
                const row = block?.rows.find((item) => item.positions.some((cell) => cell.id === position.id));
                togglePosition(block?.code ?? DISPATCH_BLOCK_CODE, row?.code ?? "", position);
              }}
            />
            <div className="space-y-3 border-4 border-loxam-black bg-white p-4">
              {selected.length === 0 ? (
                <p className="font-bold text-loxam-muted">{t("dispatch.tapA")}</p>
              ) : (
                selected.map((cell, index) => (
                  <p key={cell.position.id} className="text-xl font-black">
                    {index + 1}.{" "}
                    {formatGroundPositionLabel({
                      blockCode: cell.blockCode,
                      rowCode: cell.rowCode,
                      positionCode: cell.position.code,
                    })}
                  </p>
                ))
              )}
              <TouchButton disabled={selected.length !== required} onClick={() => setStep("order")}>
                {t("dispatch.setOrder")}
              </TouchButton>
            </div>
          </div>
        </div>
      ) : null}

      {step === "order" ? (
        <div className="space-y-4">
          <p className="text-xl font-black">{t("dispatch.orderTitle")}</p>
          <ol className="space-y-3">
            {selected.map((cell, index) => (
              <li
                key={cell.position.id}
                className="flex items-center gap-3 border-4 border-loxam-black bg-white p-3"
              >
                <p className="flex-1 text-2xl font-black">
                  {index + 1}.{" "}
                  {formatGroundPositionLabel({
                    blockCode: cell.blockCode,
                    rowCode: cell.rowCode,
                    positionCode: cell.position.code,
                  })}
                </p>
                <button
                  type="button"
                  className="min-h-14 min-w-14 border-2 border-loxam-black text-2xl font-black"
                  onClick={() => moveOrder(index, -1)}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="min-h-14 min-w-14 border-2 border-loxam-black text-2xl font-black"
                  onClick={() => moveOrder(index, 1)}
                  disabled={index === selected.length - 1}
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
          <TouchButton disabled={pending || selected.length !== required} onClick={() => void createDossier()}>
            {pending ? t("dispatch.creating") : t("dispatch.createConfirm")}
          </TouchButton>
        </div>
      ) : null}

      {step !== "choice" ? (
        <TouchButton
          variant="ghost"
          onClick={() => {
            setError(null);
            setExistingMatch(null);
            if (step === "order") {
              setStep("pick");
              return;
            }
            if (step === "pick") {
              setStep("form");
              return;
            }
            setStep("choice");
          }}
        >
          {t("common.back")}
        </TouchButton>
      ) : null}

      <Link
        href={`/modules/${module.moduleNumber}`}
        className="block text-center text-sm font-black uppercase text-loxam-muted"
      >
        {t("common.cancel")}
      </Link>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-loxam-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-16 w-full border-4 border-loxam-black bg-white px-4 text-2xl font-black"
      />
    </label>
  );
}
