"use client";

import {useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {SchelleYardMap} from "@/components/yard/schelle-yard-map";
import {YardPosition} from "@/components/yard/yard-position";
import {LevelStack} from "@/components/yard/level-stack";
import {moveModuleAction} from "@/features/movements/actions";
import {formatCompactLocation, formatCodeNumber} from "@/lib/format";
import type {
  ModuleSummary,
  YardLevelCell,
  YardPositionNode,
  YardSnapshot,
} from "@/features/yard-locations/types";

type Step = "block" | "position" | "level" | "confirm" | "success";

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
  const [error, setError] = useState<string | null>(null);
  const [toLocation, setToLocation] = useState(module.location);

  const block = snapshot.blocks.find((item) => item.id === blockId) ?? null;
  const rowCode =
    block?.rows.find((row) => row.positions.some((item) => item.id === position?.id))?.code ?? "";

  async function confirm() {
    if (!level) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await moveModuleAction(module.id, level.slotId);
    setPending(false);

    if (!result.ok) {
      if (result.code === "SLOT_OCCUPIED") {
        setOccupiedNumber(result.occupantNumber ?? null);
        setLevel(null);
        setStep("position");
        return;
      }
      setError(t(`errors.${result.code}`));
      return;
    }

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
        <p className="text-2xl font-black">
          {formatCompactLocation({...toLocation, locale})}
        </p>
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
          {step === "level" && t("move.chooseLevel")}
          {step === "confirm" && t("move.confirmTitle")}
        </h1>
      </div>

      {step === "position" && occupiedNumber ? (
        <div className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4">
          <p className="text-xl font-black">{t("move.occupiedTitle")}</p>
          <p className="mt-2 text-sm font-bold">
            {t("move.occupiedBody", {
              occupant: occupiedNumber
                ? t("move.occupiedBy", {number: occupiedNumber})
                : "",
            })}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4 font-bold">
          {error}
        </p>
      ) : null}

      {step === "block" ? (
        <SchelleYardMap
          snapshot={snapshot}
          selectedBlockId={blockId}
          onSelectBlock={(id) => {
            setBlockId(id);
            setPosition(null);
            setLevel(null);
            setStep("position");
          }}
        />
      ) : null}

      {step === "position" && block ? (
        <div className="space-y-6">
          <p className="text-sm font-bold text-loxam-muted">{t("move.backOfYard")}</p>
          {block.rows.map((row, index) => (
            <div key={row.id}>
              <p className="mb-3 text-xl font-black">
                {t("move.row")} {formatCodeNumber(row.code)}
              </p>
              <div className="flex flex-wrap gap-3">
                {row.positions.map((item) => (
                  <YardPosition
                    key={item.id}
                    position={item}
                    onSelect={() => {
                      setPosition(item);
                      setLevel(null);
                      setOccupiedNumber(null);
                      setStep("level");
                    }}
                  />
                ))}
              </div>
              {index === block.rows.length - 1 ? (
                <p className="mt-3 text-sm font-bold text-loxam-muted">
                  {t("move.frontOfYard")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {step === "level" && position ? (
        <LevelStack
          levels={position.levels}
          onSelect={(cell) => {
            if (cell.occupant && cell.occupant.moduleId !== module.id) {
              setOccupiedNumber(cell.occupant.moduleNumber);
              setStep("position");
              return;
            }
            setLevel(cell);
            setStep("confirm");
          }}
        />
      ) : null}

      {step === "confirm" && block && position && level ? (
        <div className="space-y-5 border-4 border-loxam-black bg-white p-5">
          <p className="text-4xl font-black">
            {t("module.label")} {module.moduleNumber}
          </p>
          <div>
            <p className="text-xs font-bold uppercase text-loxam-muted">{t("move.from")}</p>
            <p className="text-xl font-black">
              {module.location
                ? formatCompactLocation({...module.location, locale})
                : t("module.noLocation")}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-loxam-muted">{t("move.to")}</p>
            <p className="text-xl font-black">
              {formatCompactLocation({
                blockCode: block.code,
                rowCode,
                positionCode: position.code,
                level: level.level,
                locale,
              })}
            </p>
          </div>
          <TouchButton disabled={pending} onClick={confirm}>
            {pending ? t("move.busy") : t("move.confirm")}
          </TouchButton>
        </div>
      ) : null}

      {step !== "block" && step !== "success" ? (
        <TouchButton
          variant="ghost"
          onClick={() => {
            setError(null);
            if (step === "confirm") {
              setStep("level");
              return;
            }
            if (step === "level") {
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
