import {connection} from "next/server";
import {getLocale, getTranslations} from "next-intl/server";
import {redirect} from "@/i18n/navigation";
import {LoginForm} from "@/components/auth/login-form";
import {getCurrentProfile} from "@/features/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{error?: string}>;
}) {
  await connection();
  const t = await getTranslations();
  const locale = await getLocale();
  const {error} = await searchParams;
  const profile = await getCurrentProfile();

  if (profile) {
    redirect({href: "/", locale});
  }

  return (
    <section className="mx-auto max-w-xl px-6 py-16">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
        {t("login.eyebrow")}
      </p>
      <h1 className="mt-4 text-4xl font-black tracking-tight text-loxam-black">
        {t("login.title")}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-loxam-muted">
        {t("login.body")}
      </p>
      <LoginForm locale={locale} errorCode={error ?? null} />
    </section>
  );
}
