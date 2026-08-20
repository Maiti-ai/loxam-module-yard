import {getTranslations} from "next-intl/server";
import {MoveWizard} from "@/components/move/move-wizard";
import {ExitProductionFlow} from "@/components/dispatch/exit-production-flow";
import {PlacementInstruction} from "@/components/dispatch/placement-instruction";
import {ErrorState} from "@/components/ui/page-state";
import {isProductionBlock} from "@/config/yard";
import {requireUser} from "@/features/auth/guard";
import {getPendingDispatchAssignment, listOpenDispatchDossiers} from "@/features/dispatch/queries";
import {getModuleByNumber} from "@/features/modules/queries";
import {roleCan} from "@/features/roles";
import {getYardSnapshot} from "@/features/yard-locations/queries";
import {tryLoad} from "@/lib/try-load";

export default async function MoveModulePage({
  params,
}: {
  params: Promise<{moduleNumber: string}>;
}) {
  const profile = await requireUser();
  const t = await getTranslations();
  const {moduleNumber} = await params;

  if (!roleCan(profile.role, "moveModules")) {
    return (
      <ErrorState
        title={t("errors.FORBIDDEN")}
        body={t("errors.FORBIDDEN")}
        retryHref={`/modules/${moduleNumber}`}
        retryLabel={t("common.back")}
      />
    );
  }

  const loaded = await tryLoad(async () => {
    const yardModule = await getModuleByNumber(decodeURIComponent(moduleNumber));
    if (!yardModule) {
      return null;
    }
    const [snapshot, pending, openDossiers] = await Promise.all([
      getYardSnapshot(),
      getPendingDispatchAssignment(yardModule.id),
      listOpenDispatchDossiers(),
    ]);
    return {yardModule, snapshot, pending, openDossiers};
  });

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref={`/modules/${moduleNumber}/move`}
        retryLabel={t("common.retry")}
      />
    );
  }

  if (!loaded.data) {
    return (
      <ErrorState
        title={t("errors.NOT_FOUND")}
        body={t("scan.notFound")}
        retryHref="/scan"
        retryLabel={t("nav.scan")}
      />
    );
  }

  const {yardModule, snapshot, pending, openDossiers} = loaded.data;

  return (
    <section className="mx-auto w-full max-w-[2400px] px-3 py-6 sm:px-4">
      {pending ? (
        <PlacementInstruction module={yardModule} assignment={pending} />
      ) : isProductionBlock(yardModule.location?.blockCode ?? "") ? (
        <ExitProductionFlow module={yardModule} snapshot={snapshot} openDossiers={openDossiers} />
      ) : (
        <MoveWizard module={yardModule} snapshot={snapshot} />
      )}
    </section>
  );
}
