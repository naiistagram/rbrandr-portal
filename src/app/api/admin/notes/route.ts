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

type CommentRow = { id: string; note_id: string; author_id: string | null; body: string; created_at: string };

async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return { admin, user, profile };
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

async function notifyProjectMembers(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  title: string,
  message: string,
) {
  const [{ data: project }, { data: members }] = await Promise.all([
    admin.from("projects").select("client_id").eq("id", projectId).single(),
    admin.from("project_members").select("user_id").eq("project_id", projectId),
  ]);
  const recipients = new Set<string>([project?.client_id, ...(members ?? []).map((member) => member.user_id)].filter(Boolean) as string[]);
  if (recipients.size > 0) {
    await admin.from("notifications").insert([...recipients].map((user_id) => ({
      user_id,
      title,
      message,
      type: "general",
      link: "/notes",
    })));
  }
}

export async function GET() {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [{ data: notes, error }, { data: projects }, { data: clients }] = await Promise.all([
    context.admin.from("portal_notes").select("id, project_id, author_id, body, status, created_at, updated_at").order("updated_at", { ascending: false }),
    context.admin.from("projects").select("id, name, client_id").order("created_at", { ascending: false }),
    context.admin.from("profiles").select("id, full_name, company_name").eq("role", "client"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const clientById = new Map((clients ?? []).map((client) => [client.id, client]));
  const projectOptions = (projects ?? []).map((project) => {
    const client = clientById.get(project.client_id);
    return { ...project, client_name: client?.company_name ?? client?.full_name ?? "Unknown client" };
  });
  return NextResponse.json({ notes: await hydrateNotes(context.admin, (notes ?? []) as NoteRow[]), projects: projectOptions });
}

export async function POST(request: NextRequest) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { project_id, body } = await request.json();
  const message = typeof body === "string" ? body.trim() : "";
  if (!project_id || !message) return NextResponse.json({ error: "A client project and note are required" }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: "Notes must be 5,000 characters or fewer" }, { status: 400 });

  const { data: note, error } = await context.admin
    .from("portal_notes")
    .insert({ project_id, author_id: context.user.id, body: message })
    .select("id, project_id, author_id, body, status, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyProjectMembers(context.admin, project_id, "New note from your account manager", message.slice(0, 140));
  return NextResponse.json({ note: { ...note, author: { id: context.user.id, full_name: context.profile.full_name, role: "admin" }, comments: [] } });
}

export async function PATCH(request: NextRequest) {
  const context = await getAdminContext();
  if (!context) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { note_id, body, status } = await request.json();
  if (!note_id) return NextResponse.json({ error: "A note is required" }, { status: 400 });
  const { data: note } = await context.admin.from("portal_notes").select("id, project_id").eq("id", note_id).maybeSingle();
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  if (status) {
    if (status !== "open" && status !== "resolved") return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const { error } = await context.admin.from("portal_notes").update({ status }).eq("id", note_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const message = typeof body === "string" ? body.trim() : "";
  if (!message) return NextResponse.json({ ok: true });
  if (message.length > 5000) return NextResponse.json({ error: "Messages must be 5,000 characters or fewer" }, { status: 400 });
  const { data: comment, error } = await context.admin
    .from("portal_note_comments")
    .insert({ note_id, author_id: context.user.id, body: message })
    .select("id, note_id, author_id, body, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await context.admin.from("portal_notes").update({ status: "open" }).eq("id", note_id);
  await notifyProjectMembers(context.admin, note.project_id, "New reply from your account manager", message.slice(0, 140));
  return NextResponse.json({ comment: { ...comment, author: { id: context.user.id, full_name: context.profile.full_name, role: "admin" } } });
}
