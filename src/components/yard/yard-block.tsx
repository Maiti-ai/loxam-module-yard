"use client";

import {useTranslations} from "next-intl";
import {blockCapacity, formatOccupiedTotal} from "@/features/yard-locations/capacity";
import type {YardBlockNode} from "@/features/yard-locations/types";

export function YardBlockCard({
  block,
  onSelect,
  selected = false,
}: {
  block: YardBlockNode;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const t = useTranslations("move");
  const capacity = blockCapacity(block);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-36 w-full flex-col justify-between border-4 p-5 text-left ${
        selected ? "border-loxam-red bg-white" : "border-loxam-black bg-white"
      } ${block.productionZone ? "ring-4 ring-loxam-rented" : ""}`}
    >
      <div>
        <p className="text-xs font-bold tracking-[0.2em] text-loxam-muted uppercase">
          {t("block")}
        </p>
        <p className="mt-1 text-5xl font-black text-loxam-black">{block.code}</p>
        <p className="mt-1 text-sm font-bold text-loxam-muted">{block.name}</p>
      </div>
      <p className="mt-4 text-sm font-black uppercase">
        {formatOccupiedTotal(capacity)}
        {block.productionZone ? ` · ${t("productionZone")}` : ""}
      </p>
    </button>
  );
}
