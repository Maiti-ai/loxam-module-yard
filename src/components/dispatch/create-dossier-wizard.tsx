"use client";

import {useMemo, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {SchelleYardMap, displayBlocks} from "@/components/yard/schelle-yard-map";
import {
  activateDispatchDossierAction,
  cancelDispatchDossierAction,
  saveDispatchDossierDraftAction,
} from "@/features/dispatch/actions";
import {
  countReservableAPositions,
  findBlockByCode,
  isSnapshotPositionReservable,
} from "@/features/dispatch/availability";
import {moduleDispatchEligibility} from "@/features/dispatch/eligibility";
import {searchModules} from "@/features/modules/search";
import {bindModulesToPositions, DISPATCH_BLOCK_CODE, requiredGroundPositions} from "@/features/dispatch/plan";
import type {DispatchDossierDetail} from "@/features/dispatch/types";
import {hasLivePlacementSlots} from "@/features/yard-locations/physical-registry";
import {
  formatCompactLocation,
  formatGroundPositionLabel,
  formatLevelLabel,
  formatTypeLabel,
} from "@/lib/format";
import type {ModuleSummary, YardPositionNode, YardSnapshot} from "@/features/yard-locations/types";

type Step = 1 | 2 | 3 | 4 | 5;

type SelectedCell = {
  position: YardPositionNode;
  blockCode: string;
  rowCode: string;
};

function initialCells(snapshot: YardSnapshot, dossier: DispatchDossierDetail | null): SelectedCell[] {
  if (!dossier) {
    return [];
  }
  const blocks = displayBlocks(snapshot);
  return dossier.positions
    .slice()
    .sort((a, b) => a.positionOrder - b.positionOrder)
    .flatMap((item) => {
      for (const block of blocks) {
        for (const row of block.rows) {
          const position = row.positions.find((cell) => cell.id === item.positionId);
          if (position) {
            return [{position, blockCode: block.code, rowCode: row.code}];
          }
        }
      }
      return [];
    });
}

export function CreateDossierWizard({
  snapshot,
  modules,
  occupiedModuleIds,
  dossier,
}: {
  snapshot: YardSnapshot;
  modules: ModuleSummary[];
  occupiedModuleIds: string[];
  dossier: DispatchDossierDetail | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const occupied = useMemo(() => new Set(occupiedModuleIds), [occupiedModuleIds]);
  const modulesById = useMemo(() => new Map(modules.map((module) => [module.id, module])), [modules]);

  const [step, setStep] = useState<Step>(1);
  const [dossierId, setDossierId] = useState<string | null>(dossier?.id ?? null);
  const [dossierNumber, setDossierNumber] = useState(dossier?.dossierNumber ?? "");
  const [customerName, setCustomerName] = useState(dossier?.customerName ?? "");
  const [siteLocation, setSiteLocation] = useState(dossier?.siteLocation ?? "");
  const [totalModules, setTotalModules] = useState(String(dossier?.totalModules ?? 6));
  const [selectedIds, setSelectedIds] = useState<string[]>(
    dossier?.slots
      .filter((slot) => slot.moduleId)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map((slot) => slot.moduleId as string) ?? [],
  );
  const [selected, setSelected] = useState<SelectedCell[]>(() => initialCells(snapshot, dossier));
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = Number(totalModules);
  const required = requiredGroundPositions(Number.isInteger(total) ? total : 0);
  const available = countReservableAPositions(snapshot);
  const blockA = findBlockByCode(snapshot, DISPATCH_BLOCK_CODE);
  const selectedPositionIds = selected.map((cell) => cell.position.id);
  const selectedModules = selectedIds
    .map((id) => modulesById.get(id))
    .filter((module): module is ModuleSummary => Boolean(module));
  const bindings = bindModulesToPositions(
    selectedIds,
    selected.map((cell) => cell.position.id),
  );
  const filtered = searchModules(modules, query);

  function planInput() {
    return {
      dossierId,
      dossierNumber,
      customerName,
      siteLocation,
      totalModules: Number(totalModules),
      positionIds: selected.map((cell) => cell.position.id),
      moduleIds: selectedIds,
    };
  }

  async function persist(activate: boolean) {
    if (pending) {
      return null;
    }
    setPending(true);
    setError(null);
    const result = activate
      ? await activateDispatchDossierAction(planInput())
      : await saveDispatchDossierDraftAction(planInput());
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.code}`));
      router.refresh();
      return null;
    }
    setDossierId(result.dossierId);
    return result;
  }

  function validateStep1() {
    const parsed = Number(totalModules);
    if (
      !dossierNumber.trim() ||
      !customerName.trim() ||
      !siteLocation.trim() ||
      !Number.isInteger(parsed) ||
      parsed < 1
    ) {
      setError(t("dispatch.fieldsRequired"));
      return false;
    }
    return true;
  }

  async function goNext() {
    if (step === 1) {
      if (!validateStep1()) {
        return;
      }
      const needed = requiredGroundPositions(Number(totalModules));
      if (available < needed) {
        setError(t("dispatch.insufficientSpace", {needed, available}));
        return;
      }
      const saved = await persist(false);
      if (saved) {
        setStep(2);
      }
      return;
    }
    if (step === 2) {
      if (selectedIds.length !== Number(totalModules)) {
        setError(t("dispatch.exactModules", {count: Number(totalModules)}));
        return;
      }
      const saved = await persist(false);
      if (saved) {
        setStep(3);
      }
      return;
    }
    if (step === 3) {
      const saved = await persist(false);
      if (saved) {
        setStep(4);
      }
      return;
    }
    if (step === 4) {
      if (selected.length !== required) {
        setError(t("dispatch.exactPositions", {count: required}));
        return;
      }
      const saved = await persist(false);
      if (saved) {
        setStep(5);
      }
    }
  }

  async function activate() {
    const result = await persist(true);
    if (result) {
      router.push(`/dossiers/${result.dossierId}`);
      router.refresh();
    }
  }

  async function cancelDraft() {
    if (!dossierId) {
      router.push("/dossiers");
      return;
    }
    setPending(true);
    const result = await cancelDispatchDossierAction(dossierId);
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.code}`));
      return;
    }
    router.push("/dossiers");
    router.refresh();
  }

  function toggleModule(id: string) {
    const yardModule = modulesById.get(id);
    if (!yardModule) {
      return;
    }
    const eligibility = moduleDispatchEligibility(yardModule, occupied, {
      ignoreModuleIds: new Set(selectedIds),
    });
    const already = selectedIds.includes(id);
    if (!already && !eligibility.selectable) {
      setError(t(`dispatch.moduleBlocked.${eligibility.reason ?? "unavailable"}`));
      return;
    }
    setError(null);
    if (already) {
      setSelectedIds((current) => current.filter((item) => item !== id));
      return;
    }
    if (selectedIds.length >= Number(totalModules)) {
      setError(t("dispatch.exactModules", {count: Number(totalModules)}));
      return;
    }
    setSelectedIds((current) => [...current, id]);
  }

  function moveModule(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= selectedIds.length) {
      return;
    }
    setSelectedIds((current) => {
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  function togglePosition(blockCode: string, rowCode: string, position: YardPositionNode) {
    if (pending) {
      return;
    }
    if (blockCode.trim().toUpperCase() !== DISPATCH_BLOCK_CODE) {
      return;
    }
    const already = selected.some((cell) => cell.position.id === position.id);
    const ownReservation = position.reservation?.dossierId === dossierId;
    const reservable = isSnapshotPositionReservable(blockCode, {
      ...position,
      reservation: already || ownReservation ? undefined : position.reservation,
    });
    if (!hasLivePlacementSlots(position) || !reservable) {
      if (position.reservation && !ownReservation && !already) {
        setError(t("errors.POSITION_RESERVED"));
      } else {
        setError(t("dispatch.positionNotFree"));
      }
      return;
    }
    setError(null);
    if (already) {
      setSelected((current) => current.filter((cell) => cell.position.id !== position.id));
      return;
    }
    if (selected.length >= required) {
      setError(t("dispatch.exactPositions", {count: required}));
      return;
    }
    setSelected((current) => [...current, {position, blockCode, rowCode}]);
  }

  function movePosition(index: number, direction: -1 | 1) {
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
        {t("dispatch.wizardStep", {step, total: 5})}
      </p>
      <h1 className="text-4xl font-black">{t(`dispatch.wizardTitle${step}`)}</h1>

      {error ? (
        <div className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4">
          <p className="font-bold">{error}</p>
        </div>
      ) : null}

      {step === 1 ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void goNext();
          }}
        >
          <Field
            label={t("dispatch.dossierNumber")}
            value={dossierNumber}
            onChange={setDossierNumber}
            placeholder="45872"
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
              onChange={(event) => {
                setTotalModules(event.target.value);
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next >= 1) {
                  setSelectedIds((current) => current.slice(0, next));
                  const needed = requiredGroundPositions(next);
                  setSelected((current) => current.slice(0, needed));
                }
              }}
              className="mt-2 min-h-16 w-full border-4 border-loxam-black bg-white px-4 text-2xl font-black"
            />
          </label>
          {required > 0 ? (
            <p className="border-4 border-loxam-black bg-white p-4 text-lg font-black">
              {t("dispatch.requiredPositions", {modules: Number(totalModules) || 0, count: required})}
            </p>
          ) : null}
          <TouchButton type="submit" disabled={pending}>
            {pending ? t("dispatch.saving") : t("dispatch.next")}
          </TouchButton>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <p className="text-xl font-black">
            {t("dispatch.pickModules", {count: Number(totalModules) || 0, selected: selectedIds.length})}
          </p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            className="min-h-16 w-full border-4 border-loxam-black bg-white px-4 text-xl font-black"
          />
          <div className="max-h-[70vh] space-y-3 overflow-auto">
            {filtered.map((module) => {
              const chosen = selectedIds.includes(module.id);
              const eligibility = moduleDispatchEligibility(module, occupied, {
                ignoreModuleIds: new Set(selectedIds),
              });
              const disabled = !chosen && !eligibility.selectable;
              return (
                <button
                  key={module.id}
                  type="button"
                  disabled={disabled || pending}
                  onClick={() => toggleModule(module.id)}
                  className={`block w-full border-4 p-4 text-left ${
                    chosen
                      ? "border-loxam-red bg-white"
                      : disabled
                        ? "border-loxam-line bg-loxam-paper text-loxam-muted"
                        : "border-loxam-black bg-white"
                  }`}
                >
                  <p className="text-2xl font-black">
                    {t("module.label")} {module.moduleNumber}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {t("module.catClass")}: {formatTypeLabel(module.moduleTypeNumber, module.moduleTypeCode)}
                  </p>
                  <p className="text-sm font-bold">
                    {t("module.serialNumber")}: {module.airco?.serialNumber || "—"}
                  </p>
                  <p className="text-sm font-bold">
                    {t("module.location")}:{" "}
                    {module.location ? formatCompactLocation({...module.location, locale}) : t("module.noLocation")}
                  </p>
                  {disabled && eligibility.reason ? (
                    <p className="mt-2 text-xs font-black uppercase">
                      {t(`dispatch.moduleBlocked.${eligibility.reason}`)}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <TouchButton disabled={pending || selectedIds.length !== Number(totalModules)} onClick={() => void goNext()}>
            {pending ? t("dispatch.saving") : t("dispatch.next")}
          </TouchButton>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <p className="text-xl font-black">{t("dispatch.orderModulesTitle")}</p>
          <ol className="space-y-3">
            {selectedModules.map((module, index) => (
              <li key={module.id} className="flex items-center gap-3 border-4 border-loxam-black bg-white p-3">
                <p className="flex-1 text-2xl font-black">
                  {index + 1}. {t("module.label")} {module.moduleNumber}
                </p>
                <button
                  type="button"
                  className="min-h-14 min-w-14 border-2 border-loxam-black text-2xl font-black"
                  onClick={() => moveModule(index, -1)}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="min-h-14 min-w-14 border-2 border-loxam-black text-2xl font-black"
                  onClick={() => moveModule(index, 1)}
                  disabled={index === selectedModules.length - 1}
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
          <TouchButton disabled={pending} onClick={() => void goNext()}>
            {pending ? t("dispatch.saving") : t("dispatch.next")}
          </TouchButton>
        </div>
      ) : null}

      {step === 4 && blockA ? (
        <div className="space-y-4">
          <p className="text-xl font-black">
            {t("dispatch.pickPositions", {count: required, selected: selected.length})}
          </p>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <SchelleYardMap
              snapshot={snapshot}
              selectedBlockId={blockA.id}
              highlightedPositionIds={selectedPositionIds}
              allowedBlockCodes={[DISPATCH_BLOCK_CODE]}
              lockBlockId={blockA.id}
              onSelectBlock={() => undefined}
              onSelectPosition={(_blockId, position) => {
                const blocks = displayBlocks(snapshot);
                const block = blocks.find((item) =>
                  item.rows.some((row) => row.positions.some((cell) => cell.id === position.id)),
                );
                const row = block?.rows.find((item) => item.positions.some((cell) => cell.id === position.id));
                togglePosition(block?.code ?? DISPATCH_BLOCK_CODE, row?.code ?? "", position);
              }}
            />
            <div className="space-y-3 border-4 border-loxam-black bg-white p-4">
              {selected.length === 0 ? (
                <p className="font-bold text-loxam-muted">{t("dispatch.tapA")}</p>
              ) : (
                selected.map((cell, index) => (
                  <div key={cell.position.id} className="flex items-center gap-2">
                    <p className="flex-1 text-xl font-black">
                      {index + 1}.{" "}
                      {formatGroundPositionLabel({
                        blockCode: cell.blockCode,
                        rowCode: cell.rowCode,
                        positionCode: cell.position.code,
                      })}
                    </p>
                    <button
                      type="button"
                      className="min-h-12 min-w-12 border-2 border-loxam-black text-xl font-black"
                      onClick={() => movePosition(index, -1)}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="min-h-12 min-w-12 border-2 border-loxam-black text-xl font-black"
                      onClick={() => movePosition(index, 1)}
                      disabled={index === selected.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                ))
              )}
              <TouchButton disabled={pending || selected.length !== required} onClick={() => void goNext()}>
                {pending ? t("dispatch.saving") : t("dispatch.next")}
              </TouchButton>
            </div>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-4">
          <div className="border-4 border-loxam-black bg-white p-5">
            <p className="text-3xl font-black">{dossierNumber}</p>
            <p className="mt-2 text-xl font-black">{customerName}</p>
            <p className="text-lg font-bold text-loxam-muted">{siteLocation}</p>
          </div>
          <ol className="space-y-3">
            {bindings.map((binding) => {
              const yardModule = modulesById.get(binding.moduleId);
              const cell = selected[binding.positionOrder - 1];
              return (
                <li key={binding.sequenceNumber} className="border-4 border-loxam-black bg-white p-4">
                  <p className="text-2xl font-black">
                    {binding.sequenceNumber}. {t("module.label")} {yardModule?.moduleNumber ?? "—"}
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {cell
                      ? formatGroundPositionLabel({
                          blockCode: cell.blockCode,
                          rowCode: cell.rowCode,
                          positionCode: cell.position.code,
                        })
                      : "—"}{" "}
                    · {formatLevelLabel(binding.level)}
                  </p>
                </li>
              );
            })}
          </ol>
          <TouchButton disabled={pending} onClick={() => void activate()}>
            {pending ? t("dispatch.activating") : t("dispatch.activate")}
          </TouchButton>
        </div>
      ) : null}

      {step > 1 ? (
        <TouchButton
          variant="ghost"
          onClick={() => {
            setError(null);
            setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
          }}
        >
          {t("common.back")}
        </TouchButton>
      ) : null}

      <TouchButton variant="ghost" disabled={pending} onClick={() => void cancelDraft()}>
        {t("dispatch.cancelDossier")}
      </TouchButton>
      <Link href="/dossiers" className="block text-center text-sm font-black uppercase text-loxam-muted">
        {t("dispatch.leaveWizard")}
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
