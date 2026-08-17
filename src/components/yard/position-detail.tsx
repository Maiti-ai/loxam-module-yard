"use client";

import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {positionCapacity} from "@/features/yard-locations/capacity";
import {DISPLAY_LEVELS, isStackFull} from "@/features/yard-locations/stacking";
import {formatLevelLabel, formatPositionCode, formatRowCode} from "@/lib/format";
import type {YardPositionNode} from "@/features/yard-locations/types";
import type {StackLevel} from "@/types/database";

export function PositionDetailPanel({
  blockCode,
  rowCode,
  position,
  onClose,
}: {
  blockCode: string;
  rowCode: string;
  position: YardPositionNode;
  onClose: () => void;
}) {
  const t = useTranslations();
  const capacity = positionCapacity(position);
  const full = isStackFull(position.levels) || capacity.occupied >= capacity.total;

  return (
    <div className="space-y-4 border-4 border-loxam-black bg-white p-4">
      <p className="text-xs font-bold tracking-[0.2em] text-loxam-muted uppercase">
        {t("move.selectedPosition")}
      </p>
      <div>
        <p className="text-2xl font-black">
          {t("move.block")} {blockCode}
        </p>
        <p className="text-2xl font-black">{formatRowCode(rowCode)}</p>
        <p className="text-2xl font-black">
          {t("move.position")} {formatPositionCode(position.code)}
        </p>
      </div>

      <ul className="space-y-2">
        {DISPLAY_LEVELS.map((level) => (
          <LevelRow key={level} level={level} position={position} />
        ))}
      </ul>

      <div className="border-t-4 border-loxam-black pt-3">
        <p className="text-xs font-bold tracking-[0.2em] text-loxam-muted uppercase">
          {t("yard.capacityLabel")}
        </p>
        <p className="mt-1 text-sm font-black uppercase">{t("move.capacity", capacity)}</p>
        <p className="mt-1 text-sm font-bold text-loxam-muted">
          {t("yard.availableSlots", {count: capacity.available})}
        </p>
        {full ? (
          <p className="mt-2 text-base font-black text-loxam-occupied">{t("yard.positionComplete")}</p>
        ) : null}
      </div>

      <TouchButton variant="ghost" onClick={onClose}>
        {t("common.close")}
      </TouchButton>
    </div>
  );
}

function LevelRow({level, position}: {level: StackLevel; position: YardPositionNode}) {
  const t = useTranslations();
  const cell = position.levels.find((item) => item.level === level);
  const occupant = cell?.occupant ?? null;

  return (
    <li className="flex min-h-16 items-center justify-between gap-3 border-2 border-loxam-line px-3 py-2">
      <p className="text-lg font-black">{formatLevelLabel(level)}</p>
      {occupant ? (
        <Link
          href={`/modules/${occupant.moduleNumber}`}
          className="text-right text-lg font-black text-loxam-black underline decoration-4 underline-offset-4"
        >
          {t("module.label")} {occupant.moduleNumber}
        </Link>
      ) : (
        <p className="text-lg font-black text-loxam-free">{t("common.free")}</p>
      )}
    </li>
  );
}
