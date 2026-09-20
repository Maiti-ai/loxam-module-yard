import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {AircoCard} from "@/components/airco/airco-card";
import {EquipmentIcons} from "@/components/equipment/equipment-icons";
import {ModulePassport} from "@/components/module/module-passport";
import {TechnicalDrawing} from "@/components/module/technical-drawing";
import {ModulePhotoGrid} from "@/components/photos/module-photo-grid";
import {ErrorState} from "@/components/ui/page-state";
import {getAircoIntervalMonths} from "@/features/air-conditioning/settings";
import {requireUser} from "@/features/auth/guard";
import {getDispatchModuleFlow} from "@/features/dispatch/queries";
import {getModuleByNumber} from "@/features/modules/queries";
import {listModulePhotos} from "@/features/module-photos/queries";
import {moduleTypeDrawingUrl} from "@/features/module-types/drawing";
import {getModuleType} from "@/features/module-types/queries";
import {roleCan} from "@/features/roles";
import {tryLoad} from "@/lib/try-load";

export default async function ModuleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{moduleNumber: string}>;
  searchParams: Promise<{scanned?: string}>;
}) {
  const profile = await requireUser();
  const t = await getTranslations();
  const {moduleNumber} = await params;
  const {scanned} = await searchParams;
  const loaded = await tryLoad(async () => {
    const yardModule = await getModuleByNumber(decodeURIComponent(moduleNumber));
    if (!yardModule) {
      return null;
    }
    const [photos, typeRecord, intervalMonths, flow] = await Promise.all([
      listModulePhotos(yardModule.id, 4),
      getModuleType(yardModule.moduleTypeCode),
      getAircoIntervalMonths(),
      getDispatchModuleFlow(yardModule.id),
    ]);
    return {yardModule, photos, typeRecord, intervalMonths, flow};
  });

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref={`/modules/${moduleNumber}`}
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

  const {yardModule, photos, typeRecord, intervalMonths, flow} = loaded.data;
  const canMove = roleCan(profile.role, "moveModules");
  const canPhotos = roleCan(profile.role, "managePhotos");
  const assignment =
    flow.kind === "none" ? null : "assignment" in flow ? flow.assignment : null;
  const actionLabel =
    flow.kind === "ready_to_ship"
      ? t("dispatch.ship")
      : flow.kind === "on_rent"
        ? t("dispatch.return")
        : t("module.move");

  return (
    <section className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <ModulePassport
        module={yardModule}
        assignment={assignment}
        emphasize={yardModule.moduleNumber === "2000" || scanned === "1"}
      />
      <AircoCard
        moduleId={yardModule.id}
        airco={yardModule.airco}
        canManage={roleCan(profile.role, "manageAirco")}
        canMaintenance={roleCan(profile.role, "updateAircoMaintenance")}
        intervalMonths={intervalMonths}
      />
      {canMove ? (
        <Link
          href={`/modules/${yardModule.moduleNumber}/move`}
          className="flex min-h-24 items-center justify-center bg-loxam-red text-2xl font-black uppercase text-white"
        >
          {actionLabel}
        </Link>
      ) : null}
      <section className="border border-loxam-line bg-white p-4">
        <h2 className="text-lg font-black">{t("module.photos")}</h2>
        <div className="mt-3">
          <ModulePhotoGrid photos={photos} />
        </div>
        <Link
          href={`/modules/${yardModule.moduleNumber}/photos`}
          className="mt-4 flex min-h-14 items-center justify-center border-2 border-loxam-black text-sm font-black uppercase"
        >
          {t("module.viewPhotos")}
        </Link>
        {canPhotos ? (
          <Link
            href={`/modules/${yardModule.moduleNumber}/photos`}
            className="mt-3 flex min-h-16 items-center justify-center bg-loxam-black text-sm font-black uppercase text-white"
          >
            {t("photos.add")}
          </Link>
        ) : null}
      </section>
      <EquipmentIcons equipment={typeRecord?.equipment ?? []} />
      <TechnicalDrawing
        typeCode={yardModule.typeCode?.trim() || ""}
        typeNumber={yardModule.typeCode}
        drawingUrl={moduleTypeDrawingUrl(yardModule.typeCode)}
        drawingMimeType={moduleTypeDrawingUrl(yardModule.typeCode) ? "image/png" : null}
      />
      <Link
        href={`/modules/${yardModule.moduleNumber}/history`}
        className="flex min-h-14 items-center justify-center border-2 border-loxam-black bg-white text-sm font-black uppercase"
      >
        {t("module.viewHistory")}
      </Link>
    </section>
  );
}
