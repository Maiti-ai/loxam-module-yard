import {getTranslations} from "next-intl/server";
import {YardMap} from "@/components/yard/yard-map";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getYardSnapshot} from "@/features/yard-locations/queries";
import {tryLoad} from "@/lib/try-load";

export default async function YardPage() {
  await requireUser();
  const t = await getTranslations();
  const loaded = await tryLoad(getYardSnapshot);

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/yard"
        retryLabel={t("common.retry")}
      />
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-4xl font-black">{t("yard.title")}</h1>
      <p className="mt-3 max-w-2xl text-base text-loxam-muted">{t("yard.subtitle")}</p>
      <div className="mt-8">
        <YardMap snapshot={loaded.data} />
      </div>
    </section>
  );
}
