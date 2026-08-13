import {NextResponse} from "next/server";

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

export function isHttpsRequest(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) {
    return forwardedProto === "https";
  }
  return new URL(request.url).protocol === "https:";
}

export function localeFromPathname(pathname: string): "nl" | "fr" {
  const first = pathname.split("/").filter(Boolean)[0];
  return first === "fr" ? "fr" : "nl";
}

export function isLoginPath(pathname: string) {
  return /\/(nl|fr)\/login\/?$/.test(pathname);
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
  secure: boolean,
) {
  cookiesToSet.forEach(({name, value, options = {}}) => {
    const sameSite = options.sameSite;
    response.cookies.set(name, value, {
      path: options.path ?? "/",
      domain: options.domain,
      maxAge: options.maxAge,
      expires: options.expires,
      httpOnly: options.httpOnly,
      secure: options.secure ?? secure,
      sameSite:
        sameSite === "strict" || sameSite === "none" || sameSite === "lax"
          ? sameSite
          : "lax",
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
