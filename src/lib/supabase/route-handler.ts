import {createServerClient} from "@supabase/ssr";
import {NextResponse, type NextRequest} from "next/server";
import {applyAuthCookies, getAppOrigin, isHttpsRequest} from "@/lib/auth/origin";
import {getSupabasePublicEnv} from "@/lib/env";
import type {Database} from "@/types/database";

export function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  const {url, publishableKey} = getSupabasePublicEnv();
  const secure = isHttpsRequest(request);

  return createServerClient<Database>(url, publishableKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        applyAuthCookies(response, cookiesToSet, headers, secure);
      },
    },
  });
}

export function loginErrorRedirect(origin: string, locale: "nl" | "fr", code: string) {
  const url = new URL(`/${locale}/login`, origin);
  url.searchParams.set("error", code);
  const response = NextResponse.redirect(url, {status: 303});
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function safeLocale(value: FormDataEntryValue | string | null): "nl" | "fr" {
  return value === "fr" ? "fr" : "nl";
}

export {getAppOrigin};
