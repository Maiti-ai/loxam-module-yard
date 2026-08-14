import {getLocale, getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getMaintenanceState} from "@/features/air-conditioning/status";
import {listModuleSummaries} from "@/features/modules/queries";
import {formatDate} from "@/lib/format";
import {tryLoad} from "@/lib/try-load";

export default async function AircoOverviewPage() {
  await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const loaded = await tryLoad(listModuleSummaries);

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/airco"
        retryLabel={t("common.retry")}
      />
    );
  }

  const rows = loaded.data.filter((module) => module.airco);

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-black">{t("airco.overview")}</h1>
      <p className="mt-3 text-sm text-loxam-muted">{t("airco.legendNote")}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-black uppercase">
        <span className="bg-loxam-free-soft px-2 py-1 text-loxam-free">{t("airco.stateOk")}</span>
        <span className="bg-loxam-rented-soft px-2 py-1 text-loxam-rented">
          {t("airco.stateDueSoon")}
        </span>
        <span className="bg-loxam-occupied-soft px-2 py-1 text-loxam-occupied">
          {t("airco.stateOverdue")}
        </span>
        <span className="bg-loxam-paper px-2 py-1">{t("airco.stateUnknown")}</span>
      </div>
      <ul className="mt-6 space-y-3">
        {rows.map((module) => {
          const state = getMaintenanceState(module.airco?.lastMaintenanceAt ?? null);
          const label =
            state === "OK"
              ? t("airco.stateOk")
              : state === "DUE_SOON"
                ? t("airco.stateDueSoon")
                : state === "OVERDUE"
                  ? t("airco.stateOverdue")
                  : t("airco.stateUnknown");
          return (
            <li key={module.id}>
              <Link
                href={`/modules/${module.moduleNumber}`}
                className="block border border-loxam-line bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-2xl font-black">{module.airco?.internalNumber}</p>
                  <span className="text-xs font-black uppercase">{label}</span>
                </div>
                <p className="mt-2 text-sm font-bold">
                  {module.airco?.brand} · {module.airco?.serialNumber}
                </p>
                <p className="mt-1 text-sm text-loxam-muted">
                  {t("module.label")} {module.moduleNumber} · {t("airco.last")}{" "}
                  {formatDate(module.airco?.lastMaintenanceAt ?? null, locale)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
