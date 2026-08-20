/**
 * Server Supabase clients.
 *
 * `createClient()` acts as the signed-in user, so RLS still applies — this is
 * the one to reach for. `createAdminClient()` uses the service-role key and
 * bypasses RLS entirely; it is for the inbound-mail webhook, which has no user
 * session but must write into a user's mailbox.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { clientEnv, serverEnv } from "@/lib/env";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    clientEnv().NEXT_PUBLIC_SUPABASE_URL,
    clientEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    }
  );
}

/**
 * Service-role client. Bypasses RLS — every caller must do its own
 * authorization first. Server-only.
 */
export function createAdminClient() {
  return createSupabaseClient(
    clientEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
