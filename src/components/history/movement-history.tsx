"use client";

import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {formatCompactLocation, formatDateTime} from "@/lib/format";
import type {MovementRecord} from "@/features/movements/queries";

export function MovementHistory({
  movements,
  showModule = false,
}: {
  movements: MovementRecord[];
  showModule?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();

  if (movements.length === 0) {
    return (
      <p className="border border-dashed border-loxam-line bg-white p-6 text-sm font-bold text-loxam-muted">
        {t("history.empty")}
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {movements.map((movement) => (
        <li key={movement.id} className="border-l-4 border-loxam-red bg-white p-4">
          <p className="text-sm font-black uppercase tracking-wide text-loxam-muted">
            {formatDateTime(movement.movedAt, locale)}
          </p>
          {showModule ? (
            <Link
              href={`/modules/${movement.moduleNumber}`}
              className="mt-1 block text-3xl font-black"
            >
              {movement.moduleNumber}
            </Link>
          ) : null}
          <div className="mt-3 grid gap-2 text-lg font-black sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <p>
              {movement.from
                ? formatCompactLocation({...movement.from, locale})
                : t("common.dash")}
            </p>
            <p className="text-loxam-red">→</p>
            <p>
              {movement.to ? formatCompactLocation({...movement.to, locale}) : t("common.dash")}
            </p>
          </div>
          <p className="mt-3 text-sm font-bold text-loxam-muted">
            {t("history.user")}: {movement.moverName || t("history.unknownUser")}
          </p>
        </li>
      ))}
    </ol>
  );
}
