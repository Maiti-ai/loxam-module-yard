import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {getSupabasePublicEnv} from "@/lib/env";
import type {Database} from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  const {url, publishableKey} = getSupabasePublicEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, _headers) {
        try {
          cookiesToSet.forEach(({name, value, options}) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component. The proxy refreshes the session.
        }
      },
    },
  });
}
