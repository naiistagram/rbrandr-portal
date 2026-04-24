import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return { user, admin };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const auth = await verifyAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { action } = body;

  if (action === "add_content") {
    const { project_id, title, content_type, platform, description, scheduled_date, status, file_urls, created_by } = body;
    if (!project_id || !title) return NextResponse.json({ error: "project_id and title required" }, { status: 400 });

    const { data, error } = await auth.admin.from("content_items").insert({
      project_id,
      title,
      content_type: content_type ?? "post",
      platform: platform ?? null,
      description: description ?? null,
      scheduled_date: scheduled_date ?? null,
      status: status ?? "draft",
      file_urls: file_urls ?? null,
      created_by: created_by ?? null,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    return NextResponse.json({ content: data });
  }

  if (action === "update_content") {
    const { content_id, description, file_urls, status, scheduled_date } = body;
    if (!content_id) return NextResponse.json({ error: "content_id required" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (description !== undefined) updates.description = description;
    if (file_urls !== undefined) updates.file_urls = file_urls;
    if (status !== undefined) updates.status = status;
    if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date;

    const { data, error } = await auth.admin
      .from("content_items")
      .update(updates)
      .eq("id", content_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    return NextResponse.json({ content: data });
  }

  if (action === "reply_feedback") {
    const { feedback_id, reply } = body;
    if (!feedback_id) return NextResponse.json({ error: "feedback_id required" }, { status: 400 });
    const { data, error } = await auth.admin
      .from("feedback")
      .update({ admin_reply: reply || null })
      .eq("id", feedback_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ feedback: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const auth = await verifyAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { service_type, client_role, job_title } = body;

  const updates: Record<string, unknown> = {};
  if (service_type !== undefined) updates.service_type = service_type;
  if (client_role !== undefined) updates.client_role = client_role;
  if (job_title !== undefined) updates.job_title = job_title?.trim() || null;

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await auth.admin.from("profiles").update(updates).eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const auth = await verifyAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { admin } = auth;

  const [{ data: client }, { data: allProjects }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", clientId).single(),
    admin.from("projects").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
  ]);

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });


  const project = allProjects?.[0] ?? null;
  const projectIds = (allProjects ?? []).map((p) => p.id);

  const hasProjects = projectIds.length > 0;

  const [
    { data: content }, { data: contracts }, { data: reports },
    { data: assets }, { data: documents }, { data: milestones },
    { data: forms }, { data: tickets }, { data: feedback },
  ] = await Promise.all([
    hasProjects
      ? admin.from("content_items").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("contracts").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("reports").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("assets").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("documents").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("milestones").select("*").in("project_id", projectIds).order("due_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    hasProjects
      ? admin.from("forms").select("*").in("project_id", projectIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin.from("tickets").select("*").eq("submitted_by", clientId).order("created_at", { ascending: false }),
    admin.from("feedback").select("*, profiles(full_name, email)").eq("submitted_by", clientId).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    client,
    projects: allProjects ?? [],
    project,
    content: content ?? [],
    contracts: contracts ?? [],
    reports: reports ?? [],
    assets: assets ?? [],
    documents: documents ?? [],
    milestones: milestones ?? [],
    forms: forms ?? [],
    tickets: tickets ?? [],
    feedback: feedback ?? [],
  });
}
