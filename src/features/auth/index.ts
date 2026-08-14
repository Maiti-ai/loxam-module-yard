import {createClient} from "@/lib/supabase/server";
import type {UserProfile} from "@/features/users";
import type {AppLocale} from "@/i18n/routing";
import type {AppRole} from "@/types/database";

function asAppLocale(value: string): AppLocale {
  return value === "fr" ? "fr" : "nl";
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {data, error} = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {data: userData, error: userError} = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return null;
  }

  const user = userData.user;
  const {data} = await supabase
    .from("profiles")
    .select("id, full_name, role, locale")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) {
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: null,
      role: null,
      locale: "nl",
    };
  }

  return {
    id: data.id,
    email: user.email ?? null,
    fullName: data.full_name,
    role: data.role,
    locale: asAppLocale(data.locale),
  };
}

export async function requireRole(allowed: AppRole[]) {
  const profile = await getCurrentProfile();

  if (!profile?.role || !allowed.includes(profile.role)) {
    throw new Error("Not authorized");
  }

  return profile;
}
