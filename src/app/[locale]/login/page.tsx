import {connection} from "next/server";
import {redirect} from "next/navigation";
import {getLocale, getTranslations} from "next-intl/server";
import {LoginFormClient} from "@/components/auth/login-form-client";
import {getCurrentProfile} from "@/features/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOGIN_ERROR_KEYS: Record<string, string> = {
  invalid_credentials: "invalidCredentials",
  unconfirmed: "unconfirmed",
  session: "sessionFailed",
  profile: "profileFailed",
  redirect: "redirectFailed",
  auth: "sessionFailed",
};

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
    redirect(`/${locale}`);
  }

  const errorKey = error ? LOGIN_ERROR_KEYS[error] : undefined;

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
      {errorKey ? (
        <p className="mt-8 border-l-4 border-loxam-red pl-3 text-sm font-bold" role="alert">
          {t(`login.${errorKey}`)}
        </p>
      ) : null}
      <LoginFormClient locale={locale} />
    </section>
  );
}
