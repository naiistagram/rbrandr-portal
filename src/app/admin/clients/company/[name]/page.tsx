import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Users, FileText, Clock, CheckCircle2, XCircle } from "lucide-react";
import { cn, formatDate, getInitials, STATUS_CONFIG } from "@/lib/utils";
import type { ContentItem } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const companyName = decodeURIComponent(name);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: adminProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (adminProfile?.role !== "admin") redirect("/admin/dashboard");

  // All primary clients at this company
  const { data: clients } = await admin
    .from("profiles")
    .select("id, full_name, email, avatar_url, client_role, job_title, created_at")
    .eq("company_name", companyName)
    .eq("role", "client")
    .order("created_at", { ascending: true });

  if (!clients || clients.length === 0) redirect("/admin/clients");

  const clientIds = clients.map((c) => c.id);

  // All projects owned by these clients
  const { data: projects } = await admin
    .from("projects")
    .select("id, name, service_type, status, client_id")
    .in("client_id", clientIds);

  const projectIds = (projects ?? []).map((p) => p.id);

  // Team members linked to any of these projects
  const { data: memberships } = projectIds.length > 0
    ? await admin
        .from("project_members")
        .select("user_id, project_id, profiles(id, full_name, email, job_title, client_role)")
        .in("project_id", projectIds)
    : { data: [] };

  // All content from all these projects
  const { data: content } = projectIds.length > 0
    ? await admin
        .from("content_items")
        .select("id, title, status, platform, content_type, updated_at, project_id, created_by, profiles!created_by(full_name)")
        .in("project_id", projectIds)
        .order("updated_at", { ascending: false })
        .limit(100)
    : { data: [] };

  const projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p]));

  const statusIcon: Record<string, React.ElementType> = {
    draft: FileText,
    in_review: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
    published: CheckCircle2,
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-4">
        <Link href="/admin/clients" className="flex items-center gap-1.5 text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors mb-3 w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Clients
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)]">{companyName}</h1>
            <p className="text-xs text-[var(--foreground-subtle)]">{clients.length} contact{clients.length !== 1 ? "s" : ""} · {(content ?? []).length} content item{(content ?? []).length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 max-w-5xl">

        {/* Contacts */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--foreground-subtle)]" />
            <h2 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Contacts</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clients.map((c) => {
              const teamMembers = (memberships ?? []).filter(
                (m) => projectMap[m.project_id]?.client_id === c.id
              );
              return (
                <Link
                  key={c.id}
                  href={`/admin/clients/${c.id}`}
                  className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-zinc-600 transition-all space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-xs font-bold text-[var(--accent)] flex-shrink-0">
                      {c.avatar_url
                        ? <img src={c.avatar_url} alt={c.full_name} className="w-full h-full object-cover rounded-full" />
                        : getInitials(c.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">{c.full_name}</p>
                      <p className="text-xs text-[var(--foreground-subtle)] truncate">{c.email}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0",
                      c.client_role === "ceo" ? "bg-emerald-400/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
                    )}>
                      {c.client_role === "ceo" ? "CEO" : "member"}
                    </span>
                  </div>
                  {teamMembers.length > 0 && (
                    <div className="space-y-1 pl-12">
                      {teamMembers.map((m) => {
                        const prof = m.profiles as unknown as { id: string; full_name: string; email: string; job_title?: string };
                        return (
                          <div key={m.user_id} className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                            <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-300 flex-shrink-0">
                              {getInitials(prof.full_name)}
                            </div>
                            <span className="truncate">{prof.full_name}</span>
                            {prof.job_title && <span className="text-[var(--foreground-subtle)]">· {prof.job_title}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

        {/* All content */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--foreground-subtle)]" />
            <h2 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">All Content</h2>
            <span className="text-[10px] text-[var(--foreground-subtle)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded-full">{(content ?? []).length}</span>
          </div>

          {(content ?? []).length === 0 ? (
            <p className="text-sm text-[var(--foreground-subtle)] py-6 text-center">No content yet.</p>
          ) : (
            <div className="space-y-1.5">
              {(content as (ContentItem & { profiles?: { full_name: string } | null })[]).map((item) => {
                const StatusIcon = statusIcon[item.status] ?? FileText;
                const cfg = STATUS_CONFIG[item.status];
                const proj = projectMap[item.project_id];
                const submitter = item.profiles?.full_name;
                return (
                  <Link
                    key={item.id}
                    href={`/admin/clients/${proj?.client_id}?tab=Content`}
                    className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-zinc-600 transition-all"
                  >
                    <StatusIcon className={cn("w-4 h-4 flex-shrink-0", cfg?.color ?? "text-zinc-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)]">
                        {proj?.name}{submitter ? ` · by ${submitter}` : ""} · {formatDate(item.updated_at)}
                      </p>
                    </div>
                    {item.platform && (
                      <span className="text-[10px] text-[var(--foreground-subtle)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded-full flex-shrink-0">{item.platform}</span>
                    )}
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 bg-zinc-400/10", cfg?.color ?? "text-zinc-400")}>
                      {cfg?.label ?? item.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
