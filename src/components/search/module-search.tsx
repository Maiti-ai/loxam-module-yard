"use client";

import {useMemo, useState} from "react";
import {useTranslations} from "next-intl";
import {ModuleCard} from "@/components/module/module-card";
import {searchModules} from "@/features/modules/search";
import type {ModuleSummary} from "@/features/yard-locations/types";

export function ModuleSearch({modules}: {modules: ModuleSummary[]}) {
  const t = useTranslations("search");
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchModules(modules, query), [modules, query]);

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="sr-only">{t("placeholder")}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("placeholder")}
          className="min-h-16 w-full border-4 border-loxam-black bg-white px-4 text-2xl font-bold"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
      <p className="text-sm font-bold text-loxam-muted">{t("count", {count: results.length})}</p>
      {results.length === 0 ? (
        <p className="border border-dashed border-loxam-line bg-white p-6 font-bold text-loxam-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {results.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              href={`/modules/${module.moduleNumber}`}
              emphasize={module.moduleNumber === "2000"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
