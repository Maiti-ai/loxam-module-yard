"use client";

import {useTranslations} from "next-intl";
import {MiniLevelStack} from "@/components/yard/level-stack";
import {primaryOccupant} from "@/features/yard-locations/queries-client";
import {isStackFull, resolveMaxStackLevels, stackOccupancy} from "@/features/yard-locations/stacking";
import {formatCodeNumber} from "@/lib/format";
import type {YardPositionNode} from "@/features/yard-locations/types";

export function YardPosition({
  position,
  onSelect,
  selected = false,
  full = false,
  blockCode,
}: {
  position: YardPositionNode;
  onSelect?: () => void;
  selected?: boolean;
  full?: boolean;
  blockCode?: string;
}) {
  const t = useTranslations();
  const occupant = primaryOccupant(position);
  const reserved = Boolean(position.reservation) && !occupant;
  const is3x3 = occupant?.moduleTypeCode === "3x3";
  const stackOptions = {blockCode};
  const occupancy = stackOccupancy(position.levels, stackOptions);
  const stackFull = full || isStackFull(position.levels, stackOptions);
  const maxStackLevels = resolveMaxStackLevels(stackOptions);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-28 flex-col items-center justify-center gap-2 border-4 px-3 py-3 ${
        is3x3 ? "min-w-20" : "min-w-32"
      } ${
        selected
          ? "border-loxam-red bg-white"
          : stackFull
            ? "border-loxam-occupied bg-loxam-occupied-soft"
            : reserved
              ? "border-loxam-reserved bg-loxam-reserved-soft"
              : "border-loxam-black bg-white"
      }`}
    >
      <span className="text-2xl font-black">{formatCodeNumber(position.code)}</span>
      <div className={`flex items-end justify-center ${is3x3 ? "w-10" : "w-16"}`}>
        <span
          className={`block ${is3x3 ? "h-8 w-8" : "h-8 w-16"} ${
            occupant
              ? occupant.status === "RENTED"
                ? "bg-loxam-rented"
                : "bg-loxam-occupied"
              : reserved
                ? "bg-loxam-reserved"
                : "bg-loxam-free/40"
          }`}
        />
      </div>
      <MiniLevelStack levels={position.levels} maxStackLevels={maxStackLevels} />
      {reserved ? (
        <span className="text-xs font-black uppercase text-loxam-reserved">
          {t("dispatch.reserved")}
        </span>
      ) : position.levels.length > 0 ? (
        <span
          className={`text-xs font-black uppercase ${
            stackFull ? "text-loxam-occupied" : "text-loxam-muted"
          }`}
        >
          {t(occupancy.total === 1 ? "move.capacitySingular" : "move.capacity", occupancy)}
        </span>
      ) : null}
    </button>
  );
}
