import createIntlMiddleware from "next-intl/middleware";
import {NextResponse, type NextRequest} from "next/server";
import {hasSupabaseAuthCookie, logAuth} from "./lib/auth/debug";
import {
  copyCookies,
  describeRequestCookies,
  isAuthDebugPath,
  isLoginPath,
  localeFromPathname,
  logAuthRedirect,
} from "./lib/auth/origin";
import {updateSession} from "./lib/supabase/middleware";
import {routing} from "./i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/auth") ||
    isLoginPath(pathname) ||
    isAuthDebugPath(pathname) ||
    pathname.startsWith("/manifest")
  );
}

export async function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    const {response} = await updateSession(request, NextResponse.next());
    return response;
  }

  const i18nResponse = handleI18nRouting(request);
  const {response, user, getUserError} = await updateSession(request, i18nResponse);
  const locale = localeFromPathname(pathname);
  const cookieSummary = describeRequestCookies(request.cookies.getAll());
  const authCookiePresent = hasSupabaseAuthCookie(request.cookies.getAll());

  if (pathname === `/${locale}` || pathname === `/${locale}/`) {
    console.info("GET_DASHBOARD", {
      pathname,
      statusIntent: user ? 200 : "redirect_login",
      AUTH_COOKIE_PRESENT: authCookiePresent,
      cookieNames: cookieSummary.cookieNames,
      GET_USER_SUCCESS: Boolean(user),
      GET_USER_ERROR: getUserError,
    });
  }

  if (user && isLoginPath(pathname)) {
    logAuth("proxy_authenticated", {
      pathname,
      GET_USER_SUCCESS: true,
      ...cookieSummary,
    });
    logAuthRedirect("ALREADY_AUTHENTICATED");
    return copyCookies(
      response,
      NextResponse.redirect(new URL(`/${locale}`, request.url)),
    );
  }

  if (user || isPublicPath(pathname)) {
    if (isAuthDebugPath(pathname) || pathname === `/${locale}` || pathname === `/${locale}/`) {
      logAuth("auth_debug", {
        pathname,
        GET_USER_SUCCESS: Boolean(user),
        ...cookieSummary,
      });
    }
    return response;
  }

  const reason = authCookiePresent
    ? getUserError
      ? "GET_USER_FAILED"
      : "SESSION_REFRESH_FAILED"
    : "NO_AUTH_COOKIE";
  logAuthRedirect(reason);
  logAuth("proxy_unauthenticated", {
    pathname,
    GET_USER_SUCCESS: false,
    AUTH_REDIRECT_REASON: reason,
    ...cookieSummary,
  });
  return copyCookies(
    response,
    NextResponse.redirect(new URL(`/${locale}/login`, request.url)),
  );
}

export const config = {
  matcher: "/((?!_next|_vercel|auth/|.*\\..*).*)",
};
