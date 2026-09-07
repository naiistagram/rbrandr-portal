import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendContentStatusEmail } from "@/lib/email";

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

  const { itemId, status, scheduledDate, scheduledTime, clientId } = await request.json();
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const updates: Record<string, string | null> = {};
  if (status !== undefined) {
    if (!STATUS_LABELS[status]) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    updates.status = status;
  }
  if (scheduledDate !== undefined) {
    if (scheduledDate !== null && scheduledDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      return NextResponse.json({ error: "Invalid scheduled date" }, { status: 400 });
    }
    updates.scheduled_date = scheduledDate || null;
    // A changed date must be explicitly re-queued by an admin, otherwise an
    // earlier UTC publish time could still fire.
    updates.publish_at = null;
    updates.publish_started_at = null;
    updates.publish_error = null;
  }
  if (scheduledTime !== undefined) {
    if (scheduledTime !== null && scheduledTime !== "" && !/^\d{2}:\d{2}$/.test(scheduledTime)) {
      return NextResponse.json({ error: "Invalid scheduled time" }, { status: 400 });
    }
    updates.scheduled_time = scheduledTime || null;
    updates.publish_at = null;
    updates.publish_started_at = null;
    updates.publish_error = null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
  }

  const { data: item, error } = await admin
    .from("content_items")
    .update(updates)
    .eq("id", itemId)
    .select("id, project_id, title")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status !== undefined && clientId) {
    await admin.from("notifications").insert({
      user_id: clientId,
      title: "Content Status Updated",
      message: `Your content has been moved to ${STATUS_LABELS[status] ?? status}`,
      type: "content",
      read: false,
      link: "/calendar",
    });
  }

  if (status === "in_review" || status === "approved" || status === "published") {
    await sendContentStatusEmail(item.project_id, item.title, status);
  }

  return NextResponse.json({ item });
}
