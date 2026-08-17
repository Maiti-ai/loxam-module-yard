"use client";

import {useTranslations} from "next-intl";
import {formatLevelLabel} from "@/lib/format";
import {hasInconsistentStack, STACK_LEVEL_NUMBER, stackLevelsForHeight} from "@/features/yard-locations/stacking";
import type {YardLevelCell} from "@/features/yard-locations/types";
import type {StackLevel} from "@/types/database";

export function LevelStack({
  levels,
  onSelect,
  selectable = true,
  highlightLevel,
  maxStackLevels,
}: {
  levels: YardLevelCell[];
  onSelect?: (level: YardLevelCell) => void;
  selectable?: boolean;
  highlightLevel?: StackLevel | null;
  maxStackLevels?: number;
}) {
  const t = useTranslations();
  const inconsistent = hasInconsistentStack(levels, {maxStackLevels});
  const visible = maxStackLevels
    ? levels.filter((cell) => STACK_LEVEL_NUMBER[cell.level] < maxStackLevels)
    : levels;

  return (
    <div className="space-y-3">
      {inconsistent ? (
        <p className="text-sm font-bold text-loxam-muted">{t("move.inconsistentStack")}</p>
      ) : null}
      {visible.map((cell) => {
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

export function MiniLevelStack({
  levels,
  maxStackLevels = 3,
}: {
  levels: YardLevelCell[];
  maxStackLevels?: number;
}) {
  const visible = [...stackLevelsForHeight(maxStackLevels)].reverse();
  return (
    <div className={`flex w-10 flex-col justify-between ${maxStackLevels > 1 ? "h-16" : "h-6"}`}>
      {visible.map((level) => {
        const cell = levels.find((item) => item.level === level);
        const occupied = Boolean(cell?.occupant);
        return (
          <span
            key={level}
            className={`block w-full ${maxStackLevels > 1 ? "h-4" : "h-6"} ${
              occupied ? "bg-loxam-occupied" : "bg-loxam-free"
            }`}
          />
        );
      })}
    </div>
  );
}
