"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Ticket, X, AlertCircle, Paperclip, Upload, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Topbar } from "@/components/layout/topbar";
import { cn, formatDate } from "@/lib/utils";
import type { Ticket as TicketType } from "@/lib/supabase/types";

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "text-zinc-400", bg: "bg-zinc-400/10" },
  medium: { label: "Medium", color: "text-amber-400", bg: "bg-amber-400/10" },
  high: { label: "High", color: "text-orange-400", bg: "bg-orange-400/10" },
  urgent: { label: "Urgent", color: "text-red-400", bg: "bg-red-400/10" },
};

const STATUS_CONFIG = {
  open: { label: "Open", variant: "warning" as const },
  in_progress: { label: "In Progress", variant: "accent" as const },
  resolved: { label: "Resolved", variant: "success" as const },
  closed: { label: "Closed", variant: "default" as const },
};

export default function TicketsPage() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" as TicketType["priority"] });
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | TicketType["status"]>("all");
  const [clientMessages, setClientMessages] = useState<Record<string, string>>({});
  const [sendingMessage, setSendingMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: projects } = await supabase.from("projects").select("id").order("created_at", { ascending: true });
      const projectIds = (projects ?? []).map((p) => p.id);
      if (projectIds.length > 0) setProjectId(projectIds[0]);
      const { data } = await supabase.from("tickets").select("*").eq("submitted_by", user.id).order("created_at", { ascending: false });
      if (data) setTickets(data);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setUploadingFile(true);
    const path = `${projectId}/ticket-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("assets").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(path);
      setFileUrls((prev) => [...prev, publicUrl]);
    }
    setUploadingFile(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setSubmitting(true);
    const { data } = await supabase.from("tickets").insert({
      project_id: projectId,
      submitted_by: userId,
      title: form.title,
      description: form.description,
      priority: form.priority,
      file_urls: fileUrls.length > 0 ? fileUrls : null,
    }).select().single();
    if (data) setTickets((prev) => [data, ...prev]);
    setForm({ title: "", description: "", priority: "medium" });
    setFileUrls([]);
    setShowForm(false);
    setSubmitting(false);
  }

  async function sendClientMessage(ticketId: string) {
    const text = (clientMessages[ticketId] ?? "").trim();
    if (!text) return;
    setSendingMessage(ticketId);
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) { setSendingMessage(null); return; }
    const newMsg = { role: "client" as const, text, created_at: new Date().toISOString() };
    const updated = [...(ticket.messages ?? []), newMsg];
    await supabase.from("tickets").update({ messages: updated }).eq("id", ticketId);
    setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, messages: updated } : t));
    setClientMessages((prev) => ({ ...prev, [ticketId]: "" }));
    setSendingMessage(null);
  }

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-all";

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Tickets" subtitle="Raise and track support issues" userId={userId} />

      <div className="flex-1 p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer",
                  filter === s
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                    : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                )}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s as TicketType["status"]]?.label}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        </div>

        {/* Submit form */}
        {showForm && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--foreground)]">New Support Ticket</h4>
              <button onClick={() => { setShowForm(false); setFileUrls([]); }} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Issue Title *</label>
                <input type="text" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Brief description of the issue" className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Description *</label>
                <textarea required rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Provide as much detail as possible..." className={`${inputClass} resize-none`} />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Priority</label>
                <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TicketType["priority"] }))} className={inputClass}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* File attachments */}
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">
                  Attachments <span className="text-[var(--foreground-subtle)]">(screenshots, files)</span>
                </label>
                <input ref={fileRef} type="file" onChange={handleFileUpload} className="hidden" accept="image/*,video/*,.pdf,.zip" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer disabled:opacity-50 w-full justify-center"
                >
                  {uploadingFile ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {uploadingFile ? "Uploading…" : "Attach a file"}
                </button>

                {fileUrls.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {fileUrls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[var(--foreground-muted)] bg-[var(--surface-2)] rounded-lg px-3 py-2">
                        <Paperclip className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent)]" />
                        <span className="flex-1 truncate">File {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => setFileUrls((prev) => prev.filter((_, j) => j !== i))}
                          className="text-[var(--foreground-subtle)] hover:text-red-400 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowForm(false); setFileUrls([]); }}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={submitting}>Submit Ticket</Button>
              </div>
            </form>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Ticket className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-muted)]">No tickets yet</p>
            <p className="text-xs text-[var(--foreground-subtle)] mt-1">Submit a ticket if you need any help</p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {filtered.map((ticket) => {
              const p = PRIORITY_CONFIG[ticket.priority];
              const s = STATUS_CONFIG[ticket.status];
              return (
                <div key={ticket.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", p.bg)}>
                      <AlertCircle className={cn("w-3.5 h-3.5", p.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{ticket.title}</p>
                        <Badge variant={s.variant}>{s.label}</Badge>
                        <span className={cn("text-xs font-medium", p.color)}>{p.label} priority</span>
                      </div>
                      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{ticket.description}</p>
                      {ticket.file_urls && ticket.file_urls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ticket.file_urls.map((url, i) => {
                            const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(url);
                            return isImage ? (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt={`attachment ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-all" />
                              </a>
                            ) : (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]"
                              >
                                <Paperclip className="w-3 h-3" /> File {i + 1}
                              </a>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-[var(--foreground-subtle)] mt-2">{formatDate(ticket.created_at)}</p>

                      {/* Status journey */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {(["open", "in_progress", "resolved", "closed"] as TicketType["status"][]).map((s, i, arr) => {
                          const statusOrder: Record<string, number> = { open: 0, in_progress: 1, resolved: 2, closed: 3 };
                          const reached = statusOrder[ticket.status] >= statusOrder[s];
                          const isCurrent = ticket.status === s;
                          return (
                            <div key={s} className="flex items-center gap-1.5">
                              <span className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize",
                                isCurrent ? "bg-[var(--accent)] text-white" :
                                reached ? "bg-emerald-400/15 text-emerald-400" :
                                "bg-[var(--surface-2)] text-[var(--foreground-subtle)]"
                              )}>
                                {s.replace("_", " ")}
                              </span>
                              {i < arr.length - 1 && <span className="text-[var(--foreground-subtle)] text-[10px]">→</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Message thread */}
                      {(ticket.messages ?? []).length > 0 && (
                        <div className="mt-3 space-y-2">
                          {(ticket.messages ?? []).map((msg, i) => (
                            <div key={i} className={cn(
                              "px-3 py-2 rounded-lg text-sm",
                              msg.role === "admin"
                                ? "bg-[var(--accent-subtle)] border border-[var(--accent)]/20"
                                : "bg-[var(--surface-2)] border border-[var(--border)] ml-4"
                            )}>
                              <p className={cn("text-[10px] font-semibold mb-0.5 uppercase tracking-wider", msg.role === "admin" ? "text-[var(--accent)]" : "text-[var(--foreground-subtle)]")}>
                                {msg.role === "admin" ? "Account manager" : "You"}
                              </p>
                              <p className="text-[var(--foreground-muted)] whitespace-pre-line">{msg.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Client reply */}
                      {ticket.status !== "resolved" && ticket.status !== "closed" && (
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={clientMessages[ticket.id] ?? ""}
                            onChange={(e) => setClientMessages((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendClientMessage(ticket.id); } }}
                            placeholder="Add a message..."
                            className="flex-1 text-sm px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-all"
                          />
                          <button
                            onClick={() => sendClientMessage(ticket.id)}
                            disabled={!(clientMessages[ticket.id] ?? "").trim() || sendingMessage === ticket.id}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer flex-shrink-0"
                          >
                            {sendingMessage === ticket.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}

                      {ticket.admin_response && (
                        <div className="mt-3 p-3 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
                          <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider mb-1">Resolution from your account manager</p>
                          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{ticket.admin_response}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
