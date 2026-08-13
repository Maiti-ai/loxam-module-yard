import {getTranslations} from "next-intl/server";
import {LoginForm} from "@/components/auth/login-form";
import {getCurrentProfile} from "@/features/auth";
import {Link} from "@/i18n/navigation";

export default async function LoginPage() {
  const t = await getTranslations();
  const profile = await getCurrentProfile();

  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-muted uppercase">
        {t("nav.login")}
      </p>
      <h1 className="mt-4 text-4xl font-black tracking-tight text-loxam-black">
        {t("login.title")}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-loxam-muted">
        {t("login.body")}
      </p>
      {profile ? (
        <p className="mt-8 border-l-4 border-loxam-yellow pl-3 text-sm">
          {t("login.alreadySignedIn", {email: profile.email ?? ""})}
        </p>
      ) : (
        <LoginForm />
      )}
      <Link
        href="/"
        className="mt-8 inline-flex text-sm font-bold tracking-wide text-loxam-black uppercase"
      >
        {t("placeholder.back")}
      </Link>
    </section>
  );
}
