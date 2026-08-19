import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {PhotoHistoryList} from "@/components/photos/module-photo-grid";
import {PhotoUploader} from "@/components/photos/photo-uploader";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getModuleByNumber} from "@/features/modules/queries";
import {listModulePhotos} from "@/features/module-photos/queries";
import {canDeleteModulePhotos, roleCan} from "@/features/roles";
import {tryLoad} from "@/lib/try-load";

export default async function ModulePhotosPage({
  params,
}: {
  params: Promise<{moduleNumber: string}>;
}) {
  const profile = await requireUser();
  const t = await getTranslations();
  const {moduleNumber} = await params;
  const loaded = await tryLoad(async () => {
    const yardModule = await getModuleByNumber(decodeURIComponent(moduleNumber));
    if (!yardModule) {
      return null;
    }
    const photos = await listModulePhotos(yardModule.id);
    return {yardModule, photos};
  });

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref={`/modules/${moduleNumber}/photos`}
        retryLabel={t("common.retry")}
      />
    );
  }

  if (!loaded.data) {
    return (
      <ErrorState
        title={t("errors.NOT_FOUND")}
        body={t("scan.notFound")}
        retryHref="/modules"
        retryLabel={t("common.back")}
      />
    );
  }

  const {yardModule, photos} = loaded.data;
  const canPhotos = roleCan(profile.role, "managePhotos");
  const canDelete = canDeleteModulePhotos(profile.role);

  return (
    <section className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <Link href={`/modules/${yardModule.moduleNumber}`} className="text-sm font-black uppercase">
        {t("common.back")}
      </Link>
      <h1 className="text-3xl font-black">
        {t("module.label")} {yardModule.moduleNumber}
      </h1>
      <h2 className="text-xl font-black">{t("photos.history")}</h2>
      {canPhotos ? <PhotoUploader moduleId={yardModule.id} /> : null}
      <PhotoHistoryList photos={photos} canDelete={canDelete} />
    </section>
  );
}
