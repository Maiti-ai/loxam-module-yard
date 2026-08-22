"use client";

import {useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {SchelleYardMap} from "@/components/yard/schelle-yard-map";
import {LevelStack} from "@/components/yard/level-stack";
import {findBlockByCode} from "@/features/dispatch/availability";
import {returnDispatchModuleAction} from "@/features/dispatch/actions";
import {
  isReturnArrivalsRow,
  RETURN_ARRIVALS_BLOCK_CODE,
  RETURN_ARRIVALS_ROW_CODES,
} from "@/features/dispatch/location-status";
import type {DispatchAssignment} from "@/features/dispatch/types";
import {
  destinationChoice,
  firstFreeCell,
  resolveMaxStackLevels,
} from "@/features/yard-locations/stacking";
import {formatCompactLocation, formatLevelLabel} from "@/lib/format";
import type {
  ModuleSummary,
  YardLevelCell,
  YardPositionNode,
  YardSnapshot,
} from "@/features/yard-locations/types";

export function ReturnInstruction({
  module,
  assignment,
  snapshot,
}: {
  module: ModuleSummary;
  assignment: DispatchAssignment;
  snapshot: YardSnapshot;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [position, setPosition] = useState<YardPositionNode | null>(null);
  const [level, setLevel] = useState<YardLevelCell | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    returnedCount: number;
    onRentCount: number;
    totalModules: number;
    locationLabel: string | null;
  } | null>(null);

  const blockD = findBlockByCode(snapshot, RETURN_ARRIVALS_BLOCK_CODE);

  function selectPosition(item: YardPositionNode, blockCode: string, rowCode: string) {
    if (!isReturnArrivalsRow(blockCode, rowCode)) {
      setPosition(null);
      setLevel(null);
      setError(t("errors.DISPATCH_RETURN_ZONE_REQUIRED"));
      return;
    }
    const stackOptions = {
      ignoreModuleId: module.id,
      blockCode,
      maxStackLevels: resolveMaxStackLevels({blockCode}),
    };
    const choice = destinationChoice(item.levels, stackOptions);
    if (!choice.ok) {
      setPosition(null);
      setLevel(null);
      setError(choice.reason === "full" ? t("errors.POSITION_FULL") : t("errors.SLOT_MISSING"));
      return;
    }
    const assigned = firstFreeCell(item.levels, stackOptions);
    if (!assigned) {
      setPosition(null);
      setLevel(null);
      setError(t("errors.POSITION_FULL"));
      return;
    }
    setError(null);
    setPosition(item);
    setLevel(assigned);
  }

  async function confirm() {
    if (!position || pending) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await returnDispatchModuleAction(module.id, position.id);
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.code}`));
      return;
    }
    setDone({
      returnedCount: result.returnedCount,
      onRentCount: result.onRentCount,
      totalModules: result.totalModules,
      locationLabel: result.locationLabel,
    });
  }

  if (done) {
    return (
      <div className="space-y-6">
        <p className="text-xs font-bold tracking-[0.22em] text-loxam-free uppercase">OK</p>
        <h1 className="text-4xl font-black uppercase">
          {t("module.label")} {module.moduleNumber} {t("dispatch.returnedOk")}
        </h1>
        <p className="text-3xl font-black">{t("dispatch.lifecycle.returned")}</p>
        {done.locationLabel ? <p className="text-2xl font-black">{done.locationLabel}</p> : null}
        <p className="text-2xl font-black">
          {t("dispatch.returnProgress", {
            returned: done.returnedCount,
            onRent: done.onRentCount,
            total: done.totalModules,
          })}
        </p>
        <TouchButton onClick={() => router.push(`/modules/${module.moduleNumber}`)}>
          {t("common.open")}
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
        <p className="mt-4 text-sm font-bold uppercase text-loxam-muted">{t("module.status")}</p>
        <p className="text-2xl font-black uppercase">{t("dispatch.lifecycle.shipped")}</p>
      </div>
      <div className="border-4 border-loxam-red bg-white p-6 text-center">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-loxam-muted">
          {t("dispatch.destination")}
        </p>
        <p className="mt-3 text-4xl font-black tracking-tight">{t("dispatch.returnZone")}</p>
      </div>
      {blockD ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SchelleYardMap
            snapshot={snapshot}
            selectedBlockId={blockD.id}
            selectedPositionId={position?.id ?? null}
            allowedBlockCodes={[RETURN_ARRIVALS_BLOCK_CODE]}
            allowedRowCodes={[...RETURN_ARRIVALS_ROW_CODES]}
            lockBlockId={blockD.id}
            onSelectBlock={() => undefined}
            onSelectPosition={(_blockId, item) => {
              const row = blockD.rows.find((entry) =>
                entry.positions.some((pos) => pos.id === item.id),
              );
              if (!row) {
                return;
              }
              selectPosition(item, blockD.code, row.code);
            }}
          />
          {position && level ? (
            <div className="border-4 border-loxam-black bg-white p-4">
              <p className="text-sm font-black uppercase text-loxam-muted">{t("dispatch.targetSlot")}</p>
              <p className="mt-2 text-2xl font-black">
                {formatCompactLocation({
                  blockCode: RETURN_ARRIVALS_BLOCK_CODE,
                  rowCode:
                    blockD.rows.find((row) => row.positions.some((pos) => pos.id === position.id))
                      ?.code ?? "",
                  positionCode: position.code,
                  level: level.level,
                  locale,
                })}
              </p>
              <p className="mt-1 text-xl font-black">{formatLevelLabel(level.level, locale)}</p>
              <div className="mt-4">
                <LevelStack
                  levels={position.levels}
                  selectable={false}
                  highlightLevel={level.level}
                  maxStackLevels={resolveMaxStackLevels({blockCode: RETURN_ARRIVALS_BLOCK_CODE})}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4 font-bold">
          {t("errors.SLOT_MISSING")}
        </p>
      )}
      {error ? (
        <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-4 font-bold">{error}</p>
      ) : null}
      <TouchButton disabled={!position || pending} onClick={() => void confirm()}>
        {pending ? t("dispatch.returning") : t("dispatch.confirmReturn")}
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
