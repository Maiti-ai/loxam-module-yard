import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getDashboardStats, listModuleSummaries} from "@/features/modules/queries";
import {tryLoad} from "@/lib/try-load";

export default async function HomePage() {
  const profile = await requireUser();
  const t = await getTranslations();
  const loaded = await tryLoad(() =>
    Promise.all([getDashboardStats(), listModuleSummaries()]),
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

  const [stats, modules] = loaded.data;
  const showcase = modules.some((module) => module.moduleNumber === "2000");
  const isAdmin = profile.role === "ADMIN";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
        {t("dashboard.hello")}
      </p>
      <h1 className="mt-2 text-4xl font-black">{t("brand.product")}</h1>

      <Link
        href="/scan"
        className="mt-8 flex min-h-40 flex-col justify-center border-4 border-loxam-black bg-loxam-red px-6 py-8 text-white shadow-[8px_8px_0_0_#161616]"
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
        <Link href="/movements" className="flex min-h-20 items-center border-2 border-loxam-black bg-white px-4 text-lg font-black uppercase">
          {t("dashboard.movements")}
        </Link>
      </div>

      {showcase ? (
        <Link href="/modules/2000" className="mt-6 block border border-loxam-line bg-white p-5">
          <p className="text-xs font-bold uppercase text-loxam-muted">Showcase</p>
          <p className="mt-1 text-3xl font-black">Module 2000</p>
        </Link>
      ) : null}

      {isAdmin ? (
        <section className="mt-8 border border-loxam-line bg-white p-5">
          <h2 className="text-lg font-black">{t("dashboard.statsTitle")}</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <li className="border border-loxam-line p-3">
              <p className="text-3xl font-black">{stats.total}</p>
              <p className="mt-1 text-xs font-bold uppercase text-loxam-muted">{t("dashboard.inYard")}</p>
            </li>
            <li className="border border-loxam-line p-3">
              <p className="text-3xl font-black">{stats.available}</p>
              <p className="mt-1 text-xs font-bold uppercase text-loxam-muted">{t("dashboard.available")}</p>
            </li>
            <li className="border border-loxam-line p-3">
              <p className="text-3xl font-black">{stats.rented}</p>
              <p className="mt-1 text-xs font-bold uppercase text-loxam-muted">{t("dashboard.rented")}</p>
            </li>
            <li className="border border-loxam-line p-3">
              <p className="text-3xl font-black">{stats.occupiedSlots}</p>
              <p className="mt-1 text-xs font-bold uppercase text-loxam-muted">{t("dashboard.occupied")}</p>
            </li>
            <li className="border border-loxam-line p-3">
              <p className="text-3xl font-black">{stats.freeSlots}</p>
              <p className="mt-1 text-xs font-bold uppercase text-loxam-muted">{t("dashboard.free")}</p>
            </li>
            <li className="border border-loxam-line p-3">
              <p className="text-3xl font-black">{stats.withoutLocation}</p>
              <p className="mt-1 text-xs font-bold uppercase text-loxam-muted">{t("dashboard.unlocated")}</p>
            </li>
          </ul>
          <p className="mt-4 text-xs font-bold text-loxam-muted">{t("dashboard.aircoUnknown")}</p>
        </section>
      ) : null}
    </div>
  );
}
