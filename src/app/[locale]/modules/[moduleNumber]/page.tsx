import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {AircoCard} from "@/components/airco/airco-card";
import {EquipmentIcons} from "@/components/equipment/equipment-icons";
import {ModuleCard} from "@/components/module/module-card";
import {TechnicalDrawingPlaceholder} from "@/components/module/technical-drawing";
import {ModulePhotoGrid} from "@/components/photos/module-photo-grid";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getModuleByNumber} from "@/features/modules/queries";
import {listModulePhotos} from "@/features/module-photos/queries";
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
    const photos = await listModulePhotos(yardModule.id, 4);
    return {yardModule, photos};
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

  const {yardModule, photos} = loaded.data;
  const canMove = roleCan(profile.role, "moveModules");
  const canPhotos = roleCan(profile.role, "managePhotos");

  return (
    <section className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <ModuleCard module={yardModule} emphasize={yardModule.moduleNumber === "2000" || scanned === "1"} />
      {canMove ? (
        <Link
          href={`/modules/${yardModule.moduleNumber}/move`}
          className="flex min-h-20 items-center justify-center bg-loxam-red text-2xl font-black uppercase text-white"
        >
          {t("module.move")}
        </Link>
      ) : null}
      <section className="border border-loxam-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">{t("module.photos")}</h2>
          <Link href={`/modules/${yardModule.moduleNumber}/photos`} className="text-sm font-black uppercase">
            {t("module.viewPhotos")}
          </Link>
        </div>
        <ModulePhotoGrid photos={photos} />
        {canPhotos ? (
          <Link
            href={`/modules/${yardModule.moduleNumber}/photos`}
            className="mt-4 flex min-h-14 items-center justify-center border-2 border-loxam-black text-sm font-black uppercase"
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
      />
      <EquipmentIcons />
      <TechnicalDrawingPlaceholder />
      <Link
        href={`/modules/${yardModule.moduleNumber}/history`}
        className="flex min-h-14 items-center justify-center border-2 border-loxam-black bg-white text-sm font-black uppercase"
      >
        {t("module.viewHistory")}
      </Link>
    </section>
  );
}
