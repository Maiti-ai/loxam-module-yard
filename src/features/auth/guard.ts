import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {getLocale} from "next-intl/server";
import {getCurrentProfile} from "@/features/auth";
import {hasSupabaseAuthCookie} from "@/lib/auth/debug";
import {logAuthRedirect} from "@/lib/auth/origin";
import type {UserProfile} from "@/features/users";

export async function requireUser(): Promise<UserProfile> {
  const profile = await getCurrentProfile();
  const locale = await getLocale();

  if (!profile) {
    const cookieStore = await cookies();
    logAuthRedirect(
      hasSupabaseAuthCookie(cookieStore.getAll()) ? "GET_USER_FAILED" : "NO_AUTH_COOKIE",
    );
    redirect(`/${locale}/login`);
    throw new Error("UNAUTHENTICATED");
  }

  return profile;
}
