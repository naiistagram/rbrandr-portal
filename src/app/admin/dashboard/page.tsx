import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Users, FolderOpen, ScrollText, Clock, Plus, ArrowRight,
  FileText, Ticket, CheckCircle2, AlertCircle, MessageSquare, Send, Inbox,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [
    { data: clients },
    { data: projects },
    { data: pendingContracts },
    { data: contentInReview },
    { data: openTickets },
    { data: submittedForms },
    { data: publishedContent },
    { data: clientDraftContent },
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("role", "client").order("created_at", { ascending: false }),
    admin.from("projects").select("*").eq("status", "active"),
    admin.from("contracts").select("*").eq("status", "pending"),
    admin.from("content_items").select("*, projects(name, profiles(full_name, company_name))").eq("status", "in_review").order("updated_at", { ascending: false }).limit(10),
    admin.from("tickets").select("*, projects(name, profiles(full_name, company_name))").eq("status", "open").order("created_at", { ascending: false }).limit(10),
    admin.from("forms").select("*, projects(id, client_id, name, profiles(full_name, company_name))").eq("status", "submitted").order("submitted_at", { ascending: false }).limit(10),
    admin.from("content_items").select("*, projects(name, profiles(full_name, company_name))").eq("status", "published").order("updated_at", { ascending: false }).limit(15),
    admin.from("content_items").select("*, projects(name, profiles(full_name, company_name))").eq("status", "draft").order("created_at", { ascending: false }).limit(10),
  ]);

  const recentClients = (clients ?? []).slice(0, 5);

  const stats = [
    { label: "Total Clients", value: clients?.length ?? 0, icon: Users, color: "text-[var(--accent)]", bg: "bg-[var(--accent-subtle)]" },
    { label: "Active Projects", value: projects?.length ?? 0, icon: FolderOpen, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Content Requests", value: clientDraftContent?.length ?? 0, icon: Inbox, color: "text-violet-400", bg: "bg-violet-400/10" },
    { label: "Awaiting Review", value: contentInReview?.length ?? 0, icon: Clock, color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Published Posts", value: publishedContent?.length ?? 0, icon: Send, color: "text-sky-400", bg: "bg-sky-400/10" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-bold text-[var(--foreground)]">Overview</h1>
        <p className="text-sm text-[var(--foreground-muted)]">RBRANDRSPHERE admin panel</p>
      </div>

      <div className="flex-1 p-6 space-y-6 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
              <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Client Content Requests */}
        {(clientDraftContent?.length ?? 0) > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--accent)]/30 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Client Content Requests</h2>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-400/10 text-violet-400">
                  {clientDraftContent!.length}
                </span>
              </div>
              <span className="text-[10px] text-[var(--foreground-subtle)]">Needs your attention</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {clientDraftContent!.map((item) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const proj = item.projects as any;
                const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
                return (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-400/10 flex items-center justify-center flex-shrink-0">
                      <Inbox className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</p>
                      <p className="text-xs text-[var(--foreground-subtle)]">
                        {clientName} · {item.content_type}{item.platform ? ` · ${item.platform}` : ""}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(item.created_at)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Content awaiting review */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Content Awaiting Review</h2>
                {(contentInReview?.length ?? 0) > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-400/10 text-purple-400">
                    {contentInReview!.length}
                  </span>
                )}
              </div>
            </div>
            {(contentInReview?.length ?? 0) === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-[var(--foreground-muted)]">All clear</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {contentInReview!.map((item) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const proj = item.projects as any;
                  const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-7 h-7 rounded-lg bg-purple-400/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</p>
                        <p className="text-xs text-[var(--foreground-subtle)]">{clientName} · {item.platform ?? item.content_type}</p>
                      </div>
                      <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(item.updated_at)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Open tickets */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Open Tickets</h2>
                {(openTickets?.length ?? 0) > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-400/10 text-orange-400">
                    {openTickets!.length}
                  </span>
                )}
              </div>
            </div>
            {(openTickets?.length ?? 0) === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-[var(--foreground-muted)]">No open tickets</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {openTickets!.map((ticket) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const proj = ticket.projects as any;
                  const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
                  const urgentColor = ticket.priority === "urgent" ? "text-red-400 bg-red-400/10" :
                    ticket.priority === "high" ? "text-orange-400 bg-orange-400/10" :
                    "text-zinc-400 bg-zinc-400/10";
                  return (
                    <div key={ticket.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${urgentColor}`}>
                        <AlertCircle className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">{ticket.title}</p>
                        <p className="text-xs text-[var(--foreground-subtle)]">{clientName} · {ticket.priority} priority</p>
                      </div>
                      <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(ticket.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recently published content */}
        {(publishedContent?.length ?? 0) > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
              <Send className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Recently Published</h2>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-400/10 text-sky-400">
                {publishedContent!.length}
              </span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {publishedContent!.map((item) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const proj = item.projects as any;
                const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
                const platformColors: Record<string, string> = {
                  Instagram: "bg-pink-500/15 text-pink-400",
                  Facebook: "bg-blue-500/15 text-blue-400",
                  TikTok: "bg-rose-500/15 text-rose-400",
                  LinkedIn: "bg-sky-500/15 text-sky-400",
                  "Twitter/X": "bg-zinc-500/15 text-zinc-300",
                  YouTube: "bg-red-500/15 text-red-400",
                  Email: "bg-emerald-500/15 text-emerald-400",
                  Blog: "bg-amber-500/15 text-amber-400",
                };
                const platformClass = item.platform ? (platformColors[item.platform] ?? "bg-zinc-500/15 text-zinc-400") : "bg-zinc-500/15 text-zinc-400";
                return (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-lg bg-sky-400/10 flex items-center justify-center flex-shrink-0">
                      <Send className="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</p>
                      <p className="text-xs text-[var(--foreground-subtle)]">{clientName}</p>
                    </div>
                    {item.platform && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${platformClass}`}>
                        {item.platform}
                      </span>
                    )}
                    <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(item.updated_at)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Submitted forms */}
        {(submittedForms?.length ?? 0) > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Recently Submitted Forms</h2>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">
                {submittedForms!.length}
              </span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {submittedForms!.map((form) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const proj = form.projects as any;
                const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
                const clientId = proj?.client_id;
                return (
                  <Link
                    key={form.id}
                    href={clientId ? `/admin/clients/${clientId}?tab=Forms` : "#"}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-400/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{form.title}</p>
                      <p className="text-xs text-[var(--foreground-subtle)]">{clientName} · Click to view responses</p>
                    </div>
                    <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">
                      {form.submitted_at ? formatDate(form.submitted_at) : ""}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent clients */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Recent Clients</h2>
            <Link
              href="/admin/clients"
              className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentClients.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Users className="w-8 h-8 text-[var(--foreground-subtle)] mx-auto mb-2" />
              <p className="text-sm text-[var(--foreground-muted)]">No clients yet</p>
              <Link
                href="/admin/clients"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add your first client
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0 overflow-hidden text-xs font-bold text-[var(--accent)]">
                    {client.avatar_url ? (
                      <img src={client.avatar_url} alt={client.full_name} className="w-full h-full object-cover" />
                    ) : (
                      client.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{client.full_name}</p>
                    <p className="text-xs text-[var(--foreground-subtle)] truncate">{client.company_name ?? client.email}</p>
                  </div>
                  <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(client.created_at)}</p>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
