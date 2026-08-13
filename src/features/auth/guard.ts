import {redirect} from "next/navigation";
import {getLocale} from "next-intl/server";
import {getCurrentProfile} from "@/features/auth";
import type {UserProfile} from "@/features/users";

export async function requireUser(): Promise<UserProfile> {
  const profile = await getCurrentProfile();
  const locale = await getLocale();

  if (!profile) {
    redirect(`/${locale}/login`);
    throw new Error("UNAUTHENTICATED");
  }

  return profile;
}
