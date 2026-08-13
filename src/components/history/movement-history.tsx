"use client";

import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {formatDateTime, formatYardLocation} from "@/lib/format";
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
    <ul className="space-y-3">
      {movements.map((movement) => (
        <li key={movement.id} className="border border-loxam-line bg-white p-4">
          <p className="text-xs font-bold uppercase text-loxam-muted">
            {formatDateTime(movement.movedAt, locale)}
          </p>
          {showModule ? (
            <Link
              href={`/modules/${movement.moduleNumber}`}
              className="mt-1 block text-2xl font-black"
            >
              {movement.moduleNumber}
            </Link>
          ) : null}
          <p className="mt-2 text-sm font-bold">
            {movement.from
              ? formatYardLocation({...movement.from, locale})
              : t("common.dash")}
            {" → "}
            {movement.to ? formatYardLocation({...movement.to, locale}) : t("common.dash")}
          </p>
          <p className="mt-1 text-xs text-loxam-muted">
            {t("history.user")}: {movement.moverName || t("history.unknownUser")}
          </p>
        </li>
      ))}
    </ul>
  );
}
