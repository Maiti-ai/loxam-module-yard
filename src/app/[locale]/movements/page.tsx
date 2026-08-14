import {getTranslations} from "next-intl/server";
import {MovementHistory} from "@/components/history/movement-history";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {listMovements} from "@/features/movements/queries";
import {tryLoad} from "@/lib/try-load";

export default async function MovementsPage() {
  await requireUser();
  const t = await getTranslations();
  const loaded = await tryLoad(() => listMovements({limit: 40}));

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/movements"
        retryLabel={t("common.retry")}
      />
    );
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-4xl font-black">{t("movements.title")}</h1>
      <div className="mt-6">
        <MovementHistory movements={loaded.data} showModule />
      </div>
    </section>
  );
}
