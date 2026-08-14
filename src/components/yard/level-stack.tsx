"use client";

import {useLocale, useTranslations} from "next-intl";
import {formatLevelCode} from "@/lib/format";
import type {YardLevelCell} from "@/features/yard-locations/types";
import type {StackLevel} from "@/types/database";

export function LevelStack({
  levels,
  onSelect,
  selectable = true,
}: {
  levels: YardLevelCell[];
  onSelect?: (level: YardLevelCell) => void;
  selectable?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div className="space-y-3">
      {levels.map((cell) => {
        const occupied = Boolean(cell.occupant);
        const label = formatLevelCode(cell.level, locale);
        const fullKey =
          cell.level === "GROUND"
            ? "levels.GROUND_FULL"
            : cell.level === "LEVEL_1"
              ? "levels.LEVEL_1_FULL"
              : "levels.LEVEL_2_FULL";

        return (
          <button
            key={cell.slotId}
            type="button"
            disabled={!selectable || (occupied && !onSelect)}
            onClick={() => onSelect?.(cell)}
            className={`flex min-h-24 w-full items-center justify-between px-5 text-left ${
              occupied
                ? "border-4 border-loxam-occupied bg-loxam-occupied-soft"
                : "border-4 border-loxam-free bg-loxam-free-soft"
            }`}
          >
            <div>
              <p className="text-3xl font-black text-loxam-black">{label}</p>
              <p className="text-sm font-bold text-loxam-muted">{t(fullKey)}</p>
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
