import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {listDispatchDossiers} from "@/features/dispatch/queries";
import {roleCan} from "@/features/roles";
import {tryLoad} from "@/lib/try-load";

export default async function DossiersPage() {
  const profile = await requireUser();
  const t = await getTranslations();
  const canPlan = roleCan(profile.role, "planDispatch");
  const loaded = await tryLoad(listDispatchDossiers);

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/dossiers"
        retryLabel={t("common.retry")}
      />
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-black">{t("dispatch.listTitle")}</h1>
      <p className="mt-3 text-base text-loxam-muted">{t("dispatch.listBody")}</p>
      {canPlan ? (
        <Link
          href="/dossiers/new"
          className="mt-6 flex min-h-16 items-center justify-center border-4 border-loxam-black bg-loxam-red px-5 text-lg font-black uppercase text-white"
        >
          {t("dispatch.createNew")}
        </Link>
      ) : null}
      {loaded.data.length === 0 ? (
        <p className="mt-8 border border-dashed border-loxam-line bg-white p-6 font-bold text-loxam-muted">
          {t("dispatch.empty")}
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {loaded.data.map((dossier) => (
            <Link
              key={dossier.id}
              href={`/dossiers/${dossier.id}`}
              className="block border-4 border-loxam-black bg-white p-5"
            >
              <p className="text-3xl font-black">{dossier.dossierNumber}</p>
              <p className="mt-2 text-xl font-black">{dossier.customerName}</p>
              <p className="text-lg font-bold text-loxam-muted">{dossier.siteLocation}</p>
              <p className="mt-3 text-lg font-black">
                {t("dispatch.productionProgress", {
                  count: dossier.inProductionCount,
                  total: dossier.totalModules,
                })}
              </p>
              <p className="text-lg font-black">
                {t("dispatch.dispatchProgress", {
                  count: dossier.placedCount,
                  total: dossier.totalModules,
                })}
              </p>
              <p className="mt-1 text-sm font-black uppercase text-loxam-muted">
                {t(`dispatch.status.${dossier.status}`)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
