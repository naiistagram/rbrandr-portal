"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Users, ArrowRight, X, Mail, User, Building2, Layers } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, getInitials } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

const SERVICE_TYPES = [
  { value: "social_media", label: "Social Media" },
  { value: "brand", label: "Brand" },
  { value: "website", label: "Website" },
  { value: "both", label: "Full Service" },
];

export default function AdminClientsPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    companyName: "",
    serviceType: "social_media",
    projectName: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [resending, setResending] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchClients() {
    const res = await fetch("/api/admin/clients");
    if (res.ok) {
      const data = await res.json();
      setClients(data.clients ?? []);
    }
  }

  async function handleResendInvite(email: string) {
    setResending(email);
    setResendSuccess(null);
    const res = await fetch("/api/admin/resend-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResending(null);
    if (res.ok) {
      setResendSuccess(email);
      setTimeout(() => setResendSuccess(null), 4000);
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to resend invite.");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setCreating(false);

    if (!res.ok) {
      setCreateError(data.error ?? "Failed to create client.");
      return;
    }

    setCreateSuccess(`Account created! An invitation email has been sent to ${form.email}.`);
    setForm({ fullName: "", email: "", companyName: "", serviceType: "social_media", projectName: "" });
    fetchClients();
  }

  const filtered = clients.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const inputClass =
    "w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-all";

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">Clients</h1>
          <p className="text-sm text-[var(--foreground-muted)]">{clients.length} account{clients.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setCreateSuccess(""); setCreateError(""); }} className="gap-2">
          <Plus className="w-4 h-4" /> Add Client
        </Button>
      </div>

      <div className="flex-1 p-6 space-y-4 animate-fade-in">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-all"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-muted)]">
              {clients.length === 0 ? "No clients yet" : "No results found"}
            </p>
            {clients.length === 0 && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 text-sm text-[var(--accent)] hover:underline cursor-pointer"
              >
                Add your first client
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {(() => {
              // Group by company_name; normalize key to merge "ACME" / "acme " / " ACME" etc.
              const groups: { company: string | null; clients: Profile[] }[] = [];
              const seen = new Map<string, number>();
              for (const c of filtered) {
                const raw = c.company_name?.trim() ?? null;
                const key = raw?.toLowerCase() ?? "";
                if (raw && seen.has(key)) {
                  groups[seen.get(key)!].clients.push(c);
                } else {
                  seen.set(key, groups.length);
                  groups.push({ company: raw, clients: [c] });
                }
              }
              // Sort: most recently active company first (by newest member), null company last
              groups.sort((a, b) => {
                if (!a.company && b.company) return 1;
                if (a.company && !b.company) return -1;
                const aLatest = Math.max(...a.clients.map((c) => new Date(c.created_at).getTime()));
                const bLatest = Math.max(...b.clients.map((c) => new Date(c.created_at).getTime()));
                return bLatest - aLatest;
              });

              return groups.map((group) => (
                <div key={group.company ?? "__individual__"} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Building2 className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                    {group.company ? (
                      <>
                        <Link
                          href={`/admin/clients/company/${encodeURIComponent(group.company)}`}
                          className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider hover:text-[var(--accent)] transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {group.company}
                        </Link>
                        <span className="text-[10px] text-[var(--foreground-subtle)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded-full">{group.clients.length}</span>
                        <Link
                          href={`/admin/clients/company/${encodeURIComponent(group.company)}`}
                          className="ml-auto text-[10px] text-[var(--accent)] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Company view →
                        </Link>
                      </>
                    ) : (
                      <p className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider">No company</p>
                    )}
                  </div>
                  {group.clients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-zinc-600 transition-all"
                    >
                      <Link href={`/admin/clients/${client.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0 overflow-hidden text-sm font-bold text-[var(--accent)]">
                          {client.avatar_url ? (
                            <img src={client.avatar_url} alt={client.full_name} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(client.full_name)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{client.full_name}</p>
                          <p className="text-xs text-[var(--foreground-subtle)] truncate">{client.email}</p>
                        </div>
                        <p className="text-xs text-[var(--foreground-subtle)] hidden md:block">{formatDate(client.created_at)}</p>
                      </Link>
                      <button
                        onClick={() => handleResendInvite(client.email)}
                        disabled={resending === client.email}
                        title="Resend invite email"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex-shrink-0 disabled:opacity-50"
                        style={resendSuccess === client.email
                          ? { color: "rgb(52 211 153)", borderColor: "rgb(52 211 153 / 0.3)", background: "rgb(52 211 153 / 0.1)" }
                          : { color: "var(--foreground-muted)", borderColor: "var(--border)", background: "transparent" }
                        }
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {resending === client.email ? "Sending…" : resendSuccess === client.email ? "Sent!" : "Resend invite"}
                      </button>
                      <Link href={`/admin/clients/${client.id}`} className="flex-shrink-0">
                        <ArrowRight className="w-4 h-4 text-[var(--foreground-subtle)]" />
                      </Link>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Create client modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--foreground)]">Add New Client</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createSuccess ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto">
                    <Mail className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Invitation sent!</p>
                  <p className="text-xs text-[var(--foreground-muted)]">{createSuccess}</p>
                  <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} className="w-full">
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Smith"
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="jane@company.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Company *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Acme Ltd."
                      value={form.companyName}
                      onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--foreground-muted)] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Service Package *
                    </label>
                    <select
                      value={form.serviceType}
                      onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                      className={inputClass}
                    >
                      {SERVICE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--foreground-muted)]">
                      Project Name (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Leave blank to auto-generate"
                      value={form.projectName}
                      onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                      className={inputClass}
                    />
                  </div>

                  {createError && (
                    <div className="px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                      {createError}
                    </div>
                  )}

                  <p className="text-xs text-[var(--foreground-subtle)]">
                    An invitation email will be sent to the client so they can set their password.
                  </p>

                  <div className="flex gap-3">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" loading={creating}>
                      Send Invitation
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
