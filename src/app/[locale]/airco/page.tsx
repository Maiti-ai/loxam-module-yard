import {getLocale, getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {AircoIntervalForm} from "@/components/airco/airco-interval-form";
import {ErrorState} from "@/components/ui/page-state";
import {getAircoIntervalMonths} from "@/features/air-conditioning/settings";
import {
  getMaintenanceState,
  getNextMaintenanceDate,
  remainingMaintenanceLabel,
} from "@/features/air-conditioning/status";
import {requireUser} from "@/features/auth/guard";
import {listModuleSummaries} from "@/features/modules/queries";
import {roleCan} from "@/features/roles";
import {formatDate} from "@/lib/format";
import {tryLoad} from "@/lib/try-load";

export default async function AircoOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{state?: string}>;
}) {
  const profile = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const {state: stateFilter} = await searchParams;
  const loaded = await tryLoad(async () => {
    const [modules, intervalMonths] = await Promise.all([
      listModuleSummaries(),
      getAircoIntervalMonths(),
    ]);
    return {modules, intervalMonths};
  });

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

  const {modules, intervalMonths} = loaded.data;
  const rows = modules
    .filter((module) => module.airco)
    .map((module) => {
      const state = getMaintenanceState(module.airco?.lastMaintenanceAt ?? null, intervalMonths);
      return {module, state};
    })
    .filter((row) => {
      if (!stateFilter || stateFilter === "all") {
        return true;
      }
      return row.state === stateFilter;
    })
    .sort((a, b) => {
      const order = {OVERDUE: 0, DUE_SOON: 1, OK: 2, UNKNOWN: 3};
      return order[a.state] - order[b.state];
    });

  const filters = [
    {value: "all", label: t("inventory.all")},
    {value: "OVERDUE", label: t("airco.stateOverdue")},
    {value: "DUE_SOON", label: t("airco.stateDueSoon")},
    {value: "OK", label: t("airco.stateOk")},
    {value: "UNKNOWN", label: t("airco.stateUnknown")},
  ];

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-black">{t("airco.overview")}</h1>
      <p className="mt-3 text-sm text-loxam-muted">
        {intervalMonths
          ? t("airco.intervalSet", {months: intervalMonths})
          : t("airco.legendNote")}
      </p>
      {roleCan(profile.role, "manageSettings") ? (
        <div className="mt-4">
          <AircoIntervalForm current={intervalMonths} />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-black uppercase">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "all" ? "/airco" : `/airco?state=${filter.value}`}
            className={`px-3 py-2 ${
              (stateFilter || "all") === filter.value
                ? "bg-loxam-black text-white"
                : "border border-loxam-line bg-white"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>
      <ul className="mt-6 space-y-3">
        {rows.map(({module, state}) => {
          const label =
            state === "OK"
              ? t("airco.stateOk")
              : state === "DUE_SOON"
                ? t("airco.stateDueSoon")
                : state === "OVERDUE"
                  ? t("airco.stateOverdue")
                  : t("airco.stateUnknown");
          const next = getNextMaintenanceDate(module.airco?.lastMaintenanceAt ?? null, intervalMonths);
          const remaining = remainingMaintenanceLabel(
            module.airco?.lastMaintenanceAt ?? null,
            intervalMonths,
            locale,
          );
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
                <p className="mt-1 text-sm font-bold">
                  {t("airco.next")}:{" "}
                  {next ? `${formatDate(next, locale)}${remaining ? ` · ${remaining}` : ""}` : t("airco.nextUnknown")}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
