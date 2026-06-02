import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: ownedProjects }, { data: memberRows }] = await Promise.all([
    admin.from("projects").select("id").eq("client_id", user.id),
    admin.from("project_members").select("project_id").eq("user_id", user.id),
  ]);

  const ids = new Set<string>((ownedProjects ?? []).map((p) => p.id));
  for (const r of memberRows ?? []) ids.add(r.project_id);
  const projectIds = Array.from(ids);

  if (projectIds.length === 0) return NextResponse.json({ reports: [] });

  const { data: reports } = await admin
    .from("reports")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  return NextResponse.json({ reports: reports ?? [] });
}
