"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, ChevronRight, Plus, Search, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { SocialPerson } from "@/lib/social-tagging";

type HistoryRow = {
  id: string;
  content_item_id: string;
  social_person_id: string | null;
  platform: "Instagram" | "LinkedIn";
  display_name: string;
  handle: string | null;
  status: "pending" | "published" | "failed";
  error_message: string | null;
  published_at: string | null;
  created_at: string;
  content_title: string;
  scheduled_date: string | null;
  project_name: string | null;
  client_id: string | null;
};

type PortalProfile = { id: string; full_name: string; company_name: string | null; email: string };

type FormState = { display_name: string; kind: SocialPerson["kind"]; instagram_username: string; linkedin: string; linkedin_name: string; profile_id: string; notes: string };

const EMPTY_FORM: FormState = { display_name: "", kind: "person", instagram_username: "", linkedin: "", linkedin_name: "", profile_id: "", notes: "" };

const inputClass = "w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-all";

function formFromPerson(person: SocialPerson): FormState {
  return {
    display_name: person.display_name,
    kind: person.kind,
    instagram_username: person.instagram_username ?? "",
    linkedin: person.kind === "organization" ? person.linkedin_urn ?? "" : "",
    linkedin_name: person.linkedin_name ?? "",
    profile_id: person.profile_id ?? "",
    notes: person.notes ?? "",
  };
}

const STATUS_STYLE: Record<HistoryRow["status"], string> = {
  published: "text-emerald-400",
  failed: "text-red-400",
  pending: "text-amber-300",
};

