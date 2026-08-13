import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {getCurrentProfile} from "@/features/auth";
import {signOutAction} from "@/features/auth/actions";

export async function SessionControls() {
  const t = await getTranslations();
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <Link
        href="/login"
        className="hidden rounded-sm border border-white/20 px-3 py-1.5 text-xs font-bold tracking-wide uppercase hover:border-loxam-yellow hover:text-loxam-yellow sm:inline-flex"
      >
        {t("nav.login")}
      </Link>
    );
  }

  return (
    <div className="hidden items-center gap-3 sm:flex">
      <p className="max-w-40 truncate text-xs text-white/80">
        {profile.email}
        {profile.role ? ` · ${profile.role}` : ""}
      </p>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-sm border border-white/20 px-3 py-1.5 text-xs font-bold tracking-wide uppercase hover:border-loxam-yellow hover:text-loxam-yellow"
        >
          {t("nav.logout")}
        </button>
      </form>
    </div>
  );
}
