import { NextRequest, NextResponse } from "next/server";
import { decryptSocialToken, encryptSocialToken } from "@/lib/social-crypto";
import { getVerifiedAdmin } from "@/lib/social-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const candidateId = request.nextUrl.searchParams.get("candidateId");
  if (candidateId) {
    const { data: candidate, error } = await auth.admin
      .from("social_connection_candidates")
      .select("encrypted_payload, expires_at, created_by")
      .eq("id", candidateId)
      .eq("created_by", auth.user.id)
      .single();
    if (error || !candidate || new Date(candidate.expires_at) < new Date()) {
      return NextResponse.json({ error: "Account selection has expired. Please connect again." }, { status: 404 });
    }
    type Candidate = { platform: "Facebook" | "Instagram"; accountId: string; accountName: string };
    const accounts = (JSON.parse(decryptSocialToken(candidate.encrypted_payload)) as Candidate[])
      .map(({ platform, accountId, accountName }) => ({ id: `${platform}:${accountId}`, platform, accountName }));
    return NextResponse.json({ accounts });
  }
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { data, error } = await auth.admin
    .from("social_connections")
    .select("id, provider, platform, account_id, account_name, token_expires_at, created_at, updated_at")
    .eq("project_id", projectId)
    .order("platform");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connections: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { candidateId, accountIds } = await request.json();
  if (!candidateId || !Array.isArray(accountIds) || accountIds.length === 0) {
    return NextResponse.json({ error: "Choose at least one account." }, { status: 400 });
  }
  const { data: candidate, error } = await auth.admin
    .from("social_connection_candidates")
    .select("id, project_id, provider, encrypted_payload, expires_at, created_by")
    .eq("id", candidateId)
    .eq("created_by", auth.user.id)
    .single();
  if (error || !candidate) return NextResponse.json({ error: "Account selection has expired. Please connect again." }, { status: 404 });
  if (new Date(candidate.expires_at) < new Date()) {
    await auth.admin.from("social_connection_candidates").delete().eq("id", candidate.id);
    return NextResponse.json({ error: "Account selection has expired. Please connect again." }, { status: 410 });
  }

  type Candidate = { platform: "Facebook" | "Instagram"; accountId: string; accountName: string; accessToken: string; metadata: Record<string, string> };
  const candidates = JSON.parse(decryptSocialToken(candidate.encrypted_payload)) as Candidate[];
  const selected = candidates.filter((item) => accountIds.includes(`${item.platform}:${item.accountId}`));
  if (!selected.length) return NextResponse.json({ error: "Selected accounts are no longer available." }, { status: 400 });

  await auth.admin.from("social_connections").delete().eq("project_id", candidate.project_id).eq("provider", candidate.provider);
  const { error: insertError } = await auth.admin.from("social_connections").insert(selected.map((item) => ({
    project_id: candidate.project_id, provider: candidate.provider, platform: item.platform,
    account_id: item.accountId, account_name: item.accountName,
    encrypted_access_token: encryptSocialToken(item.accessToken), metadata: item.metadata, connected_by: auth.user.id,
  })));
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await auth.admin.from("social_connection_candidates").delete().eq("id", candidate.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { connectionId } = await request.json();
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  const { error } = await auth.admin.from("social_connections").delete().eq("id", connectionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
