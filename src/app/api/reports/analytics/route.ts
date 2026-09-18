import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: ownedProjects }, { data: memberships }] = await Promise.all([
    admin.from("projects").select("id, name").eq("client_id", user.id),
    admin.from("project_members").select("project_id").eq("user_id", user.id),
  ]);
  const projectIds = [...new Set([...(ownedProjects ?? []).map((project) => project.id), ...(memberships ?? []).map((member) => member.project_id)])];
  if (!projectIds.length) return NextResponse.json({ metrics: [], connections: [] });

  const requestedDays = Number(request.nextUrl.searchParams.get("days") ?? 30);
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.round(requestedDays), 7), 90) : 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);
  const [{ data: metrics, error: metricsError }, { data: connections, error: connectionsError }, { data: latestSync }] = await Promise.all([
    admin.from("social_metric_snapshots").select("project_id, platform, metric, metric_date, value").in("project_id", projectIds).gte("metric_date", since.toISOString().slice(0, 10)).order("metric_date"),
    admin.from("social_connections").select("project_id, platform, account_name").in("project_id", projectIds).eq("provider", "meta"),
    admin.from("social_analytics_syncs").select("project_id, status, metrics_written, message, created_at").in("project_id", projectIds).eq("provider", "meta").order("created_at", { ascending: false }).limit(1),
  ]);
  if (metricsError || connectionsError) return NextResponse.json({ error: metricsError?.message ?? connectionsError?.message }, { status: 500 });
  return NextResponse.json({ metrics: metrics ?? [], connections: connections ?? [], latestSync: latestSync?.[0] ?? null, days });
}
