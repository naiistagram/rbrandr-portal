import type { SupabaseClient } from "@supabase/supabase-js";
import { syncMetaConnection, type MetaConnection } from "@/lib/social-analytics";
import { syncLinkedInConnection, type LinkedInConnection } from "@/lib/linkedin-analytics";

export type SyncableConnection = MetaConnection | LinkedInConnection;

export const SYNCABLE_PLATFORMS = ["Facebook", "Instagram", "LinkedIn"] as const;

/** Pulls one account's analytics and stores them. Never throws. */
export async function syncAndStore(admin: SupabaseClient, connection: SyncableConnection, days = 30) {
  const result = connection.provider === "linkedin"
    ? await syncLinkedInConnection(connection, days)
    : await syncMetaConnection(connection, days);
  const errors = [...result.errors];
  let metricsWritten = 0;
  let contentWritten = 0;
  if (result.rows.length) {
    const { error } = await admin.from("social_metric_snapshots").upsert(result.rows, { onConflict: "project_id,platform,account_id,metric,metric_date" });
    if (error) errors.push(error.message); else metricsWritten = result.rows.length;
  }
  if (result.contentRows.length) {
    const { error } = await admin.from("social_content_metrics").upsert(result.contentRows, { onConflict: "project_id,platform,account_id,external_post_id" });
    if (error) errors.push(error.message); else contentWritten = result.contentRows.length;
  }
  const status: "success" | "partial" | "failed" = errors.length === 0 ? "success" : metricsWritten || contentWritten ? "partial" : "failed";
  await admin.from("social_analytics_syncs").insert({
    project_id: connection.project_id, provider: connection.provider, status, metrics_written: metricsWritten,
    message: errors.join(" ").slice(0, 1800) || null,
  });
  // Bumps updated_at so the nightly job rotates through accounts fairly.
  await admin.from("social_connections").update({ updated_at: new Date().toISOString() }).eq("id", connection.id);
  return { connectionId: connection.id, platform: connection.platform, status, metricsWritten, contentWritten, errors };
}
