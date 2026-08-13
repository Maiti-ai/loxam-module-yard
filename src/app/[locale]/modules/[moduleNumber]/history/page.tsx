import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {MovementHistory} from "@/components/history/movement-history";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {getModuleByNumber} from "@/features/modules/queries";
import {listMovements} from "@/features/movements/queries";
import {tryLoad} from "@/lib/try-load";

export default async function ModuleHistoryPage({
  params,
}: {
  params: Promise<{moduleNumber: string}>;
}) {
  await requireUser();
  const t = await getTranslations();
  const {moduleNumber} = await params;
  const loaded = await tryLoad(async () => {
    const yardModule = await getModuleByNumber(decodeURIComponent(moduleNumber));
    if (!yardModule) {
      return null;
    }
    const movements = await listMovements({moduleId: yardModule.id, limit: 50});
    return {yardModule, movements};
  });

  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref={`/modules/${moduleNumber}/history`}
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

  return (
    <section className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <Link href={`/modules/${loaded.data.yardModule.moduleNumber}`} className="text-sm font-black uppercase">
        {t("common.back")}
      </Link>
      <h1 className="text-3xl font-black">
        {t("module.label")} {loaded.data.yardModule.moduleNumber}
      </h1>
      <h2 className="text-xl font-black">{t("history.title")}</h2>
      <MovementHistory movements={loaded.data.movements} />
    </section>
  );
}
