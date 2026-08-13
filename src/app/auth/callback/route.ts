import {NextRequest, NextResponse} from "next/server";
import {logAuth} from "@/lib/auth/debug";
import {createRouteHandlerClient, getAppOrigin} from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = getAppOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = request.nextUrl.searchParams.get("next") ?? "/nl";
  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/nl";

  if (!code) {
    logAuth("sign_in_failed", {reason: "callback_missing_code"});
    return NextResponse.redirect(new URL("/nl/login?error=session", origin), {
      status: 303,
    });
  }

  const destination = NextResponse.redirect(new URL(safeNext, origin), {status: 303});
  destination.headers.set("Cache-Control", "private, no-store");

  try {
    const supabase = createRouteHandlerClient(request, destination);
    const {error} = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logAuth("sign_in_failed", {reason: "callback_exchange"});
      return NextResponse.redirect(new URL("/nl/login?error=session", origin), {
        status: 303,
      });
    }

    logAuth("sign_in_ok", {reason: "callback"});
    return destination;
  } catch (error) {
    logAuth("sign_in_failed", {
      reason: "callback_unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.redirect(new URL("/nl/login?error=redirect", origin), {
      status: 303,
    });
  }
}
