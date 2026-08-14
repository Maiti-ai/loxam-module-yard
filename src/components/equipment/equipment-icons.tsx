"use client";

import {useTranslations} from "next-intl";
import type {EquipmentPlaceholderKey} from "@/config/equipment";
import {EQUIPMENT_PLACEHOLDER_KEYS} from "@/config/equipment";

const icons: Record<string, string> = {
  outlets: "M4 10h16v4H4z",
  lighting: "M12 3v10M8 21h8",
  motion: "M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0",
  kitchenette: "M5 8h14v10H5z",
  wc: "M8 4h8v16H8z",
  basin: "M4 10h16v6H4z",
  airco: "M4 8h16v8H4z",
  power: "M12 3v18",
};

export function EquipmentIcons({equipment = []}: {equipment?: EquipmentPlaceholderKey[]}) {
  const t = useTranslations();
  const keys = equipment.length > 0 ? equipment : EQUIPMENT_PLACEHOLDER_KEYS;
  const assigned = equipment.length > 0;

  return (
    <section className="border border-loxam-line bg-white p-4">
      <h2 className="text-lg font-black">{t("module.equipment")}</h2>
      <p className="mt-2 text-sm text-loxam-muted">
        {assigned ? t("module.equipmentAssigned") : t("module.equipmentNote")}
      </p>
      <ul className="mt-4 grid grid-cols-4 gap-3">
        {keys.map((key) => (
          <li
            key={key}
            className={`flex aspect-square flex-col items-center justify-center p-2 text-center ${
              assigned ? "border border-loxam-black bg-white" : "border border-dashed border-loxam-line bg-loxam-paper"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8 stroke-loxam-black" fill="none" strokeWidth="2">
              <path d={icons[key]} />
            </svg>
            <span className="mt-2 text-[10px] font-bold uppercase leading-tight">
              {t(`equipment.${key}`)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
