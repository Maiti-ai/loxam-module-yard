import {createServerClient} from "@supabase/ssr";
import {type NextRequest, type NextResponse} from "next/server";
import {isSupabaseConfigured} from "@/lib/env";
import type {Database} from "@/types/database";

export async function updateSession(
  request: NextRequest,
  response: NextResponse,
) {
  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({name, value}) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({name, value, options}) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Refresh the Auth token. Do not add logic between createServerClient and getUser.
  await supabase.auth.getUser();

  return response;
}
