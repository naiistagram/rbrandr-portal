import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  if (tokenHash && type) {
    // Older email-based OTP flow (recovery, signup, email_change, etc.)
    const validEmailTypes = ["signup", "recovery", "invite", "email_change", "magiclink", "email"] as const;
    type EmailOtp = typeof validEmailTypes[number];
    if (validEmailTypes.includes(type as EmailOtp)) {
      await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtp });
    }
  } else if (code) {
    // PKCE code exchange (default Supabase v2)
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
