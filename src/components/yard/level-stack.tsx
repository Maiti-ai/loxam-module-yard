"use client";

import {useTranslations} from "next-intl";
import {formatLevelLabel} from "@/lib/format";
import {hasInconsistentStack} from "@/features/yard-locations/stacking";
import type {YardLevelCell} from "@/features/yard-locations/types";
import type {StackLevel} from "@/types/database";

export function LevelStack({
  levels,
  onSelect,
  selectable = true,
  highlightLevel,
}: {
  levels: YardLevelCell[];
  onSelect?: (level: YardLevelCell) => void;
  selectable?: boolean;
  highlightLevel?: StackLevel | null;
}) {
  const t = useTranslations();
  const inconsistent = hasInconsistentStack(levels);

  return (
    <div className="space-y-3">
      {inconsistent ? (
        <p className="text-sm font-bold text-loxam-muted">{t("move.inconsistentStack")}</p>
      ) : null}
      {levels.map((cell) => {
        const occupied = Boolean(cell.occupant);
        const label = formatLevelLabel(cell.level);
        const highlighted = highlightLevel === cell.level;

        return (
          <button
            key={cell.slotId}
            type="button"
            disabled={!selectable || (occupied && !onSelect)}
            onClick={() => onSelect?.(cell)}
            className={`flex min-h-24 w-full items-center justify-between px-5 text-left ${
              highlighted
                ? "border-4 border-loxam-black bg-white ring-4 ring-loxam-free"
                : occupied
                  ? "border-4 border-loxam-occupied bg-loxam-occupied-soft"
                  : "border-4 border-loxam-free bg-loxam-free-soft"
            }`}
          >
            <div>
              <p className="text-3xl font-black text-loxam-black">{label}</p>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-black uppercase ${
                  occupied ? "text-loxam-occupied" : "text-loxam-free"
                }`}
              >
                {occupied ? t("common.occupied") : t("common.free")}
              </p>
              {cell.occupant ? (
                <p className="mt-1 text-2xl font-black">{cell.occupant.moduleNumber}</p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function MiniLevelStack({levels}: {levels: YardLevelCell[]}) {
  return (
    <div className="flex h-16 w-10 flex-col justify-between">
      {(["LEVEL_2", "LEVEL_1", "GROUND"] as StackLevel[]).map((level) => {
        const cell = levels.find((item) => item.level === level);
        const occupied = Boolean(cell?.occupant);
        return (
          <span
            key={level}
            className={`block h-4 w-full ${occupied ? "bg-loxam-occupied" : "bg-loxam-free"}`}
          />
        );
      })}
    </div>
  );
}
