import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl font-black tracking-tight text-loxam-black">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-loxam-muted">
        {t("body")}
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-14 items-center bg-loxam-red px-5 text-sm font-black tracking-wide text-white uppercase"
      >
        {t("back")}
      </Link>
    </section>
  );
}
