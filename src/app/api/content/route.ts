import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminEmails, buildEmailHtml, sendPortalEmail } from "@/lib/email";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/content — fetch all content for the logged-in client or member
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: ownedProjects }, { data: memberProjects }] = await Promise.all([
    admin.from("projects").select("id").eq("client_id", user.id),
    admin.from("project_members").select("project_id").eq("user_id", user.id),
  ]);

  const projectIds = Array.from(new Set([
    ...(ownedProjects ?? []).map((p) => p.id),
    ...(memberProjects ?? []).map((m) => m.project_id),
  ]));

  if (projectIds.length === 0) {
    return NextResponse.json({ content: [], projectId: null });
  }

  const { data: content, error } = await admin
    .from("content_items")
    .select("*")
    .in("project_id", projectIds)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ content: content ?? [], projectId: projectIds[0] });
}

// POST /api/content — create a content item for the logged-in client
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { project_id, title, content_type, platform, description, scheduled_date } = body;

  if (!project_id || !title) {
    return NextResponse.json({ error: "project_id and title required" }, { status: 400 });
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
    .from("content_items")
    .insert({
      project_id,
      title,
      content_type: content_type ?? "post",
      platform: platform ?? null,
      description: description ?? null,
      scheduled_date: scheduled_date ?? null,
      status: "draft",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });

  // Email all admins when a client submits new content
  try {
    const { data: submitter } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const adminEmails = await getAdminEmails();
    await sendPortalEmail({
      to: adminEmails,
      subject: `New content submitted — ${data.title}`,
      html: buildEmailHtml({
        title: "New content submitted",
        body: `<strong style="color:#fafafa;">${submitter?.full_name ?? "A client"}</strong> has submitted new content: <strong style="color:#fafafa;">"${data.title}"</strong>${data.platform ? ` on ${data.platform}` : ""}.`,
        ctaText: "Review in admin",
        ctaUrl: `${appUrl}/admin/clients`,
      }),
    });
  } catch (_) {}

  return NextResponse.json({ content: data });
}

// PATCH /api/content — update status/feedback on a content item the client owns
export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, status, feedback } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: item } = await admin
    .from("content_items")
    .select("id, project_id")
    .eq("id", id)
    .single();

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: ownedProject }, { data: membership }] = await Promise.all([
    admin.from("projects").select("id").eq("id", item.project_id).eq("client_id", user.id).maybeSingle(),
    admin.from("project_members").select("id").eq("project_id", item.project_id).eq("user_id", user.id).maybeSingle(),
  ]);

  if (!ownedProject && !membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (feedback !== undefined) updates.feedback = feedback;

  const { data, error } = await admin
    .from("content_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "approved" || status === "rejected") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const label = status === "approved" ? "approved" : "rejected";
    const adminEmails = await getAdminEmails();
    await sendPortalEmail({
      to: adminEmails,
      subject: `Content ${label} by client — ${data.title}`,
      html: buildEmailHtml({
        title: `Content ${label}`,
        body: `A client has <strong style="color:#fafafa;">${label}</strong> the content piece <strong style="color:#fafafa;">"${data.title}"</strong>${data.feedback ? ` with feedback: "${data.feedback}"` : ""}.`,
        ctaText: "View in admin",
        ctaUrl: `${appUrl}/admin/clients`,
      }),
    });
  }

  return NextResponse.json({ content: data });
}
