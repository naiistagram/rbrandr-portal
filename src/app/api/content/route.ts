import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminEmails, getProjectMemberEmails, buildEmailHtml, sendPortalEmail } from "@/lib/email";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/content — fetch all content for the logged-in client
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: projects } = await admin
    .from("projects")
    .select("id")
    .eq("client_id", user.id);

  const projectIds = (projects ?? []).map((p) => p.id);

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

  // Verify the project actually belongs to this user
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", project_id)
    .eq("client_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found or not owned by user" }, { status: 403 });
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

  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", item.project_id)
    .eq("client_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  if (status === "in_review") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const [adminEmails, memberEmails] = await Promise.all([
      getAdminEmails(),
      getProjectMemberEmails(data.project_id),
    ]);
    await Promise.all([
      sendPortalEmail({
        to: adminEmails,
        subject: `Content ready for review — ${data.title}`,
        html: buildEmailHtml({
          title: "Content submitted for review",
          body: `A client has submitted <strong style="color:#fafafa;">"${data.title}"</strong> for review. Head to the admin portal to approve or provide feedback.`,
          ctaText: "Review content",
          ctaUrl: `${appUrl}/admin/clients`,
        }),
      }),
      sendPortalEmail({
        to: memberEmails,
        subject: `Content submitted for review — ${data.title}`,
        html: buildEmailHtml({
          title: "Content submitted for review",
          body: `Your content piece <strong style="color:#fafafa;">"${data.title}"</strong> has been submitted for review. You'll hear back once your account manager has taken a look.`,
          ctaText: "View content",
          ctaUrl: `${appUrl}/calendar`,
        }),
      }),
    ]);
  }

  return NextResponse.json({ content: data });
}
