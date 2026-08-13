import {NextRequest} from "next/server";
import {hasSupabaseAuthCookie, logAuth} from "@/lib/auth/debug";
import {describeSetCookies, getAuthCookiePolicy, redirectToPath} from "@/lib/auth/origin";
import {
  createRouteHandlerClient,
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
  return redirectToPath(request, `/${locale}/login`);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = safeLocale(formData.get("locale"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const policy = getAuthCookiePolicy(request);

  if (!email || !password) {
    logAuth("sign_in_failed", {
      LOGIN_SUCCESS: false,
      SESSION_RETURNED: false,
      reason: "missing_fields",
    });
    return loginErrorRedirect(request, locale, "invalid_credentials");
  }

  const dashboard = redirectToPath(request, `/${locale}`);

  try {
    const supabase = createRouteHandlerClient(request, dashboard);
    const {data, error} = await supabase.auth.signInWithPassword({email, password});

    if (error) {
      logAuth("sign_in_failed", {
        LOGIN_SUCCESS: false,
        SESSION_RETURNED: false,
        SET_COOKIE_COUNT: 0,
        code: error.code ?? null,
        status: error.status ?? null,
      });
      return loginErrorRedirect(request, locale, credentialsErrorCode(error));
    }

    const sessionReturned = Boolean(data.session && data.user);
    logAuth("auth_debug", {
      LOGIN_SUCCESS: !error,
      SESSION_RETURNED: sessionReturned,
      hasAccessToken: Boolean(data.session?.access_token),
      hasRefreshToken: Boolean(data.session?.refresh_token),
      cookiePolicy: policy,
    });

    if (!data.session || !data.user) {
      logAuth("sign_in_no_session", {
        LOGIN_SUCCESS: true,
        SESSION_RETURNED: false,
        hasUser: Boolean(data.user),
      });
      return loginErrorRedirect(request, locale, "session");
    }

    const {data: userCheck, error: userError} = await supabase.auth.getUser();
    if (userError || !userCheck.user) {
      logAuth("sign_in_no_session", {
        LOGIN_SUCCESS: true,
        SESSION_RETURNED: true,
        GET_USER_SUCCESS: false,
        reason: "getUser_after_sign_in",
      });
      return loginErrorRedirect(request, locale, "session");
    }

    const {data: profile, error: profileError} = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile?.role) {
      logAuth("profile_failed", {
        GET_USER_SUCCESS: true,
        PROFILE_ROLE: profile?.role ?? null,
        code: profileError?.code ?? null,
        hasProfile: Boolean(profile),
      });
      return loginErrorRedirect(request, locale, "profile");
    }

    const cookieSummary = describeSetCookies(dashboard);
    if (!hasSupabaseAuthCookie(dashboard.cookies.getAll())) {
      logAuth("sign_in_no_session", {
        LOGIN_SUCCESS: true,
        SESSION_RETURNED: true,
        GET_USER_SUCCESS: true,
        PROFILE_ROLE: profile.role,
        ...cookieSummary,
        reason: "cookies_not_written",
      });
      return loginErrorRedirect(request, locale, "session");
    }

    logAuth("sign_in_ok", {
      LOGIN_SUCCESS: true,
      SESSION_RETURNED: true,
      GET_USER_SUCCESS: true,
      PROFILE_ROLE: profile.role,
      location: dashboard.headers.get("location"),
      cookiePolicy: policy,
      ...cookieSummary,
    });
    return dashboard;
  } catch (error) {
    logAuth("sign_in_failed", {
      LOGIN_SUCCESS: false,
      reason: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return loginErrorRedirect(request, locale, "redirect");
  }
}
