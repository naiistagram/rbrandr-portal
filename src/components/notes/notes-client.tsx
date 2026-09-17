"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, MessageSquare, Plus, Send, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { cn, formatDateTime } from "@/lib/utils";

type Author = { id: string; full_name: string; role: "admin" | "client" };
type NoteComment = { id: string; note_id: string; author_id: string | null; body: string; created_at: string; author: Author | null };
type Note = {
  id: string;
  project_id: string;
  author_id: string | null;
  body: string;
  status: "open" | "resolved";
  created_at: string;
  updated_at: string;
  author: Author | null;
  comments: NoteComment[];
};
type ProjectOption = { id: string; name: string; client_name?: string };

interface NotesClientProps {
  userId: string;
  admin?: boolean;
}

export function NotesClient({ userId, admin = false }: NotesClientProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = admin ? "/api/admin/notes" : "/api/notes";

  useEffect(() => {
    async function loadNotes() {
      try {
        const response = await fetch(api);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load notes");
        setNotes(json.notes ?? []);
        setProjects(json.projects ?? []);
        if (admin && json.projects?.length) setProjectId(json.projects[0].id);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load notes");
      } finally {
        setLoaded(true);
      }
    }
    loadNotes();
  }, [api, admin]);

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const openNotes = notes.filter((note) => note.status === "open").length;

  async function createNote(event: React.FormEvent) {
    event.preventDefault();
    const body = newNote.trim();
    if (!projectId || !body) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, body }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not add note");
      setNotes((current) => [json.note, ...current]);
      setNewNote("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add note");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(noteId: string) {
    const body = (replyText[noteId] ?? "").trim();
    if (!body) return;
    setSendingId(noteId);
    setError(null);
    try {
      const response = await fetch(api, {
        method: admin ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(admin ? { note_id: noteId, body } : { note_id: noteId, body }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not send reply");
      setNotes((current) => current.map((note) => note.id === noteId
        ? { ...note, status: "open", updated_at: json.comment.created_at, comments: [...note.comments, json.comment] }
        : note));
      setReplyText((current) => ({ ...current, [noteId]: "" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send reply");
    } finally {
      setSendingId(null);
    }
  }

  async function setStatus(noteId: string, status: "open" | "resolved") {
    setError(null);
    try {
      const response = await fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: noteId, status }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update note");
      setNotes((current) => current.map((note) => note.id === noteId ? { ...note, status } : note));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update note");
    }
  }

  const content = (
    <div className="flex-1 p-6 space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">{admin ? "Client notes" : "Shared notes"}</h2>
          <p className="text-sm text-[var(--foreground-muted)]">
            {admin ? "Leave a clear message for a client and keep the conversation in one place." : "Messages from your account manager, with a simple place to reply."}
          </p>
        </div>
        {openNotes > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/25 text-xs font-semibold text-[var(--accent)]">
            <MessageSquare className="w-3.5 h-3.5" /> {openNotes} open {openNotes === 1 ? "conversation" : "conversations"}
          </div>
        )}
      </div>

      {admin && (
        <form onSubmit={createNote} className="bg-[var(--surface)] border border-[var(--accent)]/30 rounded-xl p-5 space-y-3 max-w-3xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center"><Plus className="w-4 h-4 text-[var(--accent)]" /></div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Add a note for a client</h3>
          </div>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="w-full max-w-md px-3 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          >
            {projects.map((project) => <option key={project.id} value={project.id}>{project.client_name} — {project.name}</option>)}
          </select>
          <textarea
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Write the note the client should see…"
            className="w-full px-3.5 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] resize-y"
          />
          <div className="flex justify-end"><Button type="submit" size="sm" className="gap-2" loading={submitting} disabled={!projectId || !newNote.trim()}><Send className="w-3.5 h-3.5" /> Send note</Button></div>
        </form>
      )}

      {error && <p className="max-w-3xl text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

      {!loaded ? (
        <div className="py-16 text-center text-sm text-[var(--foreground-subtle)]">Loading notes…</div>
      ) : notes.length === 0 ? (
        <div className="max-w-3xl py-16 text-center bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-xl">
          <StickyNote className="w-9 h-9 text-[var(--foreground-subtle)] mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--foreground-muted)]">{admin ? "No client notes yet" : "No shared notes yet"}</p>
          <p className="text-xs text-[var(--foreground-subtle)] mt-1">{admin ? "Start a conversation whenever something needs a clear answer." : "When your account manager leaves a note, it will appear here."}</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {notes.map((note) => {
            const project = projectById.get(note.project_id);
            return (
              <article key={note.id} className={cn("bg-[var(--surface)] border rounded-xl overflow-hidden", note.status === "open" ? "border-[var(--accent)]/35" : "border-[var(--border)]") }>
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {admin && <span className="text-xs text-[var(--foreground-muted)]">{project?.client_name ?? "Client"} <span className="text-[var(--foreground-subtle)]">·</span> {project?.name}</span>}
                    {!admin && projects.length > 1 && <span className="text-xs text-[var(--foreground-muted)]">{project?.name}</span>}
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full", note.status === "open" ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "bg-emerald-400/10 text-emerald-400")}>{note.status === "open" ? "Open" : "Resolved"}</span>
                    <span className="ml-auto text-[10px] text-[var(--foreground-subtle)]">{formatDateTime(note.created_at)}</span>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)] mb-1.5">{note.author?.role === "admin" ? "Your account manager" : note.author?.full_name ?? "Client"}</p>
                  <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">{note.body}</p>
                </div>

                {note.comments.length > 0 && <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
                  {note.comments.map((comment) => (
                    <div key={comment.id} className={cn("px-5 py-3.5", comment.author?.role === "admin" ? "bg-[var(--accent-subtle)]/35" : "bg-[var(--surface-2)]/45")}>
                      <div className="flex items-center gap-2 mb-1"><p className={cn("text-[10px] font-semibold uppercase tracking-wider", comment.author?.role === "admin" ? "text-[var(--accent)]" : "text-[var(--foreground-subtle)]")}>{comment.author?.role === "admin" ? "Your account manager" : comment.author?.full_name ?? "You"}</p><span className="text-[10px] text-[var(--foreground-subtle)]">{formatDateTime(comment.created_at)}</span></div>
                      <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  ))}
                </div>}

                <div className="border-t border-[var(--border)] p-3.5 flex gap-2">
                  <input
                    value={replyText[note.id] ?? ""}
                    onChange={(event) => setReplyText((current) => ({ ...current, [note.id]: event.target.value }))}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendReply(note.id); } }}
                    maxLength={5000}
                    placeholder={admin ? "Reply to this client…" : "Reply to your account manager…"}
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)]"
                  />
                  <button onClick={() => sendReply(note.id)} disabled={!(replyText[note.id] ?? "").trim() || sendingId === note.id} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"><Send className="w-3.5 h-3.5" /></button>
                  {admin && note.status === "open" && <button onClick={() => setStatus(note.id, "resolved")} title="Mark as resolved" className="w-9 h-9 flex items-center justify-center rounded-lg border border-emerald-400/25 text-emerald-400 hover:bg-emerald-400/10"><Check className="w-4 h-4" /></button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  if (admin) return <div className="flex flex-col min-h-screen"><div className="border-b border-[var(--border)] px-6 py-4"><h1 className="text-lg font-bold text-[var(--foreground)]">Notes</h1><p className="text-sm text-[var(--foreground-muted)]">Client conversations and follow-ups</p></div>{content}</div>;
  return <div className="flex flex-col min-h-screen"><Topbar title="Notes" subtitle="Messages and replies with your account manager" userId={userId} />{content}</div>;
}
