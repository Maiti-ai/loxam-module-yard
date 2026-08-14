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
import {getModuleByNumber} from "@/features/modules/queries";
import {listModulePhotos} from "@/features/module-photos/queries";
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
    const [photos, typeRecord, intervalMonths] = await Promise.all([
      listModulePhotos(yardModule.id, 4),
      getModuleType(yardModule.moduleTypeCode),
      getAircoIntervalMonths(),
    ]);
    return {yardModule, photos, typeRecord, intervalMonths};
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

  const {yardModule, photos, typeRecord, intervalMonths} = loaded.data;
  const canMove = roleCan(profile.role, "moveModules");
  const canPhotos = roleCan(profile.role, "managePhotos");

  return (
    <section className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <ModulePassport
        module={yardModule}
        emphasize={yardModule.moduleNumber === "2000" || scanned === "1"}
      />
      {canMove ? (
        <Link
          href={`/modules/${yardModule.moduleNumber}/move`}
          className="flex min-h-24 items-center justify-center bg-loxam-red text-2xl font-black uppercase text-white"
        >
          {t("module.move")}
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
      <AircoCard
        moduleId={yardModule.id}
        airco={yardModule.airco}
        canManage={roleCan(profile.role, "manageAirco")}
        canMaintenance={roleCan(profile.role, "updateAircoMaintenance")}
        intervalMonths={intervalMonths}
      />
      <EquipmentIcons equipment={typeRecord?.equipment ?? []} />
      <TechnicalDrawing
        typeCode={yardModule.moduleTypeCode}
        typeNumber={yardModule.moduleTypeNumber}
        drawingUrl={typeRecord?.drawingUrl ?? null}
        drawingMimeType={typeRecord?.drawingMimeType ?? null}
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
