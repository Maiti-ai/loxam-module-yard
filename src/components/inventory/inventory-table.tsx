"use client";

import {useMemo, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {ModuleStatusBadge} from "@/components/module/module-status";
import {formatDateTime, formatDimensions, formatLevelCode} from "@/lib/format";
import type {ModuleSummary} from "@/features/yard-locations/types";

type FilterOption = {value: string; label: string};

export function InventoryTable({modules}: {modules: ModuleSummary[]}) {
  const t = useTranslations();
  const locale = useLocale();
  const [block, setBlock] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [location, setLocation] = useState("all");

  const blocks = useMemo(
    () =>
      Array.from(
        new Set(modules.map((module) => module.location?.blockCode).filter(Boolean)),
      ) as string[],
    [modules],
  );

  const rows = modules.filter((module) => {
    if (block !== "all" && module.location?.blockCode !== block) return false;
    if (type !== "all" && module.moduleTypeCode !== type) return false;
    if (status !== "all" && module.status !== status) return false;
    if (location === "located" && !module.location) return false;
    if (location === "unlocated" && module.location) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Filter
          label={t("inventory.filterBlock")}
          value={block}
          onChange={setBlock}
          options={[
            {value: "all", label: t("inventory.all")},
            ...blocks.map((code) => ({value: code, label: code})),
          ]}
        />
        <Filter
          label={t("inventory.filterType")}
          value={type}
          onChange={setType}
          options={[
            {value: "all", label: t("inventory.all")},
            {value: "6x3", label: "6x3"},
            {value: "3x3", label: "3x3"},
          ]}
        />
        <Filter
          label={t("inventory.filterStatus")}
          value={status}
          onChange={setStatus}
          options={[
            {value: "all", label: t("inventory.all")},
            {value: "AVAILABLE", label: t("status.AVAILABLE")},
            {value: "RENTED", label: t("status.RENTED")},
          ]}
        />
        <Filter
          label={t("inventory.filterLocation")}
          value={location}
          onChange={setLocation}
          options={[
            {value: "all", label: t("inventory.all")},
            {value: "located", label: t("inventory.located")},
            {value: "unlocated", label: t("inventory.unlocated")},
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <p className="border border-dashed border-loxam-line bg-white p-6 font-bold text-loxam-muted">
          {t("inventory.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto border border-loxam-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-loxam-black text-white">
              <tr>
                <th className="px-3 py-3">{t("inventory.colNumber")}</th>
                <th className="px-3 py-3">{t("inventory.colType")}</th>
                <th className="px-3 py-3">{t("inventory.colSize")}</th>
                <th className="px-3 py-3">{t("inventory.colStatus")}</th>
                <th className="px-3 py-3">{t("inventory.colProject")}</th>
                <th className="px-3 py-3">{t("inventory.colBlock")}</th>
                <th className="px-3 py-3">{t("inventory.colRow")}</th>
                <th className="px-3 py-3">{t("inventory.colPos")}</th>
                <th className="px-3 py-3">{t("inventory.colLevel")}</th>
                <th className="px-3 py-3">{t("inventory.colMoved")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((module) => (
                <tr key={module.id} className="border-t border-loxam-line">
                  <td className="px-3 py-3 font-black">
                    <Link href={`/modules/${module.moduleNumber}`}>{module.moduleNumber}</Link>
                  </td>
                  <td className="px-3 py-3">{module.moduleTypeNumber || module.moduleTypeCode}</td>
                  <td className="px-3 py-3">{formatDimensions(module.lengthM, module.widthM)}</td>
                  <td className="px-3 py-3">
                    <ModuleStatusBadge status={module.status} />
                  </td>
                  <td className="px-3 py-3">{module.rentedToProject ?? "—"}</td>
                  <td className="px-3 py-3">{module.location?.blockCode ?? "—"}</td>
                  <td className="px-3 py-3">{module.location?.rowCode ?? "—"}</td>
                  <td className="px-3 py-3">{module.location?.positionCode ?? "—"}</td>
                  <td className="px-3 py-3">
                    {module.location ? formatLevelCode(module.location.level, locale) : "—"}
                  </td>
                  <td className="px-3 py-3">{formatDateTime(module.lastMovedAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase text-loxam-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-14 w-full border-2 border-loxam-black bg-white px-3 text-base font-bold"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
