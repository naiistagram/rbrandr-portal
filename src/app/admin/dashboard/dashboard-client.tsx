"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText, Ticket, CheckCircle2, AlertCircle, MessageSquare,
  Send, Inbox, Activity, Clock, ChevronDown, Search, X,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "bg-zinc-400/10 text-zinc-400" },
  in_review: { label: "In Review", cls: "bg-purple-400/10 text-purple-400" },
  approved:  { label: "Approved",  cls: "bg-emerald-400/10 text-emerald-400" },
  rejected:  { label: "Rejected",  cls: "bg-red-400/10 text-red-400" },
  published: { label: "Published", cls: "bg-sky-400/10 text-sky-400" },
};

interface Client { id: string; full_name: string; company_name: string | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

interface Props {
  clients: Client[];
  clientDraftContent: AnyItem[];
  recentlyUpdated: AnyItem[];
  contentInReview: AnyItem[];
  openTickets: AnyItem[];
  submittedForms: AnyItem[];
}

function clientLink(item: AnyItem) {
  const proj = item.projects;
  return proj?.client_id ? `/admin/clients/${proj.client_id}` : "#";
}

function getClientId(item: AnyItem): string {
  return item.projects?.client_id ?? "";
}

export function AdminDashboardClient({
  clients, clientDraftContent, recentlyUpdated, contentInReview, openTickets, submittedForms,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const filteredClients = useMemo(() =>
    clients.filter((c) => {
      const q = search.toLowerCase();
      return (c.company_name ?? c.full_name).toLowerCase().includes(q) || c.full_name.toLowerCase().includes(q);
    }),
    [clients, search]
  );

  function filter<T extends AnyItem>(items: T[]): T[] {
    if (selectedClientId === "all") return items;
    return items.filter((i) => getClientId(i) === selectedClientId);
  }

  const drafts = filter(clientDraftContent);
  const updated = filter(recentlyUpdated);
  const inReview = filter(contentInReview);
  const tickets = filter(openTickets);
  const forms = filter(submittedForms);

  return (
    <div className="space-y-6">
      {/* Client filter */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 h-9 pl-3.5 pr-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-zinc-600 text-sm text-[var(--foreground)] transition-all cursor-pointer min-w-[180px]"
          >
            <span className="flex-1 text-left truncate">
              {selectedClientId === "all"
                ? <span className="text-[var(--foreground-muted)]">All clients</span>
                : <span>{selectedClient?.company_name ?? selectedClient?.full_name}</span>
              }
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--foreground-subtle)] flex-shrink-0" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-11 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/50 z-50 animate-fade-in overflow-hidden">
              <div className="p-2 border-b border-[var(--border)]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients..."
                    className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-all"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                <button
                  onClick={() => { setSelectedClientId("all"); setDropdownOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-[var(--surface-2)] ${selectedClientId === "all" ? "text-[var(--accent)]" : "text-[var(--foreground-muted)]"}`}
                >
                  All clients
                </button>
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClientId(c.id); setDropdownOpen(false); setSearch(""); }}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-[var(--surface-2)] ${selectedClientId === c.id ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}
                  >
                    <span className="block truncate">{c.company_name ?? c.full_name}</span>
                    {c.company_name && <span className="block text-xs text-[var(--foreground-subtle)] truncate">{c.full_name}</span>}
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="px-3 py-4 text-sm text-[var(--foreground-subtle)] text-center">No clients found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedClientId !== "all" && (
          <button
            onClick={() => setSelectedClientId("all")}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/30 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/15 transition-all cursor-pointer"
          >
            <X className="w-3 h-3" />
            Clear filter
          </button>
        )}

        {selectedClientId !== "all" && selectedClient && (
          <Link
            href={`/admin/clients/${selectedClientId}`}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-zinc-600 transition-all"
          >
            View full profile →
          </Link>
        )}
      </div>

      {/* Client Content Requests */}
      {drafts.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--accent)]/30 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Client Content Requests</h2>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-400/10 text-violet-400">{drafts.length}</span>
            </div>
            <span className="text-[10px] text-[var(--foreground-subtle)]">Needs your attention</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {drafts.map((item) => {
              const proj = item.projects;
              const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
              return (
                <Link key={item.id} href={clientLink(item)} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-violet-400/10 flex items-center justify-center flex-shrink-0">
                    <Inbox className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</p>
                    <p className="text-xs text-[var(--foreground-subtle)]">{clientName} · {item.content_type}{item.platform ? ` · ${item.platform}` : ""}</p>
                  </div>
                  <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(item.created_at)}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recently Updated */}
      {updated.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Recently Updated</h2>
            </div>
            <span className="text-[10px] text-[var(--foreground-subtle)]">Content you&apos;ve worked on</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {updated.map((item) => {
              const proj = item.projects;
              const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
              const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.draft;
              return (
                <Link key={item.id} href={clientLink(item)} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</p>
                    <p className="text-xs text-[var(--foreground-subtle)]">{clientName}{item.platform ? ` · ${item.platform}` : ""}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                  <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(item.updated_at)}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Awaiting client review */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
            <Clock className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Awaiting Client Review</h2>
            {inReview.length > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-400/10 text-purple-400">{inReview.length}</span>}
          </div>
          {inReview.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-[var(--foreground-muted)]">All clear</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {inReview.map((item) => {
                const proj = item.projects;
                const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
                return (
                  <Link key={item.id} href={clientLink(item)} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-purple-400/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</p>
                      <p className="text-xs text-[var(--foreground-subtle)]">{clientName} · {item.platform ?? item.content_type}</p>
                    </div>
                    <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(item.updated_at)}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Open tickets */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
            <Ticket className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Open Tickets</h2>
            {tickets.length > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-400/10 text-orange-400">{tickets.length}</span>}
          </div>
          {tickets.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-[var(--foreground-muted)]">No open tickets</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {tickets.map((ticket) => {
                const proj = ticket.projects;
                const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
                const urgentColor = ticket.priority === "urgent" ? "text-red-400 bg-red-400/10" : ticket.priority === "high" ? "text-orange-400 bg-orange-400/10" : "text-zinc-400 bg-zinc-400/10";
                return (
                  <Link key={ticket.id} href={clientLink(ticket)} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${urgentColor}`}>
                      <AlertCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{ticket.title}</p>
                      <p className="text-xs text-[var(--foreground-subtle)]">{clientName} · {ticket.priority} priority</p>
                    </div>
                    <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(ticket.created_at)}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Submitted forms */}
      {forms.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Recently Submitted Forms</h2>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">{forms.length}</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {forms.map((form) => {
              const proj = form.projects;
              const clientName = proj?.profiles?.company_name ?? proj?.profiles?.full_name ?? "Unknown";
              const cId = proj?.client_id;
              return (
                <Link key={form.id} href={cId ? `/admin/clients/${cId}?tab=Forms` : "#"} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-emerald-400/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{form.title}</p>
                    <p className="text-xs text-[var(--foreground-subtle)]">{clientName} · Click to view responses</p>
                  </div>
                  <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{form.submitted_at ? formatDate(form.submitted_at) : ""}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {drafts.length === 0 && updated.length === 0 && inReview.length === 0 && tickets.length === 0 && forms.length === 0 && (
        <div className="text-center py-16">
          <Send className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
          <p className="text-sm text-[var(--foreground-muted)]">
            {selectedClientId === "all" ? "Nothing needs attention right now." : `No active items for ${selectedClient?.company_name ?? selectedClient?.full_name}.`}
          </p>
        </div>
      )}
    </div>
  );
}
