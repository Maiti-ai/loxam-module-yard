"use client";

import {MiniLevelStack} from "@/components/yard/level-stack";
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
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-24 min-w-24 flex-col items-center justify-center gap-2 border-4 bg-white px-3 py-3 ${
        selected ? "border-loxam-red" : "border-loxam-black"
      }`}
    >
      <span className="text-xl font-black">{position.code}</span>
      <MiniLevelStack levels={position.levels} />
    </button>
  );
}
