import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProjectMemberEmails, buildEmailHtml, sendPortalEmail } from "@/lib/email";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
};

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return admin;
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId, status, clientId } = await request.json();
  if (!itemId || !status) return NextResponse.json({ error: "itemId and status required" }, { status: 400 });

  const { data: item, error } = await admin
    .from("content_items")
    .update({ status })
    .eq("id", itemId)
    .select("id, project_id, title")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (clientId) {
    await admin.from("notifications").insert({
      user_id: clientId,
      title: "Content Status Updated",
      message: `Your content has been moved to ${STATUS_LABELS[status] ?? status}`,
      type: "content",
      read: false,
      link: "/calendar",
    });
  }

  if (status === "approved" || status === "published") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const label = STATUS_LABELS[status] ?? status;
    const memberEmails = await getProjectMemberEmails(item.project_id);
    await sendPortalEmail({
      to: memberEmails,
      subject: `Your content has been ${label.toLowerCase()} — ${item.title}`,
      html: buildEmailHtml({
        title: `Content ${label.toLowerCase()}`,
        body: `Your content piece <strong style="color:#fafafa;">"${item.title}"</strong> has been <strong style="color:#fafafa;">${label.toLowerCase()}</strong> by your account manager.`,
        ctaText: "View content",
        ctaUrl: `${appUrl}/calendar`,
      }),
    });
  }

  return NextResponse.json({ item });
}
