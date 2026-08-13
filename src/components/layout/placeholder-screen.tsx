import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";

type PlaceholderScreenProps = {
  titleKey: "nav.modules" | "nav.yard" | "nav.movements" | "nav.inventory" | "nav.login";
};

export async function PlaceholderScreen({titleKey}: PlaceholderScreenProps) {
  const t = await getTranslations();

  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-muted uppercase">
        {t(titleKey)}
      </p>
      <h1 className="mt-4 text-4xl font-black tracking-tight text-loxam-black">
        {t("placeholder.title")}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-loxam-muted">
        {t("placeholder.body")}
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex bg-loxam-yellow px-4 py-2 text-sm font-bold tracking-wide text-loxam-black uppercase"
      >
        {t("placeholder.back")}
      </Link>
    </section>
  );
}
