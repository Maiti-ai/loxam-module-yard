import {createServerClient} from "@supabase/ssr";
import {NextResponse, type NextRequest} from "next/server";
import {applyAuthCookies, isHttpsRequest, redirectToPath} from "@/lib/auth/origin";
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

export function loginErrorRedirect(
  request: NextRequest,
  locale: "nl" | "fr",
  code: string,
) {
  return redirectToPath(request, `/${locale}/login?error=${encodeURIComponent(code)}`);
}

export function safeLocale(value: FormDataEntryValue | string | null): "nl" | "fr" {
  return value === "fr" ? "fr" : "nl";
}
