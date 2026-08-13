import createIntlMiddleware from "next-intl/middleware";
import {NextResponse, type NextRequest} from "next/server";
import {logAuth} from "./lib/auth/debug";
import {
  copyCookies,
  isLoginPath,
  localeFromPathname,
  redirectToPath,
  relativizeLocation,
} from "./lib/auth/origin";
import {updateSession} from "./lib/supabase/middleware";
import {routing} from "./i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/auth") ||
    isLoginPath(pathname) ||
    pathname.startsWith("/manifest")
  );
}

export async function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    const {response} = await updateSession(request, NextResponse.next());
    return response;
  }

  const i18nResponse = relativizeLocation(handleI18nRouting(request));
  const {response, user} = await updateSession(request, i18nResponse);
  const locale = localeFromPathname(pathname);

  if (user && isLoginPath(pathname)) {
    logAuth("proxy_authenticated", {pathname, userId: user.id});
    return relativizeLocation(copyCookies(response, redirectToPath(request, `/${locale}`, 307)));
  }

  if (user || isPublicPath(pathname)) {
    return relativizeLocation(response);
  }

  logAuth("proxy_unauthenticated", {pathname});
  return relativizeLocation(copyCookies(response, redirectToPath(request, `/${locale}/login`, 307)));
}

export const config = {
  matcher: "/((?!_next|_vercel|auth/|.*\\..*).*)",
};
