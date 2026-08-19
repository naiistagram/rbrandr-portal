import { getPreviewClient } from "@/lib/admin-preview-guard";
import { getClientProjectScope } from "@/lib/admin-client-scope";
import { ContractsClient } from "@/app/(portal)/contracts/contracts-client";

export const dynamic = "force-dynamic";

export default async function ClientContractsPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;
  const { admin } = await getPreviewClient(clientId);
  const { projectIds } = await getClientProjectScope(admin, clientId);

  const { data: contracts } = projectIds.length > 0
    ? await admin.from("contracts").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
    : { data: [] };

  return <ContractsClient initialContracts={contracts ?? []} userId={clientId} preview />;
}
