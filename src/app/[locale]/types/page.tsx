import {getTranslations} from "next-intl/server";
import {TechnicalDrawing} from "@/components/module/technical-drawing";
import {EquipmentIcons} from "@/components/equipment/equipment-icons";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {listModuleTypes} from "@/features/module-types/queries";
import {formatDimensions, formatTypeLabel} from "@/lib/format";
import {tryLoad} from "@/lib/try-load";

export default async function ModuleTypesPage() {
  await requireUser();
  const t = await getTranslations();
  const loaded = await tryLoad(listModuleTypes);

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/types"
        retryLabel={t("common.retry")}
      />
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-4xl font-black">{t("types.title")}</h1>
      <p className="text-sm text-loxam-muted">{t("types.subtitle")}</p>
      {loaded.data.map((type) => (
        <article key={type.id} className="space-y-4 border-4 border-loxam-black bg-white p-5">
          <h2 className="text-3xl font-black">{formatTypeLabel(type.typeNumber, type.code)}</h2>
          <p className="text-lg font-bold">{formatDimensions(type.lengthM, type.widthM)}</p>
          <TechnicalDrawing
            typeCode={type.code}
            typeNumber={type.typeNumber}
            drawingUrl={type.drawingUrl}
            drawingMimeType={type.drawingMimeType}
          />
          <EquipmentIcons equipment={type.equipment} />
        </article>
      ))}
    </section>
  );
}
