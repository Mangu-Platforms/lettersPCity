/**
 * Session refresh for Edge middleware.
 *
 * Middleware runs on the Edge runtime, so this stays cookie-shaped and cheap:
 * refresh the session, decide whether a session cookie exists, redirect if not.
 * It deliberately does NOT make authorization decisions beyond "signed in or
 * not" — per-row access is enforced by RLS, and per-route rules by the route
 * handlers and server components themselves. Trusting middleware for
 * fine-grained access is the mistake my_publishing documents in its CLAUDE.md.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";

/** Routes that require a signed-in user. */
const PROTECTED_PREFIXES = ["/inbox", "/compose", "/settings"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv().NEXT_PUBLIC_SUPABASE_URL,
    clientEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() revalidates the token with Supabase rather than trusting the
  // cookie's claims. Do not swap this for getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
