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

  if (error) {
    const msg = encodeURIComponent(errorDescription ?? error);
    return NextResponse.redirect(`${origin}/login?error=${msg}`);
  }

  // Determine redirect target
  const isPasswordFlow = type === "recovery" || type === "invite";
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
    // Verify OTP token — covers recovery, invite, signup, magiclink, email_change
    const validTypes = ["recovery", "invite", "signup", "email_change", "magiclink", "email"] as const;
    type OtpType = typeof validTypes[number];
    if (validTypes.includes(type as OtpType)) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as OtpType,
      });
      if (verifyError) {
        // Token expired or invalid — send to reset page which shows the error UI
        if (isPasswordFlow) {
          return NextResponse.redirect(
            `${origin}/reset-password?error=expired`
          );
        }
      }
    }
  } else if (code) {
    // PKCE code exchange
    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
