import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminEmails, buildEmailHtml, sendPortalEmail } from "@/lib/email";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/tickets — fetch project_id and tickets for the current user
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: ownedProjects }, { data: memberships }] = await Promise.all([
    admin.from("projects").select("id").eq("client_id", user.id).order("created_at", { ascending: true }),
    admin.from("project_members").select("project_id").eq("user_id", user.id),
  ]);

  const projectIdSet = new Set<string>();
  for (const p of ownedProjects ?? []) projectIdSet.add(p.id);
  for (const m of memberships ?? []) projectIdSet.add(m.project_id);
  const projectIds = [...projectIdSet];

  const projectId = projectIds[0] ?? null;

  const { data: tickets } = projectIds.length > 0
    ? await admin.from("tickets").select("*").in("project_id", projectIds).eq("submitted_by", user.id).order("created_at", { ascending: false })
    : { data: [] };

  return NextResponse.json({ projectId, tickets: tickets ?? [] });
}

// POST /api/tickets — create a new ticket
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { project_id, title, description, priority, file_urls } = body;

  if (!project_id || !title || !description) {
    return NextResponse.json({ error: "project_id, title, and description are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the user owns or is a member of this project
  const [{ data: ownedProject }, { data: membership }] = await Promise.all([
    admin.from("projects").select("id").eq("id", project_id).eq("client_id", user.id).maybeSingle(),
    admin.from("project_members").select("id").eq("project_id", project_id).eq("user_id", user.id).maybeSingle(),
  ]);

  if (!ownedProject && !membership) {
    return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("tickets")
    .insert({
      project_id,
      submitted_by: user.id,
      title,
      description,
      priority: priority ?? "medium",
      file_urls: file_urls && file_urls.length > 0 ? file_urls : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const { data: submitter } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const adminEmails = await getAdminEmails();
    await sendPortalEmail({
      to: adminEmails,
      subject: `New support ticket — ${data.title}`,
      html: buildEmailHtml({
        title: "New support ticket submitted",
        body: `<strong style="color:#fafafa;">${submitter?.full_name ?? "A client"}</strong> submitted a new support ticket: <strong style="color:#fafafa;">"${data.title}"</strong> (${priority ?? "medium"} priority).`,
        ctaText: "View in admin",
        ctaUrl: `${appUrl}/admin/clients`,
      }),
    });
  } catch (_) {}

  return NextResponse.json({ ticket: data });
}

// PATCH /api/tickets — append a client message to a ticket
export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, message } = body;
  if (!id || !message?.text) return NextResponse.json({ error: "id and message are required" }, { status: 400 });

  const admin = createAdminClient();

  // Verify the user submitted this ticket or is a project member
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, project_id, submitted_by")
    .eq("id", id)
    .single();

  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSubmitter = ticket.submitted_by === user.id;
  if (!isSubmitter) {
    const [{ data: ownedProject }, { data: membership }] = await Promise.all([
      admin.from("projects").select("id").eq("id", ticket.project_id).eq("client_id", user.id).maybeSingle(),
      admin.from("project_members").select("id").eq("project_id", ticket.project_id).eq("user_id", user.id).maybeSingle(),
    ]);
    if (!ownedProject && !membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Append atomically — avoids a lost-update race with a concurrent admin reply
  const { data, error } = await admin.rpc("append_ticket_message", {
    p_ticket_id: id,
    p_message: { role: "client", text: message.text, created_at: new Date().toISOString() },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ticket: data });
}
