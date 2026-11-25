import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAdmin } from "@/lib/social-auth";
import { SYNCABLE_PLATFORMS, syncAndStore, type SyncableConnection } from "@/lib/social-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { projectId?: string; days?: number };
  if (!body.projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const days = typeof body.days === "number" ? body.days : 30;
  const { data: connections, error } = await auth.admin.from("social_connections")
    .select("id, project_id, provider, platform, account_id, encrypted_access_token")
    .eq("project_id", body.projectId)
    .in("platform", [...SYNCABLE_PLATFORMS]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!connections?.length) return NextResponse.json({ error: "Connect a social account before syncing performance." }, { status: 400 });

  const results = await Promise.all((connections as SyncableConnection[]).map((connection) => syncAndStore(auth.admin, connection, days)));
  const metricsWritten = results.reduce((sum, result) => sum + result.metricsWritten, 0);
  const contentWritten = results.reduce((sum, result) => sum + result.contentWritten, 0);
  const errors = results.flatMap((result) => result.errors);
  const status = errors.length === 0 ? "success" : metricsWritten || contentWritten ? "partial" : "failed";
  return NextResponse.json({ status, metricsWritten, contentWritten, errors });
}
