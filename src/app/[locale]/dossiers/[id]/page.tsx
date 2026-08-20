import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getDispatchDossier} from "@/features/dispatch/queries";
import {formatGroundPositionLabel, formatLevelLabel} from "@/lib/format";
import {tryLoad} from "@/lib/try-load";

export default async function DossierDetailPage({
  params,
}: {
  params: Promise<{id: string}>;
}) {
  await requireUser();
  const t = await getTranslations();
  const {id} = await params;
  const loaded = await tryLoad(() => getDispatchDossier(id));

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

  const dossier = loaded.data;

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
          {t("dispatch.modulesProgress", {
            placed: dossier.placedCount,
            total: dossier.totalModules,
          })}
        </p>
      </div>

      <section className="border-4 border-loxam-black bg-white p-5">
        <h2 className="text-lg font-black">{t("dispatch.reservedPositions")}</h2>
        <ol className="mt-4 space-y-2">
          {dossier.positions.map((position) => (
            <li key={position.id} className="text-xl font-black">
              {position.positionOrder}.{" "}
              {formatGroundPositionLabel({
                blockCode: position.blockCode,
                rowCode: position.rowCode,
                positionCode: position.positionCode,
              })}
            </li>
          ))}
        </ol>
      </section>

      <section className="border-4 border-loxam-black bg-white p-5">
        <h2 className="text-lg font-black">{t("dispatch.modules")}</h2>
        <ol className="mt-4 space-y-3">
          {dossier.slots.map((slot) => (
            <li key={slot.id} className="border-2 border-loxam-line p-3">
              <p className="text-xl font-black">
                {slot.sequenceNumber}.{" "}
                {slot.moduleNumber
                  ? `${t("module.label")} ${slot.moduleNumber}`
                  : t("dispatch.unassigned")}
              </p>
              <p className="mt-1 text-sm font-bold text-loxam-muted">
                {formatGroundPositionLabel({
                  blockCode: slot.blockCode,
                  rowCode: slot.rowCode,
                  positionCode: slot.positionCode,
                })}{" "}
                · {formatLevelLabel(slot.level)}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
