type AuthDebugEvent =
  | "sign_in_ok"
  | "sign_in_failed"
  | "sign_in_no_session"
  | "profile_loaded"
  | "profile_failed"
  | "sign_out"
  | "proxy_unauthenticated"
  | "proxy_authenticated"
  | "auth_debug";

export function logAuth(event: AuthDebugEvent, details: Record<string, unknown> = {}) {
  const payload = {
    event,
    ...details,
    at: new Date().toISOString(),
  };

  if (event.endsWith("failed") || event === "proxy_unauthenticated") {
    console.warn("[auth]", payload);
    return;
  }

  console.info("[auth]", payload);
}

export function hasSupabaseAuthCookie(cookies: {name: string}[]) {
  return cookies.some(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
  );
}
