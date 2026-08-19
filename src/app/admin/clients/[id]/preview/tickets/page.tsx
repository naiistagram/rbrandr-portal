import { getPreviewClient } from "@/lib/admin-preview-guard";
import { getClientProjectScope } from "@/lib/admin-client-scope";
import { TicketsClient } from "@/app/(portal)/tickets/tickets-client";

export const dynamic = "force-dynamic";

export default async function ClientTicketsPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;
  const { admin } = await getPreviewClient(clientId);
  const { projectIds } = await getClientProjectScope(admin, clientId);

  const { data: tickets } = projectIds.length > 0
    ? await admin.from("tickets").select("*").in("project_id", projectIds).eq("submitted_by", clientId).order("created_at", { ascending: false })
    : { data: [] };

  return (
    <TicketsClient
      initialTickets={tickets ?? []}
      initialProjectId={projectIds[0] ?? null}
      userId={clientId}
      preview
    />
  );
}
