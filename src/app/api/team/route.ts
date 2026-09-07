import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Returns the contacts who share at least one project with the signed-in client. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: ownedProjects }, { data: memberships }] = await Promise.all([
    admin.from("projects").select("id, client_id").eq("client_id", user.id),
    admin.from("project_members").select("project_id").eq("user_id", user.id),
  ]);

  const projectIds = Array.from(new Set([
    ...(ownedProjects ?? []).map((project) => project.id),
    ...(memberships ?? []).map((membership) => membership.project_id),
  ]));
  if (projectIds.length === 0) return NextResponse.json({ members: [] });

  const [{ data: projects }, { data: memberRows }] = await Promise.all([
    admin.from("projects").select("client_id").in("id", projectIds),
    admin
      .from("project_members")
      .select("profiles(id, full_name, email, avatar_url, job_title, client_role)")
      .in("project_id", projectIds),
  ]);

  const profileIds = new Set<string>([
    ...(projects ?? []).map((project) => project.client_id),
    ...(memberRows ?? [])
      .map((row) => (row.profiles as { id?: string } | null)?.id)
      .filter((id): id is string => Boolean(id)),
  ]);
  profileIds.delete(user.id);

  if (profileIds.size === 0) return NextResponse.json({ members: [] });

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, email, avatar_url, job_title, client_role")
    .in("id", [...profileIds])
    .order("full_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ members: profiles ?? [] });
}
