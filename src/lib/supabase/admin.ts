import "server-only";

import {createClient} from "@supabase/supabase-js";
import {getSupabasePublicEnv, getSupabaseServiceRoleKey} from "@/lib/env";
import type {Database} from "@/types/database";

export function createAdminClient() {
  const {url} = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
