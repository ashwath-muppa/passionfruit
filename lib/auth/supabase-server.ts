// Supabase server client (App Router). Reads/writes the auth cookies so server
// components and route handlers see the logged-in parent.

import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example and `npx supabase status`.",
    );
  }
  return { url, anon };
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anon } = publicEnv();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component without a mutable cookie store —
          // safe to ignore; middleware refreshes the session.
        }
      },
    },
  });
}
