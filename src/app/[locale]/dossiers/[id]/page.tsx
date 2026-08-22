import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {CreateDossierWizard} from "@/components/dispatch/create-dossier-wizard";
import {DossierProductionOverview} from "@/components/dispatch/dossier-production-overview";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getDispatchDossier, listOccupiedDispatchModuleIds} from "@/features/dispatch/queries";
import {listModuleSummaries} from "@/features/modules/queries";
import {roleCan} from "@/features/roles";
import {getYardSnapshot} from "@/features/yard-locations/queries";
import {tryLoad} from "@/lib/try-load";

export default async function DossierDetailPage({
  params,
}: {
  params: Promise<{id: string}>;
}) {
  const profile = await requireUser();
  const t = await getTranslations();
  const {id} = await params;
  const canPlan = roleCan(profile.role, "planDispatch");
  const canMarkReady = roleCan(profile.role, "markDispatchReady");

  const loaded = await tryLoad(async () => {
    const dossier = await getDispatchDossier(id);
    if (!dossier) {
      return null;
    }
    if (dossier.status === "DRAFT") {
      if (!canPlan) {
        return {dossier, snapshot: null, modules: [], occupied: [] as string[], forbiddenDraft: true};
      }
      const [snapshot, modules, occupied] = await Promise.all([
        getYardSnapshot(),
        listModuleSummaries(),
        listOccupiedDispatchModuleIds(dossier.id),
      ]);
      return {dossier, snapshot, modules, occupied: Array.from(occupied), forbiddenDraft: false};
    }
    return {dossier, snapshot: null, modules: [], occupied: [] as string[], forbiddenDraft: false};
  });

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref={`/dossiers/${id}`}
        retryLabel={t("common.retry")}
      />
    );
  }

  if (!loaded.data) {
    return (
      <ErrorState
        title={t("errors.NOT_FOUND")}
        body={t("errors.NOT_FOUND")}
        retryHref="/dossiers"
        retryLabel={t("nav.dossiers")}
      />
    );
  }

  if (loaded.data.forbiddenDraft) {
    return (
      <ErrorState
        title={t("errors.FORBIDDEN")}
        body={t("errors.FORBIDDEN")}
        retryHref="/dossiers"
        retryLabel={t("nav.dossiers")}
      />
    );
  }

  const {dossier, snapshot, modules, occupied} = loaded.data;

  if (dossier.status === "DRAFT" && snapshot) {
    return (
      <section className="mx-auto w-full max-w-[2400px] px-3 py-6 sm:px-4">
        <CreateDossierWizard
          snapshot={snapshot}
          modules={modules}
          occupiedModuleIds={occupied}
          dossier={dossier}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/dossiers" className="text-sm font-black uppercase text-loxam-muted">
        {t("common.back")}
      </Link>
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
        {t("dispatch.dossier")}
      </p>
      <h1 className="text-4xl font-black">{dossier.dossierNumber}</h1>
      <div className="border-4 border-loxam-black bg-white p-5">
        <p className="text-sm font-bold uppercase text-loxam-muted">{t("dispatch.customer")}</p>
        <p className="text-2xl font-black">{dossier.customerName}</p>
        <p className="mt-4 text-sm font-bold uppercase text-loxam-muted">{t("dispatch.site")}</p>
        <p className="text-2xl font-black">{dossier.siteLocation}</p>
        <p className="mt-4 text-sm font-bold uppercase text-loxam-muted">{t("dispatch.totalModules")}</p>
        <p className="text-2xl font-black">{dossier.totalModules}</p>
        <p className="mt-4 text-sm font-bold uppercase text-loxam-muted">{t("module.status")}</p>
        <p className="text-2xl font-black">{t(`dispatch.status.${dossier.status}`)}</p>
        <p className="mt-4 text-lg font-black">
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
      </div>

      <section>
        <h2 className="text-lg font-black">{t("dispatch.productionOverview")}</h2>
        <div className="mt-4">
          <DossierProductionOverview dossier={dossier} canMarkReady={canMarkReady} canCancel={canPlan} />
        </div>
      </section>
    </section>
  );
}
