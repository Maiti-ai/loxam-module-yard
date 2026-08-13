import createIntlMiddleware from "next-intl/middleware";
import {NextResponse, type NextRequest} from "next/server";
import {logAuth} from "./lib/auth/debug";
import {
  copyCookies,
  describeRequestCookies,
  isAuthDebugPath,
  isLoginPath,
  localeFromPathname,
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
  const {response, user} = await updateSession(request, i18nResponse);
  const locale = localeFromPathname(pathname);
  const cookieSummary = describeRequestCookies(request.cookies.getAll());

  if (user && isLoginPath(pathname)) {
    logAuth("proxy_authenticated", {
      pathname,
      GET_USER_SUCCESS: true,
      ...cookieSummary,
    });
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

  logAuth("proxy_unauthenticated", {
    pathname,
    GET_USER_SUCCESS: false,
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
