import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Users, FolderOpen, Clock, Plus, ArrowRight, Send, Inbox } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { AdminDashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [
    { data: clients },
    { data: projects },
    { data: contentInReview },
    { data: openTickets },
    { data: submittedForms },
    { data: publishedContent },
    { data: clientDraftContent },
    { data: recentlyUpdated },
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("role", "client").order("created_at", { ascending: false }),
    admin.from("projects").select("*").eq("status", "active"),
    admin.from("content_items").select("*, projects(id, client_id, name, profiles(full_name, company_name))").eq("status", "in_review").order("updated_at", { ascending: false }).limit(5),
    admin.from("tickets").select("*, projects(id, client_id, name, profiles(full_name, company_name))").eq("status", "open").order("created_at", { ascending: false }).limit(5),
    admin.from("forms").select("*, projects(id, client_id, name, profiles(full_name, company_name))").eq("status", "submitted").order("submitted_at", { ascending: false }).limit(5),
    admin.from("content_items").select("*, projects(id, client_id, name, profiles(full_name, company_name))").eq("status", "published").order("updated_at", { ascending: false }).limit(5),
    admin.from("content_items").select("*, projects(id, client_id, name, profiles(full_name, company_name))").eq("status", "draft").order("created_at", { ascending: false }).limit(5),
    admin.from("content_items").select("*, projects(id, client_id, name, profiles(full_name, company_name))").not("status", "eq", "draft").order("updated_at", { ascending: false }).limit(8),
  ]);

  const recentClients = (clients ?? []).slice(0, 5);

  const stats = [
    { label: "Total Clients",    value: clients?.length ?? 0,          icon: Users,   color: "text-[var(--accent)]",  bg: "bg-[var(--accent-subtle)]" },
    { label: "Active Projects",  value: projects?.length ?? 0,         icon: FolderOpen, color: "text-emerald-400",   bg: "bg-emerald-400/10" },
    { label: "Content Requests", value: clientDraftContent?.length ?? 0, icon: Inbox,  color: "text-violet-400",      bg: "bg-violet-400/10" },
    { label: "Awaiting Review",  value: contentInReview?.length ?? 0,  icon: Clock,   color: "text-purple-400",       bg: "bg-purple-400/10" },
    { label: "Published Posts",  value: publishedContent?.length ?? 0, icon: Send,    color: "text-sky-400",          bg: "bg-sky-400/10" },
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

        {/* Filterable activity sections */}
        <AdminDashboardClient
          clients={(clients ?? []).map((c) => ({ id: c.id, full_name: c.full_name, company_name: c.company_name }))}
          clientDraftContent={clientDraftContent ?? []}
          recentlyUpdated={recentlyUpdated ?? []}
          contentInReview={contentInReview ?? []}
          openTickets={openTickets ?? []}
          submittedForms={submittedForms ?? []}
        />

        {/* Recent clients */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Recent Clients</h2>
            <Link href="/admin/clients" className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentClients.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Users className="w-8 h-8 text-[var(--foreground-subtle)] mx-auto mb-2" />
              <p className="text-sm text-[var(--foreground-muted)]">No clients yet</p>
              <Link href="/admin/clients" className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline">
                <Plus className="w-3.5 h-3.5" /> Add your first client
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentClients.map((client) => (
                <Link key={client.id} href={`/admin/clients/${client.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors">
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
