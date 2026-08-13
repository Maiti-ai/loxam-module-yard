import createIntlMiddleware from "next-intl/middleware";
import {NextResponse, type NextRequest} from "next/server";
import {routing} from "./i18n/routing";
import {updateSession} from "./lib/supabase/middleware";

const handleI18nRouting = createIntlMiddleware(routing);

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/auth") ||
    /\/(nl|fr)\/login\/?$/.test(pathname) ||
    pathname.startsWith("/manifest")
  );
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    const {response} = await updateSession(request, NextResponse.next());
    return response;
  }

  const i18nResponse = handleI18nRouting(request);
  const {response, user} = await updateSession(request, i18nResponse);

  if (user || isPublicPath(pathname)) {
    return response;
  }

  const first = pathname.split("/").filter(Boolean)[0];
  const locale = first === "fr" ? "fr" : "nl";
  const redirect = NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  return copyCookies(response, redirect);
}

export const config = {
  matcher: "/((?!_next|_vercel|.*\\..*).*)",
};
