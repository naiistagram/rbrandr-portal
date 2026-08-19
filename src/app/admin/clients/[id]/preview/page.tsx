import { getPreviewClient } from "@/lib/admin-preview-guard";
import { getClientProjectScope } from "@/lib/admin-client-scope";
import { DashboardClient } from "@/app/(portal)/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;
  const { admin, client } = await getPreviewClient(clientId);
  const { projects, projectIds, ownedProjectIds } = await getClientProjectScope(admin, clientId);

  const isCeo = (client.client_role ?? "ceo") === "ceo";

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
    <div className="flex flex-col flex-1">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-bold text-[var(--foreground)]">Dashboard</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Welcome back, {client.full_name.split(" ")[0]}
        </p>
      </div>

      <DashboardClient
        projects={projects}
        allContent={allContent ?? []}
        pendingForms={pendingForms ?? []}
        pendingContracts={pendingContracts ?? []}
        openTickets={openTickets ?? []}
        preview
      />
    </div>
  );
}
