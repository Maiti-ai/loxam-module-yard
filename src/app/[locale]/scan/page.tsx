import {getTranslations} from "next-intl/server";
import {NFCScanner} from "@/components/nfc/nfc-scanner";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {listModuleSummaries} from "@/features/modules/queries";
import {tryLoad} from "@/lib/try-load";

export default async function ScanPage() {
  await requireUser();
  const t = await getTranslations();
  const loaded = await tryLoad(listModuleSummaries);

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/scan"
        retryLabel={t("common.retry")}
      />
    );
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-4xl font-black">{t("scan.title")}</h1>
      <p className="mt-3 text-base text-loxam-muted">{t("scan.subtitle")}</p>
      <div className="mt-8">
        <NFCScanner demoNumbers={loaded.data.map((module) => module.moduleNumber)} />
      </div>
    </section>
  );
}
