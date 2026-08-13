import {NextResponse} from "next/server";

export function getAppOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    const proto =
      forwardedProto?.split(",")[0]?.trim() ||
      url.protocol.replace(":", "") ||
      "https";
    if (host) {
      return `${proto}://${host}`;
    }
  }

  return url.origin;
}

export function isHttpsRequest(request: Request) {
  return getAppOrigin(request).startsWith("https://");
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