export function PeopleDirectory() {
  const [people, setPeople] = useState<SocialPerson[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [profiles, setProfiles] = useState<PortalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/social-people", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load people.");
        setPeople(json.people ?? []);
        setHistory(json.history ?? []);
        setProfiles(json.profiles ?? []);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load people."))
      .finally(() => setLoading(false));
  }, []);

  const historyByPerson = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const row of history) {
      if (!row.social_person_id) continue;
      map.set(row.social_person_id, [...(map.get(row.social_person_id) ?? []), row]);
    }
    return map;
  }, [history]);
  const profilesById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const linkedProfileIds = new Set(people.map((person) => person.profile_id).filter(Boolean));

  const visible = people.filter((person) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [person.display_name, person.instagram_username ?? "", person.linkedin_name ?? ""].some((value) => value.toLowerCase().includes(q));
  });

  function startEdit(person: SocialPerson | null) {
    setError("");
    setEditingId(person ? person.id : "new");
    setForm(person ? formFromPerson(person) : EMPTY_FORM);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const existing = editingId && editingId !== "new" ? people.find((person) => person.id === editingId) : undefined;
      let linkedinUrn: string | null | undefined;
      let linkedinName = form.linkedin_name.trim() || null;
      if (form.kind === "organization") {
        const value = form.linkedin.trim();
        if (!value) linkedinUrn = null;
        else if (/^\d+$/.test(value) || /^urn:li:organization:/.test(value) || /linkedin\.com\/company\/\d+/i.test(value)) linkedinUrn = value;
        else {
          const lookup = await fetch("/api/admin/social-people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lookup_linkedin_org", value }) });
          const lookupJson = await lookup.json();
          if (!lookup.ok) throw new Error(lookupJson.error ?? "Could not find that LinkedIn company.");
          linkedinUrn = lookupJson.organization.urn;
          linkedinName = linkedinName ?? lookupJson.organization.name;
        }
      } else if (existing?.kind === "organization") {
        linkedinUrn = null; // A company ID never carries over to a person.
      }

      const payload: Record<string, unknown> = {
        display_name: form.display_name,
        kind: form.kind,
        instagram_username: form.instagram_username || null,
        linkedin_name: linkedinName,
        profile_id: form.profile_id || null,
        notes: form.notes || null,
      };
      if (linkedinUrn !== undefined) payload.linkedin_urn = linkedinUrn;
      const res = await fetch("/api/admin/social-people", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing ? { id: existing.id, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      const person = json.person as SocialPerson;
      setPeople((current) => [...current.filter((item) => item.id !== person.id), person].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setEditingId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(person: SocialPerson) {
    if (!confirm(`Remove ${person.display_name} from the directory? Their past tags stay in the history.`)) return;
    const res = await fetch(`/api/admin/social-people?id=${encodeURIComponent(person.id)}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not remove."); return; }
    setPeople((current) => current.filter((item) => item.id !== person.id));
    setEditingId(null);
  }

  function editor() {
    return (
      <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:grid-cols-2">
        <div className="flex gap-1.5 sm:col-span-2">
          {(["person", "organization"] as const).map((kind) => (
            <button key={kind} type="button" onClick={() => setForm((f) => ({ ...f, kind }))} className={cn("rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer", form.kind === kind ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--foreground-subtle)]")}>
              {kind === "person" ? "Person" : "Company"}
            </button>
          ))}
        </div>
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--foreground-muted)]">Name</span>
          <input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} className={inputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--foreground-muted)]">Instagram username</span>
          <input value={form.instagram_username} onChange={(e) => setForm((f) => ({ ...f, instagram_username: e.target.value }))} placeholder="handle (public account)" className={inputClass} />
        </label>
        {form.kind === "organization" ? (
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--foreground-muted)]">LinkedIn company</span>
            <input value={form.linkedin} onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))} placeholder="Page URL or numeric ID" className={inputClass} />
          </label>
        ) : (
          <div className="space-y-1">
            <span className="text-xs font-medium text-[var(--foreground-muted)]">LinkedIn</span>
            <p className="text-xs text-[var(--foreground-subtle)] pt-2">
              {people.find((p) => p.id === editingId)?.linkedin_urn ? "Connected by this person." : "Becomes mentionable once they connect LinkedIn in their portal Settings. Link them to a portal user below."}
            </p>
          </div>
        )}
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--foreground-muted)]">Name on LinkedIn</span>
          <input value={form.linkedin_name} onChange={(e) => setForm((f) => ({ ...f, linkedin_name: e.target.value }))} placeholder="Exactly as LinkedIn shows it" className={inputClass} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--foreground-muted)]">Portal user (optional)</span>
          <select value={form.profile_id} onChange={(e) => setForm((f) => ({ ...f, profile_id: e.target.value }))} className={inputClass}>
            <option value="">Not a portal user</option>
            {profiles.filter((profile) => profile.id === form.profile_id || !linkedProfileIds.has(profile.id)).map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.full_name}{profile.company_name ? ` · ${profile.company_name}` : ""}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--foreground-muted)]">Notes</span>
          <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputClass} />
        </label>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Button size="sm" onClick={save} loading={saving}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
          {editingId !== "new" && (
            <button type="button" onClick={() => { const person = people.find((p) => p.id === editingId); if (person) void remove(person); }} className="ml-auto flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)]">People &amp; tags</h1>
            <p className="text-sm text-[var(--foreground-muted)]">Everyone you can tag, and every post they&apos;ve been tagged in.</p>
          </div>
          <Button size="sm" onClick={() => startEdit(null)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add person or company</Button>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-4 animate-fade-in">
        {editingId === "new" && editor()}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={`${inputClass} pl-9`} />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {loading ? (
          <p className="text-sm text-[var(--foreground-subtle)]">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-[var(--foreground-subtle)]">{people.length ? "No matches." : "No one in the directory yet. Add people here, or straight from a post's Tag people section."}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {visible.map((person) => {
              const rows = historyByPerson.get(person.id) ?? [];
              const published = rows.filter((row) => row.status === "published");
              const lastTagged = published[0]?.published_at;
              const portalUser = person.profile_id ? profilesById.get(person.profile_id) : undefined;
              const open = expanded === person.id;
              return (
                <div key={person.id} className="border-b border-[var(--border)] last:border-b-0">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <button type="button" onClick={() => setExpanded(open ? null : person.id)} className="text-[var(--foreground-subtle)] cursor-pointer" aria-label="Show tag history">
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    {person.kind === "organization" ? <Building2 className="w-4 h-4 text-[var(--foreground-subtle)]" /> : <User className="w-4 h-4 text-[var(--foreground-subtle)]" />}
                    <div className="min-w-[160px] flex-1">
                      <p className="font-medium text-[var(--foreground)]">{person.display_name}</p>
                      {portalUser && <p className="text-[11px] text-[var(--foreground-subtle)]">Portal user · {portalUser.company_name ?? portalUser.email}</p>}
                    </div>
                    <span className="w-36 text-xs text-[var(--foreground-muted)]">{person.instagram_username ? `@${person.instagram_username}` : <span className="text-[var(--foreground-subtle)]">No Instagram</span>}</span>
                    <span className={cn("w-36 text-xs", person.linkedin_urn ? "text-[var(--foreground-muted)]" : "text-[var(--foreground-subtle)]")}>
                      {person.linkedin_urn ? `LinkedIn ✓${person.linkedin_name ? ` ${person.linkedin_name}` : ""}` : person.kind === "person" ? "LinkedIn not connected" : "No LinkedIn ID"}
                    </span>
                    <span className="w-40 text-xs text-[var(--foreground-muted)]">
                      Tagged {published.length}×{lastTagged ? ` · last ${formatDate(lastTagged)}` : ""}
                    </span>
                    <button type="button" onClick={() => startEdit(person)} className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer">Edit</button>
                  </div>
                  {editingId === person.id && <div className="px-4 pb-4">{editor()}</div>}
                  {open && (
                    <div className="bg-[var(--surface-2)] px-4 py-3">
                      {rows.length === 0 ? (
                        <p className="text-xs text-[var(--foreground-subtle)]">Not tagged in any posts yet.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[var(--foreground-subtle)]">
                              <th className="pb-2 font-medium">Post</th>
                              <th className="pb-2 font-medium">Client</th>
                              <th className="pb-2 font-medium">Platform</th>
                              <th className="pb-2 font-medium">Status</th>
                              <th className="pb-2 font-medium">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={row.id} className="border-t border-[var(--border)]">
                                <td className="py-2 pr-3">
                                  {row.client_id ? (
                                    <Link href={`/admin/clients/${row.client_id}?tab=Content&contentId=${row.content_item_id}`} className="text-[var(--accent)] hover:underline">{row.content_title}</Link>
                                  ) : row.content_title}
                                </td>
                                <td className="py-2 pr-3 text-[var(--foreground-muted)]">{row.project_name ?? "—"}</td>
                                <td className="py-2 pr-3 text-[var(--foreground-muted)]">{row.platform === "Instagram" ? "Instagram photo tag" : "LinkedIn mention"}</td>
                                <td className={cn("py-2 pr-3 capitalize", STATUS_STYLE[row.status])} title={row.error_message ?? undefined}>
                                  {row.status === "pending" ? "Not published yet" : row.status === "failed" ? `Not tagged${row.error_message ? ` — ${row.error_message}` : ""}` : "Tagged"}
                                </td>
                                <td className="py-2 text-[var(--foreground-muted)]">{formatDate(row.published_at ?? row.scheduled_date ?? row.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
