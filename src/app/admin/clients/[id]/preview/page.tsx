import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardClient } from "@/app/(portal)/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: requester } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (requester?.role !== "admin") redirect("/dashboard");

  const { data: client } = await admin.from("profiles").select("*").eq("id", clientId).eq("role", "client").single();
  if (!client) notFound();

  const [{ data: ownedData }, { data: memberData }] = await Promise.all([
    admin.from("projects").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    admin.from("project_members").select("project_id, projects(*)").eq("user_id", clientId),
  ]);

  const ownedProjects = ownedData ?? [];
  const memberProjects = (memberData ?? [])
    .map((m) => ((m as unknown) as { projects: import("@/lib/supabase/types").Project }).projects)
    .filter(Boolean);

  const seenIds = new Set(ownedProjects.map((p) => p.id));
  const projects = [
    ...ownedProjects,
    ...memberProjects.filter((p) => !seenIds.has(p.id)),
  ];

  const projectIds = projects.map((p) => p.id);
  const isCeo = (client.client_role ?? "ceo") === "ceo";
  const ownedProjectIds = ownedProjects.map((p) => p.id);

  const [{ data: allContent }, { data: pendingForms }, { data: pendingContracts }, { data: openTickets }] =
    await Promise.all([
      projectIds.length > 0
        ? admin.from("content_items").select("*").in("project_id", projectIds).order("updated_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? admin.from("forms").select("*").in("project_id", projectIds).eq("status", "pending").limit(10)
        : Promise.resolve({ data: [] }),
      isCeo && ownedProjectIds.length > 0
        ? admin.from("contracts").select("id, title, status").in("project_id", ownedProjectIds).eq("status", "pending").limit(10)
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? admin.from("tickets").select("id, title, status, priority").in("project_id", projectIds).eq("status", "open").limit(10)
        : Promise.resolve({ data: [] }),
    ]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-amber-400/20 bg-amber-400/5 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <Eye className="w-4 h-4" />
          <span className="font-medium">Previewing {client.full_name}&rsquo;s dashboard</span>
          <span className="text-amber-400/60">— read-only, exactly what they see</span>
        </div>
        <Link
          href={`/admin/clients/${clientId}`}
          className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Exit preview
        </Link>
      </div>

      <div className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-bold text-[var(--foreground)]">Dashboard</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Welcome back, {client.full_name.split(" ")[0]}
        </p>
      </div>

      <DashboardClient
        projects={projects ?? []}
        allContent={allContent ?? []}
        pendingForms={pendingForms ?? []}
        pendingContracts={pendingContracts ?? []}
        openTickets={openTickets ?? []}
        preview
      />
    </div>
  );
}
