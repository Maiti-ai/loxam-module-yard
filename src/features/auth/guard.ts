import {getLocale} from "next-intl/server";
import {redirect} from "@/i18n/navigation";
import {getCurrentProfile} from "@/features/auth";
import type {UserProfile} from "@/features/users";

export async function requireUser(): Promise<UserProfile> {
  const profile = await getCurrentProfile();
  const locale = await getLocale();

  if (!profile) {
    redirect({href: "/login", locale});
    throw new Error("UNAUTHENTICATED");
  }

  return profile;
}
