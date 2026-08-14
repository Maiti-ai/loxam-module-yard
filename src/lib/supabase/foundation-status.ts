import {createClient} from "@/lib/supabase/server";
import {isSupabaseConfigured, MODULE_PHOTOS_BUCKET} from "@/lib/env";

export type FoundationStatus = {
  configured: boolean;
  authReachable: boolean;
  schemaApplied: boolean;
  anonymousAccessBlocked: boolean;
  storageBucketReady: boolean;
  detail: string | null;
};

export async function getFoundationStatus(): Promise<FoundationStatus> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      authReachable: false,
      schemaApplied: false,
      anonymousAccessBlocked: false,
      storageBucketReady: false,
      detail: null,
    };
  }

  const supabase = await createClient();
  const {error: userError} = await supabase.auth.getUser();
  const {error: schemaError} = await supabase.from("modules").select("id").limit(1);
  const {error: storageError} = await supabase.storage
    .from(MODULE_PHOTOS_BUCKET)
    .list("", {limit: 1});

  const schemaMissing = schemaError?.code === "PGRST205";
  const storageMissing = /not found|nosuchbucket/i.test(storageError?.message ?? "");

  return {
    configured: true,
    authReachable: !userError || /session/i.test(userError.message),
    schemaApplied: !schemaMissing,
    anonymousAccessBlocked: Boolean(schemaError) && !schemaMissing,
    storageBucketReady: !storageMissing,
    detail: schemaError && !schemaMissing ? schemaError.message : null,
  };
}
