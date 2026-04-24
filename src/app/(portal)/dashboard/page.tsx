import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Use admin client to avoid RLS issues reading own profile
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();

  // Always fetch both owned projects and projects via membership — a user can be both
  const [{ data: ownedData }, { data: memberData }] = await Promise.all([
    admin.from("projects").select("*").eq("client_id", user.id).order("created_at", { ascending: false }),
    admin.from("project_members").select("project_id, projects(*)").eq("user_id", user.id),
  ]);

  const ownedProjects = ownedData ?? [];
  const memberProjects = (memberData ?? [])
    .map((m) => ((m as unknown) as { projects: import("@/lib/supabase/types").Project }).projects)
    .filter(Boolean);

  // Deduplicate (user might appear as both client_id and project_member on the same project)
  const seenIds = new Set(ownedProjects.map((p) => p.id));
  const projects = [
    ...ownedProjects,
    ...memberProjects.filter((p) => !seenIds.has(p.id)),
  ];

  const projectIds = projects.map((p) => p.id);
  // Contracts are only relevant for projects the user owns directly
  const ownedProjectIds = ownedProjects.map((p) => p.id);

  const [{ data: allContent }, { data: pendingForms }, { data: pendingContracts }, { data: openTickets }] =
    await Promise.all([
      projectIds.length > 0
        ? admin.from("content_items").select("*").in("project_id", projectIds).order("updated_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? admin.from("forms").select("*").in("project_id", projectIds).eq("status", "pending").limit(10)
        : Promise.resolve({ data: [] }),
      // Contracts only shown for projects the user directly owns
      ownedProjectIds.length > 0
        ? admin.from("contracts").select("id, title, status").in("project_id", ownedProjectIds).eq("status", "pending").limit(10)
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? admin.from("tickets").select("id, title, status, priority").in("project_id", projectIds).eq("status", "open").limit(10)
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar
        title="Dashboard"
        subtitle={profile ? `Welcome back, ${profile.full_name.split(" ")[0]}` : ""}
        userId={user.id}
      />
      <DashboardClient
        projects={projects ?? []}
        allContent={allContent ?? []}
        pendingForms={pendingForms ?? []}
        pendingContracts={pendingContracts ?? []}
        openTickets={openTickets ?? []}
      />
    </div>
  );
}
