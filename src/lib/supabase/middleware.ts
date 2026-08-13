import {createServerClient} from "@supabase/ssr";
import {type NextRequest, type NextResponse} from "next/server";
import {applyAuthCookies, getAuthCookiePolicy} from "@/lib/auth/origin";
import {isSupabaseConfigured} from "@/lib/env";
import type {Database} from "@/types/database";
import type {User} from "@supabase/supabase-js";

export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{response: NextResponse; user: User | null}> {
  if (!isSupabaseConfigured()) {
    return {response, user: null};
  }

  let user: User | null = null;
  const policy = getAuthCookiePolicy(request);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        path: policy.path,
        sameSite: policy.sameSite,
        secure: policy.secure,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({name, value}) => request.cookies.set(name, value));
          applyAuthCookies(response, cookiesToSet, headers, policy);
        },
      },
    },
  );

  const result = await supabase.auth.getUser();
  user = result.data.user;

  return {response, user};
}
