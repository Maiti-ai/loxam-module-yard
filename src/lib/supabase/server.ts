import {createServerClient} from "@supabase/ssr";
import {cookies, headers} from "next/headers";
import {getAuthCookiePolicyFromHeaders} from "@/lib/auth/origin";
import {getSupabasePublicEnv} from "@/lib/env";
import type {Database} from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const {url, publishableKey} = getSupabasePublicEnv();
  const policy = getAuthCookiePolicyFromHeaders(headerStore);

  return createServerClient<Database>(url, publishableKey, {
    cookieOptions: {
      path: policy.path,
      sameSite: policy.sameSite,
      secure: policy.secure,
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({name, value, options}) =>
            cookieStore.set(name, value, {
              ...options,
              path: policy.path,
              sameSite: policy.sameSite,
              secure: policy.secure,
              partitioned: policy.partitioned,
            }),
          );
        } catch {
          // Called from a Server Component. The proxy refreshes the session.
        }
      },
    },
  });
}
