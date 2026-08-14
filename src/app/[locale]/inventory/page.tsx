import {getLocale, getTranslations} from "next-intl/server";
import {InventoryTable} from "@/components/inventory/inventory-table";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {listModuleSummaries} from "@/features/modules/queries";
import {tryLoad} from "@/lib/try-load";

export default async function InventoryPage() {
  await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const loaded = await tryLoad(listModuleSummaries);

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/inventory"
        retryLabel={t("common.retry")}
      />
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black">{t("inventory.title")}</h1>
          <p className="mt-3 max-w-xl text-base text-loxam-muted">{t("inventory.subtitle")}</p>
        </div>
        <a
          href={`/api/inventory/export?locale=${locale}`}
          className="inline-flex min-h-14 items-center bg-loxam-red px-5 text-sm font-black uppercase text-white"
        >
          {t("inventory.export")}
        </a>
      </div>
      <div className="mt-8">
        <InventoryTable modules={loaded.data} />
      </div>
    </section>
  );
}
