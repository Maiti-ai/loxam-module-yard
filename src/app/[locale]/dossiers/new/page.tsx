import {getTranslations} from "next-intl/server";
import {CreateDossierWizard} from "@/components/dispatch/create-dossier-wizard";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {listOccupiedDispatchModuleIds} from "@/features/dispatch/queries";
import {listModuleSummaries} from "@/features/modules/queries";
import {roleCan} from "@/features/roles";
import {getYardSnapshot} from "@/features/yard-locations/queries";
import {tryLoad} from "@/lib/try-load";

export default async function NewDossierPage() {
  const profile = await requireUser();
  const t = await getTranslations();

  if (!roleCan(profile.role, "planDispatch")) {
    return (
      <ErrorState
        title={t("errors.FORBIDDEN")}
        body={t("errors.FORBIDDEN")}
        retryHref="/dossiers"
        retryLabel={t("nav.dossiers")}
      />
    );
  }

  const loaded = await tryLoad(async () => {
    const [snapshot, modules, occupied] = await Promise.all([
      getYardSnapshot(),
      listModuleSummaries(),
      listOccupiedDispatchModuleIds(),
    ]);
    return {snapshot, modules, occupied: Array.from(occupied)};
  });

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/dossiers/new"
        retryLabel={t("common.retry")}
      />
    );
  }

  return (
    <section className="mx-auto w-full max-w-[2400px] px-3 py-6 sm:px-4">
      <CreateDossierWizard
        snapshot={loaded.data.snapshot}
        modules={loaded.data.modules}
        occupiedModuleIds={loaded.data.occupied}
        dossier={null}
      />
    </section>
  );
}
