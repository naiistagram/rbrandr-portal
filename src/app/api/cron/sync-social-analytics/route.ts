import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SYNCABLE_PLATFORMS, syncAndStore, type SyncableConnection } from "@/lib/social-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

const CONCURRENCY = 4;
// Leave headroom under maxDuration for in-flight syncs to finish.
const TIME_BUDGET_MS = 40_000;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: connections, error } = await admin.from("social_connections")
    .select("id, project_id, provider, platform, account_id, encrypted_access_token")
    .in("platform", [...SYNCABLE_PLATFORMS])
    // Least recently synced first, so if a run hits the time budget the
    // accounts it skipped are first in line next time.
    .order("updated_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const startedAt = Date.now();
  const queue = [...((connections ?? []) as SyncableConnection[])];
  const outcomes: Array<Awaited<ReturnType<typeof syncAndStore>>> = [];
  async function worker() {
    for (let connection = queue.shift(); connection; connection = queue.shift()) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) return;
      outcomes.push(await syncAndStore(admin, connection, 30));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return NextResponse.json({
    processed: outcomes.length,
    remaining: queue.length,
    outcomes: outcomes.map(({ connectionId, platform, status, metricsWritten, contentWritten }) => ({ connectionId, platform, status, metricsWritten, contentWritten })),
  });
}
