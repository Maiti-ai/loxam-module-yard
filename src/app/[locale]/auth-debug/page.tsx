import {connection} from "next/server";
import {cookies} from "next/headers";
import {getCurrentProfile, getCurrentUser} from "@/features/auth";
import {hasSupabaseAuthCookie, logAuth} from "@/lib/auth/debug";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthDebugPage() {
  await connection();
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const authCookieCount = allCookies.filter(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
  ).length;
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();

  logAuth("auth_debug", {
    GET_USER_SUCCESS: Boolean(user),
    PROFILE_ROLE: profile?.role ?? null,
    DASHBOARD_COOKIE_COUNT: authCookieCount,
  });

  return (
    <section className="mx-auto max-w-xl px-6 py-16">
      <p className="text-xs font-bold tracking-[0.22em] text-loxam-red uppercase">
        Auth debug
      </p>
      <h1 className="mt-4 text-3xl font-black">Sessiecontrole</h1>
      <dl className="mt-8 space-y-3 border-2 border-loxam-black bg-white p-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-bold uppercase text-loxam-muted">Authenticated</dt>
          <dd className="font-black">{user ? "yes" : "no"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold uppercase text-loxam-muted">User email</dt>
          <dd className="truncate font-black">{user?.email ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold uppercase text-loxam-muted">Profile found</dt>
          <dd className="font-black">{profile ? "yes" : "no"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold uppercase text-loxam-muted">Role</dt>
          <dd className="font-black">{profile?.role ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold uppercase text-loxam-muted">Auth cookies</dt>
          <dd className="font-black">{authCookieCount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold uppercase text-loxam-muted">Cookie names present</dt>
          <dd className="font-black">{hasSupabaseAuthCookie(allCookies) ? "yes" : "no"}</dd>
        </div>
      </dl>
    </section>
  );
}
