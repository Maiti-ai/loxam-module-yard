import {NextResponse} from "next/server";

export type AuthCookiePolicy = {
  path: "/";
  sameSite: "lax" | "none";
  secure: boolean;
  partitioned?: boolean;
};

function hostFromHeader(value: string | null) {
  if (!value) {
    return "";
  }
  return value.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

export function isCursorPreviewRequest(request: Request) {
  const hosts = [
    hostFromHeader(request.headers.get("x-forwarded-host")),
    hostFromHeader(request.headers.get("host")),
    hostFromHeader(new URL(request.url).host),
  ];
  return hosts.some(
    (host) => host.endsWith(".agent.cvm.dev") || host.endsWith(".cvm.dev"),
  );
}

export function isHttpsRequest(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) {
    return forwardedProto === "https";
  }
  return new URL(request.url).protocol === "https:";
}

export function getAuthCookiePolicyFromHeaders(headerStore: {
  get(name: string): string | null;
}): AuthCookiePolicy {
  const https =
    headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  const host = hostFromHeader(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  );
  const preview = host.endsWith(".agent.cvm.dev") || host.endsWith(".cvm.dev");
  if (preview && https) {
    return {
      path: "/",
      sameSite: "none",
      secure: true,
      partitioned: true,
    };
  }
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
 * absolute URL, but Cursor Cloud preview cannot route Location values that
 * point at localhost or a forwarded internal host. Overwrite Location to a
 * same-origin relative path so the browser stays on the preview origin.
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
  policy: AuthCookiePolicy,
) {
  cookiesToSet.forEach(({name, value, options = {}}) => {
    response.cookies.set(name, value, {
      path: options.path ?? policy.path,
      maxAge: options.maxAge,
      expires: options.expires,
      httpOnly: options.httpOnly,
      secure: policy.secure,
      sameSite: policy.sameSite,
      partitioned: policy.partitioned,
    });
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
