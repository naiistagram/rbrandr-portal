import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: "Email required." }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const redirectTo = `${appUrl}/auth/callback?next=/reset-password`;

    let hashedToken: string;
    let linkType: "invite" | "recovery";

    const { data: inviteData, error: inviteError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    if (!inviteError && inviteData) {
      hashedToken = inviteData.properties.hashed_token;
      linkType = "invite";
    } else {
      console.error("[resend-invite] invite generateLink error:", inviteError?.message);
      const { data: recoveryData, error: recoveryError } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (recoveryError || !recoveryData) {
        console.error("[resend-invite] recovery generateLink error:", recoveryError?.message);
        return NextResponse.json({ error: "Failed to generate reset link" }, { status: 400 });
      }
      hashedToken = recoveryData.properties.hashed_token;
      linkType = "recovery";
    }

    const resetUrl = `${appUrl}/auth/callback?token_hash=${hashedToken}&type=${linkType}&next=/reset-password`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: "RBRANDR Portal <notifications@rbrandr.com>",
      to: email,
      subject: "You've been invited to the RBRANDR Portal",
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

          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fafafa;line-height:1.3;">
            You're invited 🎉
          </h1>
          <p style="margin:0 0 28px;font-size:14px;color:#a1a1aa;line-height:1.6;">
            Your account has been set up on the <strong style="color:#fafafa;">RBRANDR Client Portal</strong>. Click below to set your password and get started.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="border-radius:8px;background:linear-gradient(135deg,#ed0194,#b400a7);">
              <a href="${resetUrl}" style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;border-radius:8px;">
                Set password &amp; log in →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:12px;color:#52525b;line-height:1.6;">
            This link expires in 24 hours. If you weren't expecting this, you can safely ignore it.
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
      console.error("[resend-invite] Resend error:", emailError);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resend-invite] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
