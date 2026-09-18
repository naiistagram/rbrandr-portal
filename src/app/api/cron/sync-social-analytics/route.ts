import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncMetaConnection, type MetaConnection } from "@/lib/social-analytics";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: connections, error } = await admin.from("social_connections")
    .select("id, project_id, provider, platform, account_id, encrypted_access_token")
    .eq("provider", "meta").in("platform", ["Facebook", "Instagram"]).limit(12);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const outcomes = [];
  for (const connection of (connections ?? []) as MetaConnection[]) {
    const result = await syncMetaConnection(connection, 30);
    if (result.rows.length) {
      const { error: upsertError } = await admin.from("social_metric_snapshots").upsert(result.rows, { onConflict: "project_id,platform,account_id,metric,metric_date" });
      if (upsertError) result.errors.push(upsertError.message);
    }
    const status = result.errors.length === 0 ? "success" : result.rows.length ? "partial" : "failed";
    await admin.from("social_analytics_syncs").insert({ project_id: connection.project_id, provider: "meta", status, metrics_written: result.rows.length, message: result.errors.join(" ").slice(0, 1800) || null });
    outcomes.push({ connectionId: connection.id, status, metricsWritten: result.rows.length });
  }
  return NextResponse.json({ processed: outcomes.length, outcomes });
}
