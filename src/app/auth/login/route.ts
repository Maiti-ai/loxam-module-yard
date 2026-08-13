import {NextRequest, NextResponse} from "next/server";
import {hasSupabaseAuthCookie, logAuth} from "@/lib/auth/debug";
import {
  createRouteHandlerClient,
  getAppOrigin,
  loginErrorRedirect,
  safeLocale,
} from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

function credentialsErrorCode(error: {code?: string; status?: number} | null) {
  if (
    error?.code === "invalid_credentials" ||
    error?.code === "email_not_confirmed" ||
    error?.status === 400
  ) {
    return error.code === "email_not_confirmed" ? "unconfirmed" : "invalid_credentials";
  }
  return "session";
}

export async function GET(request: NextRequest) {
  const locale = safeLocale(request.nextUrl.searchParams.get("locale"));
  return NextResponse.redirect(new URL(`/${locale}/login`, getAppOrigin(request)), {
    status: 303,
  });
}

export async function POST(request: NextRequest) {
  const origin = getAppOrigin(request);
  const formData = await request.formData();
  const locale = safeLocale(formData.get("locale"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    logAuth("sign_in_failed", {reason: "missing_fields"});
    return loginErrorRedirect(origin, locale, "invalid_credentials");
  }

  const dashboard = NextResponse.redirect(new URL(`/${locale}`, origin), {
    status: 303,
  });
  dashboard.headers.set("Cache-Control", "private, no-store");

  try {
    const supabase = createRouteHandlerClient(request, dashboard);
    const {data, error} = await supabase.auth.signInWithPassword({email, password});

    if (error) {
      logAuth("sign_in_failed", {
        code: error.code ?? null,
        status: error.status ?? null,
      });
      return loginErrorRedirect(origin, locale, credentialsErrorCode(error));
    }

    if (!data.session || !data.user) {
      logAuth("sign_in_no_session", {hasUser: Boolean(data.user)});
      return loginErrorRedirect(origin, locale, "session");
    }

    const {data: userCheck, error: userError} = await supabase.auth.getUser();
    if (userError || !userCheck.user) {
      logAuth("sign_in_no_session", {reason: "getUser_after_sign_in"});
      return loginErrorRedirect(origin, locale, "session");
    }

    const {data: profile, error: profileError} = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile?.role) {
      logAuth("profile_failed", {
        code: profileError?.code ?? null,
        hasProfile: Boolean(profile),
      });
      return loginErrorRedirect(origin, locale, "profile");
    }

    if (!hasSupabaseAuthCookie(dashboard.cookies.getAll())) {
      logAuth("sign_in_no_session", {reason: "cookies_not_written"});
      return loginErrorRedirect(origin, locale, "session");
    }

    logAuth("sign_in_ok", {userId: data.user.id, role: profile.role});
    logAuth("profile_loaded", {role: profile.role});
    return dashboard;
  } catch (error) {
    logAuth("sign_in_failed", {
      reason: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return loginErrorRedirect(origin, locale, "redirect");
  }
}
