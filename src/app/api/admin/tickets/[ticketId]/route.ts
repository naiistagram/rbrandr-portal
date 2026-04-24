import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildEmailHtml, sendPortalEmail } from "@/lib/email";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return admin;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await admin.from("tickets").delete().eq("id", ticketId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if ("status" in body) updates.status = body.status;
  if ("admin_response" in body) updates.admin_response = body.admin_response ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const sendResponseEmail = "admin_response" in body && body.admin_response;

  // Fetch ticket before update so we have title + submitter
  const { data: ticket } = sendResponseEmail
    ? await admin.from("tickets").select("title, submitted_by").eq("id", ticketId).single()
    : { data: null };

  const { error } = await admin.from("tickets").update(updates).eq("id", ticketId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (sendResponseEmail && ticket) {
    const { data: submitter } = await admin
      .from("profiles")
      .select("email")
      .eq("id", ticket.submitted_by)
      .single();

    if (submitter?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await sendPortalEmail({
        to: [submitter.email],
        subject: `Your support ticket has been updated — ${ticket.title}`,
        html: buildEmailHtml({
          title: "Your ticket has a response",
          body: `An admin has responded to your support ticket <strong style="color:#fafafa;">"${ticket.title}"</strong>. Log in to view the response.`,
          ctaText: "View ticket",
          ctaUrl: `${appUrl}/tickets`,
        }),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
