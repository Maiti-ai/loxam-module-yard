"use client";

import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {ModuleStatusBadge} from "@/components/module/module-status";
import {formatDimensions, formatYardLocation} from "@/lib/format";
import type {ModuleSummary} from "@/features/yard-locations/types";

export function ModuleCard({
  module,
  href,
  emphasize = false,
}: {
  module: ModuleSummary;
  href?: string;
  emphasize?: boolean;
}) {
  const t = useTranslations("module");
  const locale = useLocale();
  const location = module.location
    ? formatYardLocation({...module.location, locale})
    : t("noLocation");

  const content = (
    <article
      className={`border bg-white p-4 ${
        emphasize ? "border-loxam-red shadow-[6px_6px_0_0_#c41e3a]" : "border-loxam-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-loxam-muted uppercase">
            {t("label")}
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-loxam-black">
            {module.moduleNumber}
          </h2>
        </div>
        <ModuleStatusBadge status={module.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-bold tracking-wide text-loxam-muted uppercase">
            {t("type")}
          </dt>
          <dd className="mt-1 font-bold">{module.moduleTypeCode}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold tracking-wide text-loxam-muted uppercase">
            {t("dimensions")}
          </dt>
          <dd className="mt-1 font-bold">
            {formatDimensions(module.lengthM, module.widthM)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-bold tracking-wide text-loxam-muted uppercase">
            {t("location")}
          </dt>
          <dd className="mt-1 font-bold">{location}</dd>
        </div>
        {module.rentedToProject ? (
          <div className="col-span-2">
            <dt className="text-xs font-bold tracking-wide text-loxam-muted uppercase">
              {t("project")}
            </dt>
            <dd className="mt-1 font-bold">{module.rentedToProject}</dd>
          </div>
        ) : null}
        {module.notes ? (
          <div className="col-span-2">
            <dt className="text-xs font-bold tracking-wide text-loxam-muted uppercase">
              {t("notes")}
            </dt>
            <dd className="mt-1 font-bold">{module.notes}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
