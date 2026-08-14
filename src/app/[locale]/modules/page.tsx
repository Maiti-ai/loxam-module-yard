import {getTranslations} from "next-intl/server";
import {ModuleSearch} from "@/components/search/module-search";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {listModuleSummaries} from "@/features/modules/queries";
import {tryLoad} from "@/lib/try-load";

export default async function ModulesPage() {
  await requireUser();
  const t = await getTranslations();
  const loaded = await tryLoad(listModuleSummaries);

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/modules"
        retryLabel={t("common.retry")}
      />
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-black">{t("search.title")}</h1>
      <div className="mt-6">
        <ModuleSearch modules={loaded.data} />
      </div>
    </section>
  );
}
