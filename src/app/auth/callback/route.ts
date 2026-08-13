import {NextRequest} from "next/server";
import {logAuth} from "@/lib/auth/debug";
import {redirectToPath} from "@/lib/auth/origin";
import {createRouteHandlerClient} from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = request.nextUrl.searchParams.get("next") ?? "/nl";
  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/nl";

  if (!code) {
    logAuth("sign_in_failed", {reason: "callback_missing_code"});
    return redirectToPath(request, "/nl/login?error=session");
  }

  const destination = redirectToPath(request, safeNext);

  try {
    const supabase = createRouteHandlerClient(request, destination);
    const {error} = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logAuth("sign_in_failed", {reason: "callback_exchange"});
      return redirectToPath(request, "/nl/login?error=session");
    }

    logAuth("sign_in_ok", {reason: "callback"});
    return destination;
  } catch (error) {
    logAuth("sign_in_failed", {
      reason: "callback_unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return redirectToPath(request, "/nl/login?error=redirect");
  }
}
