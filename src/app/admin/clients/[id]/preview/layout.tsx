import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { getPreviewClient } from "@/lib/admin-preview-guard";
import { PreviewTabs } from "./preview-tabs";

export const dynamic = "force-dynamic";

export default async function ClientPreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;
  const { client } = await getPreviewClient(clientId);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-amber-400/20 bg-amber-400/5 px-6 py-3 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <Eye className="w-4 h-4" />
          <span className="font-medium">Previewing {client.full_name}&rsquo;s portal</span>
          <span className="text-amber-400/60">— read-only, exactly what they see</span>
        </div>
        <Link
          href={`/admin/clients/${clientId}`}
          className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Exit preview
        </Link>
      </div>

      <PreviewTabs clientId={clientId} />

      {children}
    </div>
  );
}
