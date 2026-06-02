import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ ok: true }); // always 200 — don't leak whether email exists

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const admin = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Try recovery first (confirmed users). If it fails, the user likely exists
  // but hasn't confirmed their email yet — fall back to invite so they can
  // still set up their account.
  let hashed_token: string;
  let linkType: "recovery" | "invite";

  const { data: recoveryData, error: recoveryError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (!recoveryError && recoveryData) {
    hashed_token = recoveryData.properties.hashed_token;
    linkType = "recovery";
  } else {
    console.error("[reset-password] recovery generateLink failed:", recoveryError?.message);
    const { data: inviteData, error: inviteError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
    });
    if (inviteError || !inviteData) {
      console.error("[reset-password] invite generateLink also failed:", inviteError?.message);
      return NextResponse.json({ ok: true }); // user doesn't exist — silent
    }
    hashed_token = inviteData.properties.hashed_token;
    linkType = "invite";
  }

  const resetUrl = `${appUrl}/reset-password?token_hash=${encodeURIComponent(hashed_token)}&type=${linkType}`;

  const { error: emailError } = await resend.emails.send({
    from: "RBRANDR Portal <notifications@rbrandr.com>",
    to: email,
    subject: linkType === "invite" ? "Set up your RBRANDR Portal account" : "Reset your password",
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

          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fafafa;line-height:1.3;">Reset your password</h1>
          <p style="margin:0 0 28px;font-size:14px;color:#a1a1aa;line-height:1.6;">
            Click below to set a new password for your <strong style="color:#fafafa;">RBRANDR Client Portal</strong> account.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="border-radius:8px;background:linear-gradient(135deg,#ed0194,#b400a7);">
              <a href="${resetUrl}" style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;border-radius:8px;">
                Reset password →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:12px;color:#52525b;line-height:1.6;">
            This link expires in 24 hours. If you didn't request a password reset, you can safely ignore this email.
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
    console.error("[reset-password] Resend error:", JSON.stringify(emailError));
    return NextResponse.json({ ok: false, error: emailError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
