import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getMfaStatus } from "@/lib/supabase/mfa";

function withSessionCookies(response: NextResponse, sessionResponse: NextResponse) {
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Vercel cron requests do not carry a browser session. The route itself
  // verifies CRON_SECRET, so it must bypass the portal-login redirect.
  if (request.nextUrl.pathname.startsWith("/api/cron/")) return supabaseResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unavailable — let the request through; pages protect themselves
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isMfaRoute = pathname.startsWith("/mfa");
  const isPublicRoute =
    isAuthRoute ||
    isMfaRoute ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  if (!user && !isPublicRoute && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return withSessionCookies(NextResponse.redirect(url), supabaseResponse);
  }

  if (user && !isPublicRoute && pathname !== "/") {
    const mfaStatus = await getMfaStatus(supabase);
    if (mfaStatus.requiresMfa) {
      if (pathname.startsWith("/api/")) {
        return withSessionCookies(
          NextResponse.json({ error: "Two-factor authentication is required." }, { status: 401 }),
          supabaseResponse
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/mfa";
      return withSessionCookies(NextResponse.redirect(url), supabaseResponse);
    }
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    const mfaStatus = await getMfaStatus(supabase);
    url.pathname = mfaStatus.requiresMfa ? "/mfa" : "/dashboard";
    return withSessionCookies(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}
