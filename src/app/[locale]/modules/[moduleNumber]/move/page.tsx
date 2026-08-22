import {getTranslations} from "next-intl/server";
import {MoveWizard} from "@/components/move/move-wizard";
import {PlacementInstruction} from "@/components/dispatch/placement-instruction";
import {ProductionHoldNotice} from "@/components/dispatch/production-hold-notice";
import {ToProductionMove} from "@/components/dispatch/to-production-move";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getDispatchModuleFlow} from "@/features/dispatch/queries";
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
    const [snapshot, flow] = await Promise.all([
      getYardSnapshot(),
      getDispatchModuleFlow(yardModule.id),
    ]);
    return {yardModule, snapshot, flow};
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

  const {yardModule, snapshot, flow} = loaded.data;

  return (
    <section className="mx-auto w-full max-w-[2400px] px-3 py-6 sm:px-4">
      {flow.kind === "to_production" ? (
        <ToProductionMove module={yardModule} snapshot={snapshot} assignment={flow.assignment} />
      ) : flow.kind === "in_production" ? (
        <ProductionHoldNotice module={yardModule} assignment={flow.assignment} />
      ) : flow.kind === "ready_for_dispatch" ? (
        <PlacementInstruction module={yardModule} assignment={flow.assignment} snapshot={snapshot} />
      ) : (
        <MoveWizard module={yardModule} snapshot={snapshot} />
      )}
    </section>
  );
}
