import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { configuredProvider, createMemberOAuthState, memberReturnPath, socialAppUrl } from "@/lib/social-auth";

export const runtime = "nodejs";

// GET /api/social/linkedin-member — a portal user connects their own LinkedIn
// profile so they can be @mentioned in posts. Only name and member ID are read.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!configuredProvider("linkedin")) {
    return NextResponse.json({ error: "LinkedIn credentials have not been added to the server yet." }, { status: 503 });
  }

  const state = createMemberOAuthState({
    purpose: "linkedin-member",
    userId: user.id,
    returnTo: memberReturnPath(request.nextUrl.searchParams.get("returnTo")),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const destination = new URL("https://www.linkedin.com/oauth/v2/authorization");
  destination.searchParams.set("response_type", "code");
  destination.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
  destination.searchParams.set("scope", "openid profile");
  destination.searchParams.set("redirect_uri", `${socialAppUrl()}/api/social/callback/linkedin`);
  destination.searchParams.set("state", state);
  return NextResponse.redirect(destination);
}
