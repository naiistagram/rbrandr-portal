import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Determine redirect target before error handling so we can send password
  // flow errors to the reset page instead of login.
  const isPasswordFlow =
    type === "recovery" ||
    type === "invite" ||
    next === "/reset-password";

  if (error) {
    if (isPasswordFlow) {
      return NextResponse.redirect(`${origin}/reset-password?error=expired`);
    }
    const msg = encodeURIComponent(errorDescription ?? error);
    return NextResponse.redirect(`${origin}/login?error=${msg}`);
  }
  const redirectTarget = isPasswordFlow ? `${origin}/reset-password` : `${origin}${next}`;
  const response = NextResponse.redirect(redirectTarget);

  // Create a Supabase client whose setAll writes cookies directly onto the
  // redirect response — NOT via cookies() from next/headers (which does NOT
  // merge into NextResponse objects in Next.js 15+).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  if (tokenHash && type) {
    // For password/invite flows, delegate OTP verification to the browser
    // client so it can establish the session in its own readable storage
    // (localStorage + non-httpOnly cookies). Server-set httpOnly session
    // cookies are invisible to JavaScript, causing getSession() to return
    // null for logged-out users.
    if (isPasswordFlow) {
      const params = new URLSearchParams({ token_hash: tokenHash, type });
      return NextResponse.redirect(`${origin}/reset-password?${params}`);
    }

    // For non-password flows (signup, email_change, magiclink), verify server-side
    const validTypes = ["signup", "email_change", "magiclink", "email"] as const;
    type OtpType = typeof validTypes[number];
    if (validTypes.includes(type as OtpType)) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as OtpType,
      });
      if (verifyError) {
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(verifyError.message)}`);
      }
    }
  } else if (code) {
    // PKCE code exchange
    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
