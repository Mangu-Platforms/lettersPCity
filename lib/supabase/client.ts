/** Browser Supabase client. Anon key only — every query runs under RLS. */
import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    clientEnv().NEXT_PUBLIC_SUPABASE_URL,
    clientEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
