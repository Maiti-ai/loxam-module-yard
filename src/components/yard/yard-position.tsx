"use client";

import {MiniLevelStack} from "@/components/yard/level-stack";
import {primaryOccupant} from "@/features/yard-locations/queries-client";
import {formatCodeNumber} from "@/lib/format";
import type {YardPositionNode} from "@/features/yard-locations/types";

export function YardPosition({
  position,
  onSelect,
  selected = false,
}: {
  position: YardPositionNode;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const occupant = primaryOccupant(position);
  const is3x3 = occupant?.moduleTypeCode === "3x3";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-28 flex-col items-center justify-center gap-2 border-4 bg-white px-3 py-3 ${
        is3x3 ? "min-w-20" : "min-w-32"
      } ${selected ? "border-loxam-red" : "border-loxam-black"}`}
    >
      <span className="text-2xl font-black">{formatCodeNumber(position.code)}</span>
      <div className={`flex items-end justify-center ${is3x3 ? "w-10" : "w-16"}`}>
        <span
          className={`block ${is3x3 ? "h-8 w-8" : "h-8 w-16"} ${
            occupant
              ? occupant.status === "RENTED"
                ? "bg-loxam-rented"
                : "bg-loxam-occupied"
              : "bg-loxam-free/40"
          }`}
        />
      </div>
      <MiniLevelStack levels={position.levels} />
    </button>
  );
}
