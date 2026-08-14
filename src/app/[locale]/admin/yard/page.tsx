import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {YardAdminForm} from "@/components/admin/yard-admin-form";
import {ErrorState} from "@/components/ui/page-state";
import {requireUser} from "@/features/auth/guard";
import {roleCan} from "@/features/roles";
import {getYardSnapshot} from "@/features/yard-locations/queries";
import {tryLoad} from "@/lib/try-load";

export default async function AdminYardPage() {
  const profile = await requireUser();
  const t = await getTranslations();

  if (!roleCan(profile.role, "manageYardLayout")) {
    return (
      <ErrorState
        title={t("errors.FORBIDDEN")}
        body={t("errors.FORBIDDEN")}
        retryHref="/"
        retryLabel={t("nav.home")}
      />
    );
  }

  const loaded = await tryLoad(getYardSnapshot);
  if (!loaded.ok) {
    return (
      <ErrorState
        title={t("errors.title")}
        body={t("errors.LOAD_FAILED")}
        retryHref="/admin/yard"
        retryLabel={t("common.retry")}
      />
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-4xl font-black">{t("admin.yardTitle")}</h1>
      <p className="mt-3">
        <Link href="/types" className="text-sm font-black uppercase">
          {t("types.title")}
        </Link>
      </p>
      <div className="mt-6">
        <YardAdminForm blocks={loaded.data.blocks} />
      </div>
    </section>
  );
}
