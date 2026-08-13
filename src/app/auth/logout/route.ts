import {NextRequest, NextResponse} from "next/server";
import {logAuth} from "@/lib/auth/debug";
import {
  createRouteHandlerClient,
  getAppOrigin,
  safeLocale,
} from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = getAppOrigin(request);
  const formData = await request.formData().catch(() => null);
  const locale = safeLocale(formData?.get("locale") ?? null);
  const login = NextResponse.redirect(new URL(`/${locale}/login`, origin), {
    status: 303,
  });
  login.headers.set("Cache-Control", "private, no-store");

  try {
    const supabase = createRouteHandlerClient(request, login);
    await supabase.auth.signOut();
    logAuth("sign_out");
  } catch (error) {
    logAuth("sign_in_failed", {
      reason: "sign_out_unexpected",
      name: error instanceof Error ? error.name : "unknown",
    });
  }

  return login;
}
