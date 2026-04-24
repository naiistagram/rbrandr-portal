import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Users, FileText, Clock, CheckCircle2, XCircle,
  BarChart3, ImageIcon, FolderOpen, BookOpen, Milestone, TicketIcon,
  MessageSquare, ScrollText, Calendar, ExternalLink, Film, Camera,
} from "lucide-react";
import { cn, formatDate, getInitials, STATUS_CONFIG } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = ["Overview", "Content", "Assets", "Documents", "Timeline", "Forms", "Contracts & T&Cs", "Reports", "Tickets", "Feedback"] as const;
type Tab = typeof TABS[number];

const PLATFORM_PILL: Record<string, string> = {
  Instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Facebook: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TikTok: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  LinkedIn: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "Twitter/X": "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  YouTube: "bg-red-500/10 text-red-400 border-red-500/20",
  Email: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Blog: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};
const TYPE_PILL: Record<string, string> = {
  post: "bg-sky-500/15 text-sky-400",
  story: "bg-purple-500/15 text-purple-400",
  reel: "bg-pink-500/15 text-pink-400",
  ad: "bg-orange-500/15 text-orange-400",
  email: "bg-emerald-500/15 text-emerald-400",
  blog: "bg-amber-500/15 text-amber-400",
  other: "bg-zinc-500/15 text-zinc-400",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  urgent: "text-red-400",
};

function contentIcon(type: string) {
  if (type === "reel" || type === "story") return Film;
  if (type === "post" || type === "ad") return Camera;
  return FileText;
}

function isImage(url: string) {
  return /\.(png|jpg|jpeg|gif|webp)/i.test(url) || (!url.includes(".pdf") && !url.includes(".zip"));
}

