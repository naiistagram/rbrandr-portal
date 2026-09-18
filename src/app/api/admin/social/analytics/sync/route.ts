import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAdmin } from "@/lib/social-auth";
import { syncMetaConnection, type MetaConnection } from "@/lib/social-analytics";

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
    .eq("provider", "meta")
    .in("platform", ["Facebook", "Instagram"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!connections?.length) return NextResponse.json({ error: "Connect an Instagram or Facebook account before syncing performance." }, { status: 400 });

  const results = await Promise.all((connections as MetaConnection[]).map((connection) => syncMetaConnection(connection, days)));
  const rows = results.flatMap((result) => result.rows);
  const errors = results.flatMap((result) => result.errors);
  let written = 0;
  if (rows.length) {
    const { error: upsertError } = await auth.admin.from("social_metric_snapshots").upsert(rows, {
      onConflict: "project_id,platform,account_id,metric,metric_date",
    });
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
    written = rows.length;
  }

  const status = errors.length === 0 ? "success" : written > 0 ? "partial" : "failed";
  await auth.admin.from("social_analytics_syncs").insert({
    project_id: body.projectId, provider: "meta", status, metrics_written: written,
    message: errors.length ? errors.join(" ").slice(0, 1800) : null,
  });
  return NextResponse.json({ status, metricsWritten: written, errors });
}
