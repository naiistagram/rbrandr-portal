import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProjectMemberEmails, buildEmailHtml, sendPortalEmail } from "@/lib/email";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return admin;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { project_id, client_id, title, description, due_date } = await request.json();
  if (!project_id || !title || !due_date) {
    return NextResponse.json({ error: "project_id, title, and due_date required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("milestones")
    .insert({ project_id, client_id: client_id ?? null, title, description: description ?? null, due_date, completed: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ milestone: data });
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, completed } = await request.json();
  if (!id || completed === undefined) {
    return NextResponse.json({ error: "id and completed required" }, { status: 400 });
  }

  const { data: milestone, error } = await admin
    .from("milestones")
    .update({ completed })
    .eq("id", id)
    .select("id, project_id, title")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (completed) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const memberEmails = await getProjectMemberEmails(milestone.project_id);
    await sendPortalEmail({
      to: memberEmails,
      subject: `Project milestone completed — ${milestone.title}`,
      html: buildEmailHtml({
        title: "Milestone completed",
        body: `Great news! The project milestone <strong style="color:#fafafa;">"${milestone.title}"</strong> has been marked as complete.`,
        ctaText: "View milestones",
        ctaUrl: `${appUrl}/milestones`,
      }),
    });
  }

  return NextResponse.json({ milestone });
}
