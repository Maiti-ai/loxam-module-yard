"use client";

import {useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {SchelleYardMap, displayBlocks} from "@/components/yard/schelle-yard-map";
import {LevelStack} from "@/components/yard/level-stack";
import {moveModuleAction} from "@/features/movements/actions";
import {resolvePhysicalPositionAction} from "@/features/yard-locations/actions";
import {
  displayedCellIdentity,
  isSpecPhysicalCell,
  needsRegistryResolve,
} from "@/features/yard-locations/resolve-position";
import {
  destinationChoice,
  firstFreeCell,
  hasInconsistentStack,
  resolveMaxStackLevels,
} from "@/features/yard-locations/stacking";
import {formatCompactLocation, formatLevelLabel, formatPositionCode, formatRowCode} from "@/lib/format";
import type {
  ModuleSummary,
  YardLevelCell,
  YardPositionNode,
  YardSnapshot,
} from "@/features/yard-locations/types";

type Step = "block" | "position" | "confirm" | "success";

export function MoveWizard({
  module,
  snapshot,
}: {
  module: ModuleSummary;
  snapshot: YardSnapshot;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<Step>("block");
  const [blockId, setBlockId] = useState<string | null>(null);
  const [position, setPosition] = useState<YardPositionNode | null>(null);
  const [level, setLevel] = useState<YardLevelCell | null>(null);
  const [pending, setPending] = useState(false);
  const [occupiedNumber, setOccupiedNumber] = useState<string | null>(null);
  const [positionFull, setPositionFull] = useState(false);
  const [reassigned, setReassigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clickedPositionId, setClickedPositionId] = useState<string | null>(null);
  const [toLocation, setToLocation] = useState(module.location);

  const blocks = displayBlocks(snapshot);
  const block = blocks.find((item) => item.id === blockId) ?? null;
  const row =
    block?.rows.find((item) =>
      item.positions.some(
        (entry) => entry.id === clickedPositionId || entry.id === position?.id,
      ),
    ) ?? null;

  async function selectPosition(item: YardPositionNode, blockCode: string, rowCode: string) {
    if (pending) {
      return;
    }
    setOccupiedNumber(null);
    setReassigned(false);
    const stackOptions = {ignoreModuleId: module.id, blockCode};
    const identity = displayedCellIdentity(blockCode, rowCode, item);
    if (!isSpecPhysicalCell(identity.blockCode, identity.rowCode, identity.positionNumber)) {
      setPosition(null);
      setLevel(null);
      setClickedPositionId(null);
      setPositionFull(false);
      setStep("position");
      setError(t("errors.SLOT_MISSING"));
      return;
    }
    let target = item;
    if (needsRegistryResolve(item)) {
      setPending(true);
      const resolved = await resolvePhysicalPositionAction(
        identity.blockCode,
        identity.rowCode,
        identity.positionNumber,
      );
      setPending(false);
      if (!resolved.ok) {
        setPosition(null);
        setLevel(null);
        setClickedPositionId(null);
        setPositionFull(false);
        setStep("position");
        setError(t(`errors.${resolved.code}`));
        return;
      }
      target = resolved.position;
    }
    const choice = destinationChoice(target.levels, stackOptions);
    if (!choice.ok) {
      setPosition(null);
      setLevel(null);
      setClickedPositionId(null);
      setStep("position");
      if (choice.reason === "full") {
        setPositionFull(true);
        setError(null);
      } else {
        setPositionFull(false);
        setError(t("errors.SLOT_MISSING"));
      }
      return;
    }
    const assigned = firstFreeCell(target.levels, stackOptions);
    if (!assigned) {
      setPosition(null);
      setLevel(null);
      setClickedPositionId(null);
      setPositionFull(true);
      setError(null);
      setStep("position");
      return;
    }
    setPositionFull(false);
    setError(null);
    setClickedPositionId(item.id);
    setPosition(target);
    setLevel(assigned);
    setStep("confirm");
  }

  async function confirm() {
    if (!position || !level) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await moveModuleAction(module.id, position.id, level.level);
    setPending(false);

    if (!result.ok) {
      if (result.code === "POSITION_FULL" || result.code === "SLOT_OCCUPIED") {
        setPositionFull(result.code === "POSITION_FULL");
        setOccupiedNumber(result.occupantNumber ?? null);
        setLevel(null);
        setPosition(null);
        setClickedPositionId(null);
        setStep("position");
        router.refresh();
        return;
      }
      setError(t(`errors.${result.code}`));
      return;
    }

    setReassigned(Boolean(result.reassigned));
    setToLocation(result.location);
    setStep("success");
  }

  if (step === "success" && toLocation) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-bold tracking-[0.22em] text-loxam-free uppercase">OK</p>
        <h1 className="text-4xl font-black uppercase">
          {t("module.label")} {module.moduleNumber} {t("move.success")}
        </h1>
        <p className="text-2xl font-black">{formatCompactLocation({...toLocation, locale})}</p>
        {reassigned ? (
          <p className="border-4 border-loxam-black bg-white p-4 text-lg font-bold">
            {t("move.levelReassigned", {level: formatLevelLabel(toLocation.level, locale)})}
          </p>
        ) : null}
        <p className="text-loxam-muted">{t("move.successBody")}</p>
        <TouchButton onClick={() => router.push(`/modules/${module.moduleNumber}`)}>
          {t("common.open")}
        </TouchButton>
        <Link href="/" className="block text-center text-sm font-black uppercase">
          {t("nav.home")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-[0.2em] text-loxam-muted uppercase">
          {t("module.label")} {module.moduleNumber}
        </p>
        <h1 className="mt-2 text-3xl font-black">
          {step === "block" && t("move.chooseBlock")}
          {step === "position" && t("move.choosePosition")}
          {step === "confirm" && t("move.confirmTitle")}
        </h1>
        {step !== "block" ? (
          <p className="mt-2 text-base font-bold text-loxam-muted">{t("yard.tapPosition")}</p>
        ) : null}
      </div>

      {step === "position" && positionFull ? (
        <div className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4">
          <p className="text-xl font-black">
            {resolveMaxStackLevels({blockCode: block?.code}) === 1
              ? t("move.productionOccupiedTitle")
              : t("move.positionFullTitle")}
          </p>
          <p className="mt-2 text-sm font-bold">
            {resolveMaxStackLevels({blockCode: block?.code}) === 1
              ? t("move.productionOccupiedBody")
              : t("move.positionFullBody")}
          </p>
        </div>
      ) : null}

      {step === "position" && occupiedNumber ? (
        <div className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4">
          <p className="text-xl font-black">{t("move.occupiedTitle")}</p>
          <p className="mt-2 text-sm font-bold">
            {t("move.occupiedBody", {
              occupant: occupiedNumber ? t("move.occupiedBy", {number: occupiedNumber}) : "",
            })}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4 font-bold">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SchelleYardMap
          snapshot={snapshot}
          selectedBlockId={blockId}
          selectedRowId={row?.id}
          selectedPositionId={step === "confirm" ? clickedPositionId : null}
          onSelectBlock={(id) => {
            setBlockId(id);
            setPositionFull(false);
            setOccupiedNumber(null);
            if (step === "confirm") {
              setPosition(null);
              setLevel(null);
              setClickedPositionId(null);
              setStep("position");
            } else {
              setStep("position");
            }
          }}
          onSelectPosition={(nextBlockId, nextPosition) => {
            const nextBlock = blocks.find((item) => item.id === nextBlockId);
            const nextRow = nextBlock?.rows.find((entry) =>
              entry.positions.some((cell) => cell.id === nextPosition.id),
            );
            void selectPosition(nextPosition, nextBlock?.code ?? "", nextRow?.code ?? "");
          }}
        />

        {step === "confirm" && block && row && position && level ? (
          <div className="space-y-5 border-4 border-loxam-black bg-white p-5">
            <p className="text-4xl font-black">
              {t("module.label")} {module.moduleNumber}
            </p>
            <div>
              <p className="text-xs font-bold uppercase text-loxam-muted">{t("move.selectedPosition")}</p>
              <p className="text-xl font-black">
                {t("move.block")} {block.code}
              </p>
              <p className="text-xl font-black">{formatRowCode(row.code)}</p>
              <p className="text-xl font-black">
                {t("move.position")} {formatPositionCode(position.code)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-loxam-muted">{t("move.from")}</p>
              <p className="text-xl font-black">
                {module.location
                  ? formatCompactLocation({...module.location, locale})
                  : t("module.noLocation")}
              </p>
            </div>
            {resolveMaxStackLevels({blockCode: block.code}) > 1 ? (
              <>
                <div className="border-4 border-loxam-free bg-loxam-free-soft p-4">
                  <p className="text-xs font-bold uppercase text-loxam-muted">{t("move.autoLevelTitle")}</p>
                  <p className="mt-1 text-3xl font-black uppercase">
                    {formatLevelLabel(level.level, locale)}
                  </p>
                  <p className="mt-2 text-sm font-bold">
                    {t("move.autoLevel", {level: formatLevelLabel(level.level, locale)})}
                  </p>
                </div>
                {hasInconsistentStack(position.levels, {blockCode: block.code}) ? (
                  <p className="text-sm font-bold text-loxam-muted">{t("move.inconsistentStack")}</p>
                ) : null}
                <LevelStack
                  levels={position.levels}
                  selectable={false}
                  highlightLevel={level.level}
                  maxStackLevels={resolveMaxStackLevels({blockCode: block.code})}
                />
              </>
            ) : (
              <>
                <p className="text-lg font-black text-loxam-free">{t("yard.positionFree")}</p>
                {hasInconsistentStack(position.levels, {blockCode: block.code}) ? (
                  <p className="text-sm font-bold text-loxam-occupied">
                    {t("move.inconsistentProductionStack")}
                  </p>
                ) : null}
              </>
            )}
            <TouchButton disabled={pending} onClick={confirm}>
              {pending ? t("move.busy") : t("move.confirm")}
            </TouchButton>
          </div>
        ) : (
          <p className="border border-dashed border-loxam-line bg-white p-6 text-lg font-bold text-loxam-muted">
            {step === "block" ? t("move.chooseBlock") : t("yard.tapPosition")}
          </p>
        )}
      </div>

      {step !== "block" && step !== "success" ? (
        <TouchButton
          variant="ghost"
          onClick={() => {
            setError(null);
            setPositionFull(false);
            if (step === "confirm") {
              setStep("position");
              return;
            }
            setStep("block");
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
