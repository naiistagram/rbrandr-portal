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
    .eq("provider", "meta").in("platform", ["Facebook", "Instagram"])
    // Least recently touched first, so if a run hits the time budget the
    // accounts it skipped are first in line next time.
    .order("updated_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const startedAt = Date.now();
  const queue = [...((connections ?? []) as MetaConnection[])];
  const outcomes: Array<{ connectionId: string; status: string; metricsWritten: number; contentWritten: number }> = [];
  async function worker() {
    for (let connection = queue.shift(); connection; connection = queue.shift()) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) return;
      outcomes.push(await syncOne(connection));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return NextResponse.json({ processed: outcomes.length, remaining: queue.length, outcomes });
}

const CONCURRENCY = 4;
// Leave headroom under maxDuration for in-flight syncs to finish.
const TIME_BUDGET_MS = 40_000;

async function syncOne(connection: MetaConnection) {
  const admin = createAdminClient();
  const result = await syncMetaConnection(connection, 30);
  if (result.rows.length) {
    const { error: upsertError } = await admin.from("social_metric_snapshots").upsert(result.rows, { onConflict: "project_id,platform,account_id,metric,metric_date" });
    if (upsertError) result.errors.push(upsertError.message);
  }
  if (result.contentRows.length) {
    const { error: contentUpsertError } = await admin.from("social_content_metrics").upsert(result.contentRows, {
      onConflict: "project_id,platform,account_id,external_post_id",
    });
    if (contentUpsertError) result.errors.push(contentUpsertError.message);
  }
  const status = result.errors.length === 0 ? "success" : result.rows.length ? "partial" : "failed";
  await admin.from("social_analytics_syncs").insert({ project_id: connection.project_id, provider: "meta", status, metrics_written: result.rows.length, message: result.errors.join(" ").slice(0, 1800) || null });
  await admin.from("social_connections").update({ updated_at: new Date().toISOString() }).eq("id", connection.id);
  return { connectionId: connection.id, status, metricsWritten: result.rows.length, contentWritten: result.contentRows.length };
}
