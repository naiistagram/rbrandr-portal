import { NextRequest, NextResponse } from "next/server";
import { encryptSocialToken } from "@/lib/social-crypto";
import { getVerifiedAdmin, readOAuthState, socialAppUrl, type SocialProvider } from "@/lib/social-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

function redirect(request: NextRequest, returnTo: string, status: "connected" | "error", message?: string) {
  const url = new URL(returnTo, socialAppUrl() || request.url);
  url.searchParams.set("social", status);
  if (message) url.searchParams.set("socialMessage", message);
  return NextResponse.redirect(url);
}

async function exchangeMetaCode(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });
  const initialResponse = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?${params}`);
  if (!initialResponse.ok) throw new Error("Meta did not accept the connection request.");
  const initial = await initialResponse.json() as { access_token: string };
  const longLived = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: initial.access_token,
  });
  const longLivedResponse = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?${longLived}`);
  const token = longLivedResponse.ok
    ? (await longLivedResponse.json() as { access_token: string }).access_token
    : initial.access_token;
  const pagesResponse = await fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`);
  if (!pagesResponse.ok) throw new Error("Meta could not load the Pages this user manages.");
  const pages = await pagesResponse.json() as { data?: MetaPage[] };
  if (!pages.data?.length) throw new Error("No Facebook Pages were found. Connect with a Page administrator account.");
  return pages.data;
}

async function exchangeLinkedInCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
  });
  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenResponse.ok) throw new Error("LinkedIn did not accept the connection request.");
  const tokenData = await tokenResponse.json() as { access_token: string; expires_in?: number };
  const headers = {
    Authorization: `Bearer ${tokenData.access_token}`,
    "Linkedin-Version": "202602",
    "X-Restli-Protocol-Version": "2.0.0",
  };
  const rolesResponse = await fetch("https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&state=APPROVED", { headers });
  if (!rolesResponse.ok) throw new Error("LinkedIn could not load the Company Pages this user manages.");
  const roles = await rolesResponse.json() as { elements?: Array<{ organization?: string; role?: string }> };
  // Only these roles can post on a Page's behalf.
  const organizations = [...new Set((roles.elements ?? [])
    .filter((role) => role.role === "ADMINISTRATOR" || role.role === "CONTENT_ADMINISTRATOR")
    .map((role) => role.organization)
    .filter((value): value is string => Boolean(value)))];
  if (!organizations.length) throw new Error("No LinkedIn Company Pages were found. Connect with a Company Page admin or content admin account.");
  const named = await Promise.all(organizations.map(async (organization) => {
    const id = organization.split(":").pop();
    const response = await fetch(`https://api.linkedin.com/rest/organizations/${id}`, { headers }).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) as { localizedName?: string; vanityName?: string } | null : null;
    return { organization, name: data?.localizedName ?? data?.vanityName ?? `LinkedIn Page ${id}` };
  }));
  return { token: tokenData.access_token, expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null, organizations: named };
}

async function saveCandidates(request: NextRequest, state: NonNullable<ReturnType<typeof readOAuthState>>, provider: SocialProvider, createdBy: string, candidates: unknown[]) {
  const admin = createAdminClient();
  const { data: candidate, error } = await admin.from("social_connection_candidates").insert({
    project_id: state.projectId,
    provider,
    encrypted_payload: encryptSocialToken(JSON.stringify(candidates)),
    created_by: createdBy,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }).select("id").single();
  if (error || !candidate) throw new Error(error?.message ?? "Unable to prepare account selection.");
  const chooseUrl = new URL(state.returnTo, socialAppUrl() || request.url);
  chooseUrl.searchParams.set("social", "choose");
  chooseUrl.searchParams.set("candidateId", candidate.id);
  return NextResponse.redirect(chooseUrl);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  const provider = providerParam === "meta" || providerParam === "linkedin" ? providerParam as SocialProvider : null;
  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  let state: ReturnType<typeof readOAuthState> | null = null;
  try {
    const parsedState = readOAuthState(request.nextUrl.searchParams.get("state"), provider);
    state = parsedState;
    const denied = request.nextUrl.searchParams.get("error");
    const code = request.nextUrl.searchParams.get("code");
    if (denied || !code) {
      const detail = request.nextUrl.searchParams.get("error_description");
      const cancelled = denied === "user_cancelled_login" || denied === "user_cancelled_authorize" || (denied === "access_denied" && !detail);
      const message = cancelled
        ? "Connection was cancelled."
        : `${provider === "meta" ? "Meta" : "LinkedIn"} refused the connection${detail ? `: ${detail}` : denied ? ` (${denied})` : "."}`;
      return redirect(request, parsedState.returnTo, "error", message);
    }
    const auth = await getVerifiedAdmin();
    if (!auth) return redirect(request, parsedState.returnTo, "error", "Please sign in again before connecting an account.");
    if (provider === "meta") {
      const pages = await exchangeMetaCode(code, `${socialAppUrl()}/api/social/callback/meta`);
      const candidates = pages.flatMap((page) => {
        const rows = [{ platform: "Facebook", accountId: page.id, accountName: page.name, accessToken: page.access_token, metadata: { page_id: page.id } }];
        if (page.instagram_business_account?.id) rows.push({
          platform: "Instagram", accountId: page.instagram_business_account.id,
          accountName: page.instagram_business_account.username ? `@${page.instagram_business_account.username}` : page.name,
          accessToken: page.access_token, metadata: { page_id: page.id },
        });
        return rows;
      });
      return saveCandidates(request, parsedState, "meta", auth.user.id, candidates);
    }
    const result = await exchangeLinkedInCode(code, `${socialAppUrl()}/api/social/callback/linkedin`);
    return saveCandidates(request, parsedState, "linkedin", auth.user.id, result.organizations.map(({ organization, name }) => ({
      platform: "LinkedIn", accountId: organization, accountName: name, accessToken: result.token,
      tokenExpiresAt: result.expiresAt, metadata: { organization },
    })));
  } catch (error) {
    const fallback = "/admin/clients";
    const message = error instanceof Error ? error.message : "Unable to connect this account.";
    return redirect(request, state?.returnTo ?? fallback, "error", message);
  }
}
