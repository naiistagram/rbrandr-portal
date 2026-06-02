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
    // Recovery and invite tokens are verified client-side on /reset-password so the
    // session is established in the browser directly — no server → cookie → redirect hop.
    if (type === "recovery") {
      const params = new URLSearchParams({ token_hash: tokenHash, type });
      return NextResponse.redirect(`${origin}/reset-password?${params}`);
    }
    if (type === "invite") {
      const params = new URLSearchParams({ token_hash: tokenHash, type });
      return NextResponse.redirect(`${origin}/reset-password?${params}`);
    }
    // Other token types (signup, email_change, magiclink) — exchange server-side
    const validEmailTypes = ["signup", "email_change", "magiclink", "email"] as const;
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