function ClientBadge({ clientId, name, companyName }: { clientId: string; name: string; companyName: string }) {
  return (
    <Link
      href={`/admin/clients/${clientId}`}
      className="inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      {name} <ExternalLink className="w-2.5 h-2.5" />
    </Link>
  );
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { name } = await params;
  const { tab: tabParam } = await searchParams;
  const companyName = decodeURIComponent(name);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: adminProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (adminProfile?.role !== "admin") redirect("/admin/dashboard");

  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "Overview";

  // Fetch all clients and filter by normalized company name to handle
  // case/whitespace inconsistencies stored in DB (e.g. "ACME " vs "acme")
  const normalizedTarget = companyName.toLowerCase().trim();
  const { data: allClientProfiles } = await admin
    .from("profiles")
    .select("id, full_name, email, avatar_url, client_role, job_title, created_at, service_type, company_name")
    .eq("role", "client")
    .order("created_at", { ascending: true });

  const clients = (allClientProfiles ?? []).filter(
    (c) => c.company_name?.toLowerCase().trim() === normalizedTarget
  );

  if (clients.length === 0) redirect("/admin/clients");

  const clientIds = clients.map((c) => c.id);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  // All projects owned by these clients
  const { data: projects } = await admin
    .from("projects")
    .select("id, name, service_type, status, client_id, goals, created_at")
    .in("client_id", clientIds)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);
  const projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p]));

  const hasProjects = projectIds.length > 0;

  // Team members across all projects
  const { data: memberships } = hasProjects
    ? await admin
        .from("project_members")
        .select("user_id, project_id, profiles(id, full_name, email, job_title, client_role)")
        .in("project_id", projectIds)
    : { data: [] };

  // All data aggregated across all projects
  const [
    { data: content },
    { data: contracts },
    { data: reports },
    { data: assets },
    { data: documents },
    { data: milestones },
    { data: forms },
    { data: tickets },
    { data: feedback },
  ] = await Promise.all([
    hasProjects
      ? admin.from("content_items").select("*, profiles!created_by(full_name)").in("project_id", projectIds).order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("contracts").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("reports").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("assets").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("documents").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("milestones").select("*").in("project_id", projectIds).order("due_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("forms").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin.from("tickets").select("*").in("submitted_by", clientIds).order("created_at", { ascending: false }),
    admin.from("feedback").select("*, profiles(full_name, email)").in("submitted_by", clientIds).order("created_at", { ascending: false }),
  ]);

  const tabCounts: Record<Tab, number> = {
    "Overview": clients.length,
    "Content": (content ?? []).length,
    "Assets": (assets ?? []).length,
    "Documents": (documents ?? []).length,
    "Timeline": (milestones ?? []).length,
    "Forms": (forms ?? []).length,
    "Contracts & T&Cs": (contracts ?? []).length,
    "Reports": (reports ?? []).length,
    "Tickets": (tickets ?? []).length,
    "Feedback": (feedback ?? []).length,
  };

  function tabHref(t: Tab) {
    return `?tab=${encodeURIComponent(t)}`;
  }

  function EmptyState({ label }: { label: string }) {
    return <p className="text-sm text-[var(--foreground-subtle)] py-10 text-center">{label}</p>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-4 flex-shrink-0">
        <Link href="/admin/clients" className="flex items-center gap-1.5 text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors mb-3 w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Clients
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)]">{companyName}</h1>
            <p className="text-xs text-[var(--foreground-subtle)]">
              {clients.length} contact{clients.length !== 1 ? "s" : ""} · {(projects ?? []).length} project{(projects ?? []).length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-[var(--border)] flex-shrink-0 px-2" style={{ background: "#111113" }}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            className={cn(
              "px-4 py-3 text-sm font-medium whitespace-nowrap flex-shrink-0 border-b-2 transition-colors",
              tab === t
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            )}
          >
            {t}
            {tabCounts[t] > 0 && (
              <span className="ml-1.5 text-[10px] bg-[var(--surface-2)] text-[var(--foreground-subtle)] px-1.5 py-0.5 rounded-full">
                {tabCounts[t]}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="flex-1 p-6 max-w-5xl">

        {/* ── OVERVIEW ── */}
        {tab === "Overview" && (
          <div className="space-y-6">
            {/* Contacts */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--foreground-subtle)]" />
                <h2 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Contacts</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clients.map((c) => {
                  const teamMembers = (memberships ?? []).filter(
                    (m) => projectMap[(m as { project_id: string }).project_id]?.client_id === c.id
                  );
                  return (
                    <Link
                      key={c.id}
                      href={`/admin/clients/${c.id}`}
                      className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-zinc-600 transition-all space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-xs font-bold text-[var(--accent)] flex-shrink-0">
                          {(c as { avatar_url?: string | null }).avatar_url
                            ? <img src={(c as { avatar_url: string }).avatar_url} alt={c.full_name} className="w-full h-full object-cover rounded-full" />
                            : getInitials(c.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--foreground)] truncate">{c.full_name}</p>
                          <p className="text-xs text-[var(--foreground-subtle)] truncate">{c.email}</p>
                          {c.job_title && (
                            <p className="text-[10px] text-[var(--foreground-subtle)]">{c.job_title}</p>
                          )}
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
                            const prof = (m as unknown as { profiles: { id: string; full_name: string; email: string; job_title?: string } }).profiles;
                            return (
                              <div key={(m as { user_id: string }).user_id} className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
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

            {/* Projects summary */}
            {(projects ?? []).length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[var(--foreground-subtle)]" />
                  <h2 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Projects</h2>
                </div>
                <div className="space-y-2">
                  {(projects ?? []).map((proj) => {
                    const owner = clientMap[proj.client_id];
                    const projContent = (content ?? []).filter((c) => (c as { project_id: string }).project_id === proj.id);
                    return (
                      <Link
                        key={proj.id}
                        href={`/admin/clients/${proj.client_id}`}
                        className="flex items-center gap-4 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-zinc-600 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--foreground)] truncate">{proj.name}</p>
                          <p className="text-xs text-[var(--foreground-subtle)]">
                            {owner?.full_name} · {projContent.length} item{projContent.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          proj.status === "active" ? "bg-emerald-400/10 text-emerald-400" :
                          proj.status === "draft" ? "bg-zinc-400/10 text-zinc-400" :
                          "bg-amber-400/10 text-amber-400"
                        )}>
                          {proj.status}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── CONTENT ── */}
        {tab === "Content" && (
          <div className="space-y-2">
            {(content ?? []).length === 0 ? <EmptyState label="No content yet." /> : (
              (content ?? []).map((item) => {
                const i = item as typeof item & { profiles?: { full_name: string } | null };
                const cfg = STATUS_CONFIG[i.status as keyof typeof STATUS_CONFIG];
                const proj = projectMap[(i as { project_id: string }).project_id];
                const owner = proj ? clientMap[proj.client_id] : null;
                const Icon = contentIcon(i.content_type ?? "post");
                return (
                  <Link
                    key={i.id}
                    href={`/admin/clients/${proj?.client_id}?tab=Content`}
                    className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-zinc-600 transition-all"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 text-[var(--foreground-subtle)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{i.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-[10px] text-[var(--foreground-subtle)]">{proj?.name}</span>
                        {i.profiles?.full_name && (
                          <span className="text-[10px] text-[var(--foreground-subtle)]">by {i.profiles.full_name}</span>
                        )}
                        <span className="text-[10px] text-[var(--foreground-subtle)]">{formatDate(i.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {i.content_type && (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", TYPE_PILL[i.content_type] ?? "bg-zinc-500/15 text-zinc-400")}>
                          {i.content_type}
                        </span>
                      )}
                      {i.platform && (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", PLATFORM_PILL[i.platform] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")}>
                          {i.platform}
                        </span>
                      )}
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-400/10", cfg?.color ?? "text-zinc-400")}>
                        {cfg?.label ?? i.status}
                      </span>
                    </div>
                    {owner && (
                      <ClientBadge clientId={owner.id} name={owner.full_name} companyName={companyName} />
                    )}
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* ── ASSETS ── */}
        {tab === "Assets" && (
          <div className="space-y-2">
            {(assets ?? []).length === 0 ? <EmptyState label="No assets yet." /> : (
              (assets ?? []).map((asset) => {
                const a = asset as { id: string; name: string; category: string; url: string; created_at: string; project_id: string };
                const proj = projectMap[a.project_id];
                const owner = proj ? clientMap[proj.client_id] : null;
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {isImage(a.url) ? (
                        <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-[var(--foreground-subtle)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{a.name}</p>
                      <p className="text-xs text-[var(--foreground-subtle)]">{proj?.name} · {formatDate(a.created_at)}</p>
                    </div>
                    <span className="text-[10px] bg-[var(--surface-2)] text-[var(--foreground-subtle)] px-1.5 py-0.5 rounded-full">{a.category}</span>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent)] hover:underline flex-shrink-0">
                      View
                    </a>
                    {owner && <ClientBadge clientId={owner.id} name={owner.full_name} companyName={companyName} />}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {tab === "Documents" && (
          <div className="space-y-2">
            {(documents ?? []).length === 0 ? <EmptyState label="No documents yet." /> : (
              (documents ?? []).map((doc) => {
                const d = doc as { id: string; title: string; description?: string | null; file_url: string; created_at: string; project_id: string };
                const proj = projectMap[d.project_id];
                const owner = proj ? clientMap[proj.client_id] : null;
                return (
                  <div key={d.id} className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
                    <BookOpen className="w-4 h-4 text-[var(--foreground-subtle)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{d.title}</p>
                      {d.description && <p className="text-xs text-[var(--foreground-subtle)] truncate">{d.description}</p>}
                      <p className="text-[10px] text-[var(--foreground-subtle)]">{proj?.name} · {formatDate(d.created_at)}</p>
                    </div>
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent)] hover:underline flex-shrink-0">
                      View
                    </a>
                    {owner && <ClientBadge clientId={owner.id} name={owner.full_name} companyName={companyName} />}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TIMELINE / MILESTONES ── */}
        {tab === "Timeline" && (
          <div className="space-y-2">
            {(milestones ?? []).length === 0 ? <EmptyState label="No milestones yet." /> : (
              (milestones ?? []).map((ms) => {
                const m = ms as { id: string; title: string; description?: string | null; due_date?: string | null; completed: boolean; project_id: string };
                const proj = projectMap[m.project_id];
                const owner = proj ? clientMap[proj.client_id] : null;
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
                    {m.completed
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      : <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", m.completed ? "line-through text-[var(--foreground-subtle)]" : "text-[var(--foreground)]")}>
                        {m.title}
                      </p>
                      <p className="text-[10px] text-[var(--foreground-subtle)]">
                        {proj?.name}
                        {m.due_date && ` · due ${formatDate(m.due_date)}`}
                      </p>
                    </div>
                    {owner && <ClientBadge clientId={owner.id} name={owner.full_name} companyName={companyName} />}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── FORMS ── */}
        {tab === "Forms" && (
          <div className="space-y-2">
            {(forms ?? []).length === 0 ? <EmptyState label="No forms yet." /> : (
              (forms ?? []).map((form) => {
                const f = form as { id: string; title: string; status: string; created_at: string; project_id: string };
                const proj = projectMap[f.project_id];
                const owner = proj ? clientMap[proj.client_id] : null;
                return (
                  <Link
                    key={f.id}
                    href={`/admin/clients/${proj?.client_id}?tab=Forms`}
                    className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-zinc-600 transition-all"
                  >
                    <ScrollText className="w-4 h-4 text-[var(--foreground-subtle)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{f.title}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)]">{proj?.name} · {formatDate(f.created_at)}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      f.status === "completed" ? "bg-emerald-400/10 text-emerald-400" :
                      f.status === "pending" ? "bg-amber-400/10 text-amber-400" :
                      "bg-zinc-400/10 text-zinc-400"
                    )}>
                      {f.status}
                    </span>
                    {owner && <ClientBadge clientId={owner.id} name={owner.full_name} companyName={companyName} />}
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* ── CONTRACTS & T&Cs ── */}
        {tab === "Contracts & T&Cs" && (
          <div className="space-y-2">
            {(contracts ?? []).length === 0 ? <EmptyState label="No contracts yet." /> : (
              (contracts ?? []).map((contract) => {
                const c = contract as { id: string; title: string; status: string; type?: string; file_url: string; created_at: string; project_id: string };
                const proj = projectMap[c.project_id];
                const owner = proj ? clientMap[proj.client_id] : null;
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
                    <FileText className="w-4 h-4 text-[var(--foreground-subtle)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{c.title}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)]">{proj?.name} · {formatDate(c.created_at)}</p>
                    </div>
                    {c.type && <span className="text-[10px] bg-[var(--surface-2)] text-[var(--foreground-subtle)] px-1.5 py-0.5 rounded-full">{c.type}</span>}
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      c.status === "signed" ? "bg-emerald-400/10 text-emerald-400" :
                      c.status === "pending" ? "bg-amber-400/10 text-amber-400" :
                      "bg-zinc-400/10 text-zinc-400"
                    )}>
                      {c.status}
                    </span>
                    <a href={c.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent)] hover:underline flex-shrink-0">
                      View
                    </a>
                    {owner && <ClientBadge clientId={owner.id} name={owner.full_name} companyName={companyName} />}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── REPORTS ── */}
        {tab === "Reports" && (
          <div className="space-y-2">
            {(reports ?? []).length === 0 ? <EmptyState label="No reports yet." /> : (
              (reports ?? []).map((report) => {
                const r = report as { id: string; title: string; period?: string | null; file_url: string; created_at: string; project_id: string };
                const proj = projectMap[r.project_id];
                const owner = proj ? clientMap[proj.client_id] : null;
                return (
                  <div key={r.id} className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
                    <BarChart3 className="w-4 h-4 text-[var(--foreground-subtle)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{r.title}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)]">
                        {proj?.name}{r.period ? ` · ${r.period}` : ""} · {formatDate(r.created_at)}
                      </p>
                    </div>
                    <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent)] hover:underline flex-shrink-0">
                      View
                    </a>
                    {owner && <ClientBadge clientId={owner.id} name={owner.full_name} companyName={companyName} />}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TICKETS ── */}
        {tab === "Tickets" && (
          <div className="space-y-2">
            {(tickets ?? []).length === 0 ? <EmptyState label="No tickets yet." /> : (
              (tickets ?? []).map((ticket) => {
                const t = ticket as { id: string; title: string; status: string; priority: string; created_at: string; submitted_by: string; admin_response?: string | null };
                const submitter = clientMap[t.submitted_by];
                return (
                  <Link
                    key={t.id}
                    href={`/admin/clients/${t.submitted_by}?tab=Tickets`}
                    className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-zinc-600 transition-all"
                  >
                    <TicketIcon className="w-4 h-4 text-[var(--foreground-subtle)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{t.title}</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)]">
                        {submitter?.full_name} · {formatDate(t.created_at)}
                      </p>
                    </div>
                    <span className={cn("text-[10px] font-semibold", PRIORITY_COLORS[t.priority] ?? "text-zinc-400")}>{t.priority}</span>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      t.status === "open" ? "bg-amber-400/10 text-amber-400" :
                      t.status === "closed" ? "bg-zinc-400/10 text-zinc-400" :
                      "bg-emerald-400/10 text-emerald-400"
                    )}>
                      {t.status}
                    </span>
                    {submitter && <ClientBadge clientId={submitter.id} name={submitter.full_name} companyName={companyName} />}
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* ── FEEDBACK ── */}
        {tab === "Feedback" && (
          <div className="space-y-2">
            {(feedback ?? []).length === 0 ? <EmptyState label="No feedback yet." /> : (
              (feedback ?? []).map((fb) => {
                const f = fb as { id: string; message: string; rating?: number | null; created_at: string; submitted_by: string; admin_reply?: string | null; profiles?: { full_name: string; email: string } | null };
                const submitter = clientMap[f.submitted_by] ?? f.profiles;
                return (
                  <Link
                    key={f.id}
                    href={`/admin/clients/${f.submitted_by}?tab=Feedback`}
                    className="flex items-start gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-zinc-600 transition-all"
                  >
                    <MessageSquare className="w-4 h-4 text-[var(--foreground-subtle)] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {submitter && "full_name" in submitter && (
                          <span className="text-xs font-medium text-[var(--foreground)]">{(submitter as { full_name: string }).full_name}</span>
                        )}
                        {f.rating && (
                          <span className="text-[10px] text-amber-400">{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span>
                        )}
                        <span className="text-[10px] text-[var(--foreground-subtle)]">{formatDate(f.created_at)}</span>
                      </div>
                      <p className="text-sm text-[var(--foreground-muted)] line-clamp-2">{f.message}</p>
                      {f.admin_reply && (
                        <p className="text-xs text-[var(--foreground-subtle)] mt-1 pl-2 border-l border-[var(--border)]">Reply: {f.admin_reply}</p>
                      )}
                    </div>
                    {f.submitted_by && clientMap[f.submitted_by] && (
                      <ClientBadge clientId={f.submitted_by} name={clientMap[f.submitted_by].full_name} companyName={companyName} />
                    )}
                  </Link>
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
