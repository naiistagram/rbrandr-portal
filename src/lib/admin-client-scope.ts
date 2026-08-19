import type { createAdminClient } from "@/lib/supabase/admin";
import type { Project } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolves which projects a client can see — owned directly (client_id) plus
 * any they're a member of — for use by admin-only read paths that preview a
 * specific client's portal. Mirrors the scoping each /api/* route does for
 * the logged-in user, but keyed by an arbitrary target clientId.
 */
export async function getClientProjectScope(admin: AdminClient, clientId: string) {
  const [{ data: ownedData }, { data: memberData }] = await Promise.all([
    admin.from("projects").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    admin.from("project_members").select("project_id, projects(*)").eq("user_id", clientId),
  ]);

  const ownedProjects: Project[] = ownedData ?? [];
  const memberProjects = (memberData ?? [])
    .map((m) => ((m as unknown) as { projects: Project }).projects)
    .filter(Boolean);

  const ownedIds = new Set(ownedProjects.map((p) => p.id));
  const projects = [
    ...ownedProjects,
    ...memberProjects.filter((p) => !ownedIds.has(p.id)),
  ];

  return {
    projects,
    projectIds: projects.map((p) => p.id),
    ownedProjectIds: ownedProjects.map((p) => p.id),
  };
}
