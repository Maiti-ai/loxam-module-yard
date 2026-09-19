import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getDashboardStats, listModuleSummaries} from "@/features/modules/queries";
import {listMovements} from "@/features/movements/queries";
import {isDriverRole, roleCan} from "@/features/roles";
import {formatRowCode} from "@/lib/format";
import {tryLoad} from "@/lib/try-load";

export default async function HomePage() {
  const profile = await requireUser();
  const t = await getTranslations();
  const driver = isDriverRole(profile.role);
  const loaded = await tryLoad(() =>
    Promise.all([
      getDashboardStats(),
      listModuleSummaries(),
      driver ? Promise.resolve([]) : listMovements({limit: 6}),
    ]),
  );

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/"
        retryLabel={t("common.retry")}
      />
    );
  }

  const [stats, modules, movements] = loaded.data;
  const canManageYard = roleCan(profile.role, "manageYardLayout");

  if (driver) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
          {t("dashboard.hello")}
        </p>
        <h1 className="mt-2 text-4xl font-black">{t("brand.product")}</h1>
        <Link
          href="/scan"
          className="mt-8 flex min-h-48 flex-col justify-center border-4 border-loxam-black bg-loxam-red px-6 py-10 text-white"
        >
          <p className="text-sm font-black uppercase tracking-[0.2em]">{t("nav.scan")}</p>
          <p className="mt-2 text-5xl font-black uppercase">{t("dashboard.scanTitle")}</p>
        </Link>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/yard"
            className="flex min-h-24 items-center justify-center border-4 border-loxam-black bg-white text-2xl font-black uppercase"
          >
            {t("dashboard.yard")}
          </Link>
          <Link
            href="/modules"
            className="flex min-h-24 items-center justify-center border-4 border-loxam-black bg-white text-2xl font-black uppercase"
          >
            {t("dashboard.search")}
          </Link>
          <Link
            href="/dossiers"
            className="flex min-h-24 items-center justify-center border-4 border-loxam-black bg-white text-2xl font-black uppercase sm:col-span-2"
          >
            {t("dashboard.dossiers")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
        {t("dashboard.hello")}
      </p>
      <h1 className="mt-2 text-4xl font-black">{t("brand.product")}</h1>

      <Link
        href="/scan"
        className="mt-8 flex min-h-36 flex-col justify-center border-4 border-loxam-black bg-loxam-red px-6 py-8 text-white"
      >
        <p className="text-sm font-black uppercase tracking-[0.2em]">{t("nav.scan")}</p>
        <p className="mt-2 text-4xl font-black uppercase">{t("dashboard.scanTitle")}</p>
        <p className="mt-3 max-w-lg text-base text-white/90">{t("dashboard.scanBody")}</p>
      </Link>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/yard" className="flex min-h-20 items-center border-2 border-loxam-black bg-white px-4 text-lg font-black uppercase">
          {t("dashboard.yard")}
        </Link>
        <Link href="/modules" className="flex min-h-20 items-center border-2 border-loxam-black bg-white px-4 text-lg font-black uppercase">
          {t("dashboard.search")}
        </Link>
        <Link href="/inventory" className="flex min-h-20 items-center border-2 border-loxam-black bg-white px-4 text-lg font-black uppercase">
          {t("dashboard.inventory")}
        </Link>
        <Link href="/airco" className="flex min-h-20 items-center border-2 border-loxam-black bg-white px-4 text-lg font-black uppercase">
          {t("nav.airco")}
        </Link>
        <Link href="/dossiers" className="flex min-h-20 items-center border-2 border-loxam-black bg-white px-4 text-lg font-black uppercase">
          {t("dashboard.dossiers")}
        </Link>
      </div>

      <section className="mt-8 border border-loxam-line bg-white p-5">
        <h2 className="text-lg font-black">{t("dashboard.statsTitle")}</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat value={stats.totalCapacity} label={t("dashboard.totalCapacity")} />
          <Stat value={stats.occupiedSlots} label={t("dashboard.occupied")} />
          <Stat value={stats.freeSlots} label={t("dashboard.free")} />
          <Stat value={stats.total} label={t("dashboard.inYard")} />
          <Stat value={stats.available} label={t("dashboard.available")} />
          <Stat value={stats.rented} label={t("dashboard.rented")} />
          <Stat value={stats.withoutLocation} label={t("dashboard.unlocated")} />
        </ul>
        <p className="mt-4 text-xs font-bold text-loxam-muted">{t("dashboard.aircoUnknown")}</p>
      </section>

      {movements.length > 0 ? (
        <section className="mt-6 border border-loxam-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">{t("dashboard.movements")}</h2>
            <Link href="/movements" className="text-sm font-black uppercase">
              {t("common.open")}
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {movements.slice(0, 5).map((movement) => (
              <li key={movement.id} className="flex justify-between gap-3 text-sm font-bold">
                <Link href={`/modules/${movement.moduleNumber}`}>{movement.moduleNumber}</Link>
                <span className="text-loxam-muted">
                  {movement.to
                    ? `${movement.to.blockCode} / ${formatRowCode(movement.to.rowCode)}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManageYard ? (
        <Link
          href="/admin/yard"
          className="mt-6 flex min-h-16 items-center justify-center border-2 border-loxam-black bg-white text-sm font-black uppercase"
        >
          {t("admin.yardTitle")}
        </Link>
      ) : null}

      {modules.some((module) => module.moduleNumber === "2000") ? (
        <Link href="/modules/2000" className="mt-4 block text-center text-xs font-bold uppercase text-loxam-muted">
          Module 2000
        </Link>
      ) : null}
    </div>
  );
}

function Stat({value, label}: {value: number; label: string}) {
  return (
    <li className="border border-loxam-line p-3">
      <p className="text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase text-loxam-muted">{label}</p>
    </li>
  );
}
