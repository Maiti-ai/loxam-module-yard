import {getLocale, getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getCurrentProfile} from "@/features/auth";

export async function SessionControls() {
  const t = await getTranslations();
  const locale = await getLocale();
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center border border-white/30 px-3 text-xs font-black uppercase"
      >
        {t("nav.login")}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="hidden max-w-44 truncate text-xs text-white/80 sm:block">
        {profile.email}
        {profile.role ? ` · ${t(`roles.${profile.role}`)}` : ""}
      </p>
      <form action="/auth/logout" method="post">
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="min-h-11 border border-white/30 px-3 text-xs font-black uppercase"
        >
          {t("nav.logout")}
        </button>
      </form>
    </div>
  );
}
