import { getPreviewClient } from "@/lib/admin-preview-guard";
import { getClientProjectScope } from "@/lib/admin-client-scope";
import { ContentClient } from "@/app/(portal)/content/content-client";

export const dynamic = "force-dynamic";

export default async function ClientContentPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;
  const { admin } = await getPreviewClient(clientId);
  const { projectIds } = await getClientProjectScope(admin, clientId);

  const { data: items } = projectIds.length > 0
    ? await admin.from("content_items").select("*").in("project_id", projectIds).order("updated_at", { ascending: false })
    : { data: [] };

  return (
    <ContentClient
      initialItems={items ?? []}
      initialProjectId={projectIds[0] ?? null}
      userId={clientId}
      preview
    />
  );
}
