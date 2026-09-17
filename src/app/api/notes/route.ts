import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type NoteRow = {
  id: string;
  project_id: string;
  author_id: string | null;
  body: string;
  status: "open" | "resolved";
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  note_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
};

async function getClientContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, { data: ownedProjects }, { data: memberships }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).single(),
    admin.from("projects").select("id, name").eq("client_id", user.id),
    admin.from("project_members").select("project_id, projects(id, name)").eq("user_id", user.id),
  ]);

  if (profile?.role !== "client") return null;
  const projects = [...(ownedProjects ?? [])];
  const projectIds = new Set(projects.map((project) => project.id));
  for (const membership of memberships ?? []) {
    const project = (membership as unknown as { projects: { id: string; name: string } | null }).projects;
    if (project && !projectIds.has(project.id)) {
      projectIds.add(project.id);
      projects.push(project);
    }
  }

  return { user, admin, projectIds: [...projectIds], projects };
}

async function hydrateNotes(admin: ReturnType<typeof createAdminClient>, notes: NoteRow[]) {
  if (notes.length === 0) return [];
  const noteIds = notes.map((note) => note.id);
  const { data: comments } = await admin
    .from("portal_note_comments")
    .select("id, note_id, author_id, body, created_at")
    .in("note_id", noteIds)
    .order("created_at", { ascending: true });

  const authorIds = new Set<string>();
  for (const note of notes) if (note.author_id) authorIds.add(note.author_id);
  for (const comment of (comments ?? []) as CommentRow[]) if (comment.author_id) authorIds.add(comment.author_id);
  const { data: authors } = authorIds.size > 0
    ? await admin.from("profiles").select("id, full_name, role").in("id", [...authorIds])
    : { data: [] };
  const authorById = new Map((authors ?? []).map((author) => [author.id, author]));

  return notes.map((note) => ({
    ...note,
    author: note.author_id ? authorById.get(note.author_id) ?? null : null,
    comments: ((comments ?? []) as CommentRow[])
      .filter((comment) => comment.note_id === note.id)
      .map((comment) => ({ ...comment, author: comment.author_id ? authorById.get(comment.author_id) ?? null : null })),
  }));
}

export async function GET() {
  const context = await getClientContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: notes, error } = context.projectIds.length > 0
    ? await context.admin
        .from("portal_notes")
        .select("id, project_id, author_id, body, status, created_at, updated_at")
        .in("project_id", context.projectIds)
        .order("updated_at", { ascending: false })
    : { data: [], error: null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notes: await hydrateNotes(context.admin, (notes ?? []) as NoteRow[]), projects: context.projects });
}

export async function POST(request: NextRequest) {
  const context = await getClientContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { note_id, body } = await request.json();
  const message = typeof body === "string" ? body.trim() : "";
  if (!note_id || !message) return NextResponse.json({ error: "A note and message are required" }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: "Messages must be 5,000 characters or fewer" }, { status: 400 });

  const { data: note } = await context.admin
    .from("portal_notes")
    .select("id, project_id")
    .eq("id", note_id)
    .maybeSingle();
  if (!note || !context.projectIds.includes(note.project_id)) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const { data: comment, error } = await context.admin
    .from("portal_note_comments")
    .insert({ note_id, author_id: context.user.id, body: message })
    .select("id, note_id, author_id, body, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await context.admin.from("portal_notes").update({ status: "open" }).eq("id", note_id);
  return NextResponse.json({ comment: { ...comment, author: { id: context.user.id, full_name: "You", role: "client" } } });
}
