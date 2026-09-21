import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendContentStatusEmail } from "@/lib/email";
import { signStorageUrl } from "@/lib/storage-url";

const CONTENT_TYPES = ["post", "story", "reel", "carousel", "ad", "email", "blog", "other"];

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
    const { project_id, title, content_type, platforms, description, review_note, scheduled_date, scheduled_time, status, file_urls, created_by, send_email } = body;
    if (!project_id || !title) return NextResponse.json({ error: "project_id and title required" }, { status: 400 });
    if (review_note !== undefined && (typeof review_note !== "string" || review_note.trim().length > 5000)) {
      return NextResponse.json({ error: "Review note must be 5,000 characters or fewer" }, { status: 400 });
    }

    const { data, error } = await auth.admin.from("content_items").insert({
      project_id,
      title,
      content_type: content_type ?? "post",
      platforms: Array.isArray(platforms) ? platforms : [],
      description: description ?? null,
      review_note: review_note?.trim() || null,
      scheduled_date: scheduled_date ?? null,
      scheduled_time: scheduled_time ?? null,
      status: status ?? "draft",
      file_urls: file_urls ?? null,
      created_by: created_by ?? null,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });

    // The status dropdown on this form lets an admin create content directly
    // as "in_review" — without this, only the separate quick-status dropdown
    // on an existing item triggered the "ready for review" email.
    if (send_email !== false && (data.status === "in_review" || data.status === "approved" || data.status === "published")) {
      await sendContentStatusEmail(data.project_id, data.title, data.status, data.review_note);
    }

    return NextResponse.json({ content: data });
  }

  if (action === "update_content") {
    const { content_id, title, content_type, description, review_note, file_urls, status, scheduled_date, scheduled_time, platforms, send_email } = body;
    if (!content_id) return NextResponse.json({ error: "content_id required" }, { status: 400 });
    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return NextResponse.json({ error: "title must not be empty" }, { status: 400 });
    }
    if (content_type !== undefined && !CONTENT_TYPES.includes(content_type)) {
      return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
    }
    if (review_note !== undefined && (typeof review_note !== "string" || review_note.trim().length > 5000)) {
      return NextResponse.json({ error: "Review note must be 5,000 characters or fewer" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title.trim();
    if (content_type !== undefined) updates.content_type = content_type;
    if (description !== undefined) updates.description = description;
    if (review_note !== undefined) updates.review_note = review_note.trim() || null;
    if (file_urls !== undefined) updates.file_urls = file_urls;
    if (status !== undefined) updates.status = status;
    if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date;
    if (scheduled_time !== undefined) updates.scheduled_time = scheduled_time;
    if (platforms !== undefined) updates.platforms = Array.isArray(platforms) ? platforms : [];

    const { data, error } = await auth.admin
      .from("content_items")
      .update(updates)
      .eq("id", content_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });

    const shouldNotifyReview = data.status === "in_review" && review_note !== undefined;
    if (send_email !== false && (status === "in_review" || status === "approved" || status === "published" || shouldNotifyReview)) {
      await sendContentStatusEmail(data.project_id, data.title, (status === "approved" || status === "published") ? status : "in_review", data.review_note);
    }

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
  const { service_type, client_role, job_title, company_name, email_opted_out } = body;

  const updates: Record<string, unknown> = {};
  if (service_type !== undefined) updates.service_type = service_type;
  if (client_role !== undefined) updates.client_role = client_role;
  if (job_title !== undefined) updates.job_title = job_title?.trim() || null;
  if (company_name !== undefined) updates.company_name = company_name?.trim() || null;
  if (email_opted_out !== undefined) {
    if (typeof email_opted_out !== "boolean") {
      return NextResponse.json({ error: "email_opted_out must be a boolean" }, { status: 400 });
    }
    updates.email_opted_out = email_opted_out;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await auth.admin.from("profiles").update(updates).eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const auth = await verifyAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Delete the auth user — profiles + projects cascade via FK
  const { error } = await auth.admin.auth.admin.deleteUser(clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const auth = await verifyAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { admin } = auth;

  const [{ data: client }, { data: ownedProjects }, { data: memberRows }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", clientId).single(),
    admin.from("projects").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    admin.from("project_members").select("project_id").eq("user_id", clientId),
  ]);

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Include projects the client is a member of (e.g. invited team members)
  const ownedIds = new Set((ownedProjects ?? []).map((p) => p.id));
  const memberProjectIds = (memberRows ?? []).map((r) => r.project_id).filter((id) => !ownedIds.has(id));

  const { data: memberProjects } = memberProjectIds.length > 0
    ? await admin.from("projects").select("*").in("id", memberProjectIds).order("created_at", { ascending: false })
    : { data: [] };

  const allProjects = [...(ownedProjects ?? []), ...(memberProjects ?? [])];
  const project = allProjects[0] ?? null;
  const projectIds = allProjects.map((p) => p.id);
  // Contracts are only shown for projects the client directly owns
  const ownedProjectIds = (ownedProjects ?? []).map((p) => p.id);

  const hasProjects = projectIds.length > 0;
  const hasOwned = ownedProjectIds.length > 0;

  const [
    { data: content }, { data: contracts }, { data: reports },
    { data: assets }, { data: documents }, { data: milestones },
    { data: forms }, { data: tickets }, { data: feedback },
  ] = await Promise.all([
    hasProjects
      ? admin.from("content_items").select("*, profiles!created_by(id, full_name)").in("project_id", projectIds).order("scheduled_date", { ascending: false, nullsFirst: false }).order("scheduled_time", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // Contracts only for owned projects (members can't see contracts)
    hasOwned
      ? admin.from("contracts").select("*").in("project_id", ownedProjectIds).order("created_at", { ascending: false })
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

  const [signedContracts, signedReports, signedDocuments] = await Promise.all([
    Promise.all((contracts ?? []).map(async (contract) => ({ ...contract, file_url: await signStorageUrl(admin, "contracts", contract.file_url) }))),
    Promise.all((reports ?? []).map(async (report) => ({ ...report, file_url: await signStorageUrl(admin, "reports", report.file_url) }))),
    Promise.all((documents ?? []).map(async (document) => ({ ...document, file_url: await signStorageUrl(admin, "documents", document.file_url) }))),
  ]);

  return NextResponse.json({
    client,
    projects: allProjects,
    project,
    content: content ?? [],
    contracts: signedContracts,
    reports: signedReports,
    assets: assets ?? [],
    documents: signedDocuments,
    milestones: milestones ?? [],
    forms: forms ?? [],
    tickets: tickets ?? [],
    feedback: feedback ?? [],
  });
}
