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

  const { project_id, client_id, title, description, fields } = await request.json();
  if (!project_id || !title || !fields) {
    return NextResponse.json({ error: "project_id, title, and fields required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("forms")
    .insert({
      project_id,
      client_id: client_id ?? null,
      title,
      description: description ?? null,
      fields,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const memberEmails = await getProjectMemberEmails(project_id);
  await sendPortalEmail({
    to: memberEmails,
    subject: `New form assigned — ${title}`,
    html: buildEmailHtml({
      title: "You have a new form to complete",
      body: `A new form <strong style="color:#fafafa;">"${title}"</strong> has been assigned to you. Please complete it at your earliest convenience.`,
      ctaText: "Complete form",
      ctaUrl: `${appUrl}/forms`,
    }),
  });

  return NextResponse.json({ form: data });
}
