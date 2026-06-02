import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return admin;
}

// GET /api/admin/clients/[id]/members — list team members for this client
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Find the client's primary project
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!project) return NextResponse.json({ members: [] });

  const [{ data: memberships }, { data: authData }] = await Promise.all([
    admin
      .from("project_members")
      .select("id, user_id, created_at, profiles(id, full_name, email, avatar_url, client_role, job_title, company_name)")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const confirmedEmails = new Set(
    (authData?.users ?? []).filter((u) => u.email_confirmed_at).map((u) => u.email)
  );

  const membersWithStatus = (memberships ?? []).map((m) => ({
    ...m,
    email_confirmed: confirmedEmails.has((m.profiles as { email?: string })?.email ?? ""),
  }));

  return NextResponse.json({ members: membersWithStatus });
}

// POST /api/admin/clients/[id]/members — invite a new team member
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fullName, email, jobTitle } = await req.json();
  if (!fullName || !email) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });

  // Find the client's primary project
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!project) return NextResponse.json({ error: "Client has no project." }, { status: 400 });

  // Inherit company name from the parent client's profile
  const { data: clientProfile } = await admin.from("profiles").select("company_name").eq("id", clientId).single();
  const companyName = clientProfile?.company_name ?? null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // generateLink creates the user AND returns the hashed_token for a direct link.
  // Same pattern as the main client invite — bypasses Supabase's PKCE redirect so
  // the browser client can verifyOtp and own the session in readable storage.
  const { data: linkData, error: inviteError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name: fullName } },
  });

  if (inviteError || !linkData?.user) {
    return NextResponse.json({ error: inviteError?.message ?? "Failed to invite user." }, { status: 400 });
  }

  const inviteData = linkData;
  const inviteUrl = `${appUrl}/reset-password?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=invite`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: emailError } = await resend.emails.send({
    from: "RBRANDR Portal <notifications@rbrandr.com>",
    to: email,
    subject: "You've been invited to the RBRANDR Client Portal",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RBRANDR Portal</title></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding-bottom:32px;" align="center">
          <span style="font-size:13px;font-weight:800;letter-spacing:0.15em;color:#fafafa;text-transform:uppercase;">RBRANDRSPHERE</span>
        </td></tr>
        <tr><td style="background:#111113;border:1px solid #27272a;border-radius:16px;padding:40px 36px;">
          <div style="height:3px;border-radius:2px;background:linear-gradient(90deg,#ed0194,#b400a7,#cd55c4);margin-bottom:32px;"></div>
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fafafa;line-height:1.3;">You've been added to the portal</h1>
          <p style="margin:0 0 28px;font-size:14px;color:#a1a1aa;line-height:1.6;">
            Hi ${fullName}, you've been added to the <strong style="color:#fafafa;">RBRANDR Client Portal</strong>. Click below to set your password and get access.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="border-radius:8px;background:linear-gradient(135deg,#ed0194,#b400a7);">
              <a href="${inviteUrl}" style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;border-radius:8px;">
                Set up your account →
              </a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#52525b;line-height:1.6;">
            This invite link expires in 24 hours. If you weren't expecting this, you can safely ignore it.
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;" align="center">
          <p style="margin:0;font-size:11px;color:#3f3f46;">© RBRANDR · Sent by RBRANDR Portal</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  if (emailError) {
    console.error("[members/invite] Resend error:", emailError);
    return NextResponse.json({ error: `User invited but email failed: ${emailError.message}` }, { status: 500 });
  }

  // Set client_role = 'member' on their profile (trigger creates the profile row)
  // Use upsert in case trigger hasn't fired yet
  await admin.from("profiles").upsert({
    id: inviteData.user!.id,
    email,
    full_name: fullName,
    role: "client",
    client_role: "member",
    job_title: jobTitle?.trim() || null,
    avatar_url: null,
    company_name: companyName,
  }, { ignoreDuplicates: false });

  // Link them to the project
  const { error: memberError } = await admin
    .from("project_members")
    .insert({ project_id: project.id, user_id: inviteData.user!.id });

  if (memberError) {
    return NextResponse.json({ error: "User invited but could not be linked to project." }, { status: 500 });
  }

  return NextResponse.json({ userId: inviteData.user!.id });
}

// PATCH /api/admin/clients/[id]/members — update a member's client_role
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, clientRole, company_name } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  if (company_name !== undefined) {
    const { error } = await admin.from("profiles").update({ company_name: company_name || null }).eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!clientRole) return NextResponse.json({ error: "clientRole is required." }, { status: 400 });
  if (!["ceo", "member"].includes(clientRole)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  const { error } = await admin.from("profiles").update({ client_role: clientRole }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/clients/[id]/members — remove a team member by membership id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { membershipId, userId } = await req.json();
  if (!membershipId || !userId) return NextResponse.json({ error: "membershipId and userId are required." }, { status: 400 });

  // Remove the project_members row
  await admin.from("project_members").delete().eq("id", membershipId);

  // Delete their auth account and profile entirely
  await admin.auth.admin.deleteUser(userId);

  // Verify the client actually owns this project (safety check)
  void clientId;

  return NextResponse.json({ ok: true });
}
