import { NextRequest, NextResponse } from "next/server";
import { configuredProvider, createOAuthState, getVerifiedAdmin, socialAppUrl, type SocialProvider } from "@/lib/social-auth";

export const runtime = "nodejs";

const PROVIDERS = new Set<SocialProvider>(["meta", "linkedin"]);

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  if (!PROVIDERS.has(providerParam as SocialProvider)) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  const provider = providerParam as SocialProvider;
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.redirect(new URL("/login", request.url));

  const projectId = request.nextUrl.searchParams.get("projectId");
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!projectId || !clientId) return NextResponse.json({ error: "projectId and clientId required" }, { status: 400 });
  const { data: project } = await auth.admin.from("projects").select("id").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!configuredProvider(provider)) {
    return NextResponse.json({ error: `${provider === "meta" ? "Meta" : "LinkedIn"} credentials have not been added to the server yet.` }, { status: 503 });
  }

  const state = createOAuthState({
    provider,
    projectId,
    returnTo: `/admin/clients/${clientId}?tab=Content`,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const redirectUri = `${socialAppUrl()}/api/social/callback/${provider}`;
  const destination = provider === "meta"
    ? new URL("https://www.facebook.com/v23.0/dialog/oauth")
    : new URL("https://www.linkedin.com/oauth/v2/authorization");

  if (provider === "meta") {
    destination.searchParams.set("client_id", process.env.META_APP_ID!);
    destination.searchParams.set("scope", "pages_show_list,pages_manage_posts,pages_read_engagement,business_management,instagram_basic,instagram_content_publishing");
  } else {
    destination.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
    destination.searchParams.set("scope", "openid profile w_organization_social r_organization_social");
  }
  destination.searchParams.set("redirect_uri", redirectUri);
  destination.searchParams.set("state", state);
  return NextResponse.redirect(destination);
}
