import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {LoginForm} from "@/components/auth/login-form";
import {getCurrentProfile} from "@/features/auth";

export default async function LoginPage() {
  const t = await getTranslations();
  const profile = await getCurrentProfile();

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
      {profile ? (
        <div className="mt-8 space-y-4">
          <p className="border-l-4 border-loxam-red pl-3 text-sm font-bold">
            {t("login.alreadySignedIn", {email: profile.email ?? ""})}
          </p>
          <Link
            href="/"
            className="inline-flex min-h-14 items-center bg-loxam-red px-6 text-sm font-black uppercase text-white"
          >
            {t("nav.home")}
          </Link>
        </div>
      ) : (
        <LoginForm />
      )}
    </section>
  );
}
