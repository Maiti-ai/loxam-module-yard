import {NextRequest} from "next/server";
import {logAuth} from "@/lib/auth/debug";
import {redirectToPath} from "@/lib/auth/origin";
import {createRouteHandlerClient, safeLocale} from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const locale = safeLocale(formData?.get("locale") ?? null);
  const login = redirectToPath(request, `/${locale}/login`);

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
