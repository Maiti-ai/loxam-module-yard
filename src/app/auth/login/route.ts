import {NextRequest} from "next/server";
import {hasSupabaseAuthCookie, logAuth} from "@/lib/auth/debug";
import {
  describeSetCookieHeaders,
  describeSetCookies,
  getAuthCookiePolicy,
  logAuthRedirect,
  redirectToPath,
} from "@/lib/auth/origin";
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

function redirectAndLog(
  request: NextRequest,
  locale: "nl" | "fr",
  code: string,
  reason: string,
) {
  logAuthRedirect(reason);
  const response = loginErrorRedirect(request, locale, code);
  console.info("REDIRECT_TARGET", response.headers.get("location"));
  return response;
}

export async function GET(request: NextRequest) {
  const locale = safeLocale(request.nextUrl.searchParams.get("locale"));
  return redirectToPath(request, `/${locale}/login`);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const locale = safeLocale(formData.get("locale"));
  const emailPresent = String(formData.get("email") ?? "").trim().length > 0;
  const passwordPresent = String(formData.get("password") ?? "").length > 0;
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const policy = getAuthCookiePolicy(request);

  console.info("LOGIN_POST_RECEIVED");
  console.info("EMAIL_FIELD_PRESENT", emailPresent);
  console.info("PASSWORD_FIELD_PRESENT", passwordPresent);

  if (!email || !password) {
    console.info("SIGNIN_ATTEMPTED", false);
    console.info("SIGNIN_SUCCESS", false);
    logAuth("sign_in_failed", {
      LOGIN_POST_RECEIVED: true,
      EMAIL_FIELD_PRESENT: emailPresent,
      PASSWORD_FIELD_PRESENT: passwordPresent,
      SIGNIN_ATTEMPTED: false,
      SIGNIN_SUCCESS: false,
      reason: "missing_fields",
    });
    return redirectAndLog(request, locale, "invalid_credentials", "INVALID_CREDENTIALS");
  }

  const dashboard = redirectToPath(request, `/${locale}`);

  try {
    const supabase = createRouteHandlerClient(request, dashboard);
    console.info("SIGNIN_ATTEMPTED");
    logAuth("auth_debug", {SIGNIN_ATTEMPTED: true});
    const {data, error} = await supabase.auth.signInWithPassword({email, password});

    if (error) {
      console.info("SIGNIN_SUCCESS", false);
      logAuth("sign_in_failed", {
        LOGIN_SUCCESS: false,
        SESSION_RETURNED: false,
        SET_COOKIE_COUNT: 0,
        code: error.code ?? null,
        status: error.status ?? null,
      });
      return redirectAndLog(
        request,
        locale,
        credentialsErrorCode(error),
        error.code === "email_not_confirmed" ? "EMAIL_UNCONFIRMED" : "INVALID_CREDENTIALS",
      );
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
      console.info("SIGNIN_SUCCESS", false);
      logAuth("sign_in_no_session", {
        LOGIN_SUCCESS: true,
        SESSION_RETURNED: false,
        hasUser: Boolean(data.user),
      });
      return redirectAndLog(request, locale, "session", "SESSION_REFRESH_FAILED");
    }

    const {data: userCheck, error: userError} = await supabase.auth.getUser();
    if (userError || !userCheck.user) {
      console.info("SIGNIN_SUCCESS", false);
      logAuth("sign_in_no_session", {
        LOGIN_SUCCESS: true,
        SESSION_RETURNED: true,
        GET_USER_SUCCESS: false,
        reason: "getUser_after_sign_in",
      });
      return redirectAndLog(request, locale, "session", "GET_USER_FAILED");
    }

    const {data: profile, error: profileError} = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile?.role) {
      console.info("SIGNIN_SUCCESS", false);
      logAuth("profile_failed", {
        GET_USER_SUCCESS: true,
        PROFILE_ROLE: profile?.role ?? null,
        code: profileError?.code ?? null,
        hasProfile: Boolean(profile),
      });
      return redirectAndLog(
        request,
        locale,
        "profile",
        profile ? "ROLE_NOT_ALLOWED" : "PROFILE_NOT_FOUND",
      );
    }

    const cookieSummary = describeSetCookies(dashboard);
    if (!hasSupabaseAuthCookie(dashboard.cookies.getAll())) {
      console.info("SIGNIN_SUCCESS", false);
      logAuth("sign_in_no_session", {
        LOGIN_SUCCESS: true,
        SESSION_RETURNED: true,
        GET_USER_SUCCESS: true,
        PROFILE_ROLE: profile.role,
        ...cookieSummary,
        reason: "cookies_not_written",
      });
      return redirectAndLog(request, locale, "session", "SESSION_REFRESH_FAILED");
    }

    const redirectTarget = dashboard.headers.get("location");
    const setCookieMeta = describeSetCookieHeaders(dashboard);
    console.info("SET_COOKIE_HEADERS", setCookieMeta);
    console.info("SIGNIN_SUCCESS");
    console.info("REDIRECT_TARGET", redirectTarget);
    logAuth("sign_in_ok", {
      LOGIN_POST_RECEIVED: true,
      SIGNIN_ATTEMPTED: true,
      SIGNIN_SUCCESS: true,
      LOGIN_SUCCESS: true,
      SESSION_RETURNED: true,
      GET_USER_SUCCESS: true,
      PROFILE_ROLE: profile.role,
      REDIRECT_TARGET: redirectTarget,
      location: redirectTarget,
      cookiePolicy: policy,
      setCookieMeta,
      ...cookieSummary,
    });
    return dashboard;
  } catch (error) {
    console.info("SIGNIN_SUCCESS", false);
    logAuth("sign_in_failed", {
      LOGIN_SUCCESS: false,
      reason: "unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return redirectAndLog(request, locale, "redirect", "SESSION_REFRESH_FAILED");
  }
}
