import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: clients }, { data: authData }] = await Promise.all([
    admin.from("profiles").select("*").eq("role", "client").order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const confirmedEmails = new Set(
    (authData?.users ?? []).filter((u) => u.email_confirmed_at).map((u) => u.email)
  );

  const clientsWithStatus = (clients ?? []).map((c) => ({
    ...c,
    email_confirmed: confirmedEmails.has(c.email),
  }));

  return NextResponse.json({ clients: clientsWithStatus });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fullName, email, companyName, serviceType, projectName } = await request.json();
  if (!fullName || !email || !companyName) return NextResponse.json({ error: "Name, email, and company are required." }, { status: 400 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // generateLink creates the user AND returns the hashed_token we need.
  // We send a custom Resend email pointing directly to /reset-password so the
  // browser Supabase client can call verifyOtp and own the session — Supabase's
  // built-in invite redirect goes through PKCE which only sets httpOnly cookies
  // that JS cannot read.
  const { data: linkData, error: inviteError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { full_name: fullName, company_name: companyName || null },
    },
  });

  if (inviteError || !linkData?.user) {
    return NextResponse.json({ error: inviteError?.message ?? "Failed to create user." }, { status: 400 });
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
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fafafa;line-height:1.3;">Welcome to the portal</h1>
          <p style="margin:0 0 8px;font-size:14px;color:#a1a1aa;line-height:1.6;">
            Hi ${fullName}, your <strong style="color:#fafafa;">RBRANDR Client Portal</strong> account is ready.${companyName ? ` You've been set up under <strong style="color:#fafafa;">${companyName}</strong>.` : ""}
          </p>
          <p style="margin:0 0 28px;font-size:14px;color:#a1a1aa;line-height:1.6;">
            Click the button below to set your password and access your portal.
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
    console.error("[clients/invite] Resend error:", emailError);
    return NextResponse.json({ error: `User created but invite email failed: ${emailError.message}` }, { status: 500 });
  }

  // The DB trigger creates the profile. Create the project.
  const { data: project, error: projectError } = await admin
    .from("projects")
    .insert({
      client_id: inviteData.user!.id,
      name: projectName?.trim() || `${fullName}'s Project`,
      service_type: serviceType || "social_media",
    })
    .select()
    .single();

  if (projectError) {
    console.error("Project creation failed:", projectError);
  }

  return NextResponse.json({ userId: inviteData.user!.id, projectId: project?.id ?? null });
}
