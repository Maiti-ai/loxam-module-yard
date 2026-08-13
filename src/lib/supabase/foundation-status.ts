import {createClient} from "@/lib/supabase/server";
import {isSupabaseConfigured} from "@/lib/env";

export type FoundationStatus = {
  configured: boolean;
  authReachable: boolean;
  schemaApplied: boolean;
  anonymousAccessBlocked: boolean;
  detail: string | null;
};

export async function getFoundationStatus(): Promise<FoundationStatus> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      authReachable: false,
      schemaApplied: false,
      anonymousAccessBlocked: false,
      detail: null,
    };
  }

  const supabase = await createClient();
  const {error: userError} = await supabase.auth.getUser();
  const {error: schemaError} = await supabase.from("modules").select("id").limit(1);

  const schemaMissing = schemaError?.code === "PGRST205";

  return {
    configured: true,
    authReachable: !userError || /session/i.test(userError.message),
    schemaApplied: !schemaMissing,
    anonymousAccessBlocked: Boolean(schemaError) && !schemaMissing,
    detail: schemaError && !schemaMissing ? schemaError.message : null,
  };
}
