"use client";

import {YARD_MAP_FR} from "@/config/yard-geometry";

export function YardLegend() {
  return (
    <div className="flex flex-wrap gap-4 border border-loxam-line bg-white px-4 py-3 text-sm font-bold">
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 bg-loxam-free" />
        {YARD_MAP_FR.free}
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 bg-loxam-occupied" />
        {YARD_MAP_FR.occupied}
      </span>
      <span className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 bg-loxam-rented" />
        {YARD_MAP_FR.rented}
      </span>
    </div>
  );
}
