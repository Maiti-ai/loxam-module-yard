import {NextResponse} from "next/server";

export type AuthCookiePolicy = {
  path: "/";
  sameSite: "lax";
  secure: boolean;
};

export function getAuthCookiePolicyFromHeaders(headerStore: {
  get(name: string): string | null;
}): AuthCookiePolicy {
  const https =
    headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  return {
    path: "/",
    sameSite: "lax",
    secure: https,
  };
}

export function getAuthCookiePolicy(request: Request): AuthCookiePolicy {
  return getAuthCookiePolicyFromHeaders(request.headers);
}

function safeAppPath(path: string) {
  const url = new URL(path, "http://n.invalid");
  const pathname = url.pathname.startsWith("/") ? url.pathname : `/${url.pathname}`;
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/nl";
  }
  return `${pathname}${url.search}`;
}

/**
 * Redirect without changing host. NextResponse.redirect() requires an
 * absolute URL. Overwrite Location to a same-origin relative path so the
 * browser stays on the request origin.
 *
 * Only use this from Route Handlers. Proxy/middleware must keep an absolute
 * URL because Next.js parses Location there and rejects relative values.
 */
export function redirectToPath(request: Request, path: string, status = 303) {
  const relative = safeAppPath(path);
  const response = NextResponse.redirect(new URL(relative, request.url), status);
  response.headers.set("Location", relative);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function localeFromPathname(pathname: string): "nl" | "fr" {
  const first = pathname.split("/").filter(Boolean)[0];
  return first === "fr" ? "fr" : "nl";
}

export function isLoginPath(pathname: string) {
  return /\/(nl|fr)\/login\/?$/.test(pathname);
}

export function isAuthDebugPath(pathname: string) {
  return /\/(nl|fr)\/auth-debug\/?$/.test(pathname);
}

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
    sameSite?: true | false | "lax" | "strict" | "none";
    secure?: boolean;
    httpOnly?: boolean;
  };
};

export function applyAuthCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[],
  headers: Record<string, string>,
) {
  cookiesToSet.forEach(({name, value, options}) => {
    response.cookies.set(name, value, options);
  });
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}

export function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

function setCookieHeaders(response: NextResponse) {
  const headers = response.headers as Headers & {getSetCookie?: () => string[]};
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

export function describeSetCookieHeaders(response: NextResponse) {
  return setCookieHeaders(response).map((header) => {
    const parts = header.split(";");
    const name = parts[0]?.split("=")[0]?.trim() ?? "";
    const attrs = new Map<string, string | true>();
    for (const part of parts.slice(1)) {
      const [rawKey, ...rest] = part.split("=");
      const key = rawKey?.trim() ?? "";
      if (!key) {
        continue;
      }
      attrs.set(key.toLowerCase(), rest.length ? rest.join("=").trim() : true);
    }
    return {
      name,
      Path: attrs.get("path") ?? "/",
      Secure: attrs.has("secure"),
      HttpOnly: attrs.has("httponly"),
      SameSite: attrs.get("samesite") ?? null,
      Partitioned: attrs.has("partitioned"),
    };
  });
}

export function describeSetCookies(response: NextResponse) {
  const cookies = response.cookies.getAll();
  const authCookies = cookies.filter(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
  );
  return {
    SET_COOKIE_COUNT: authCookies.length,
    cookieNames: authCookies.map((cookie) => cookie.name),
  };
}

export function describeRequestCookies(cookies: {name: string}[]) {
  const authCookies = cookies.filter(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
  );
  return {
    DASHBOARD_COOKIE_COUNT: authCookies.length,
    cookieNames: authCookies.map((cookie) => cookie.name),
  };
}

export function logAuthRedirect(reason: string) {
  console.info(`AUTH_REDIRECT_REASON=${reason}`);
}
