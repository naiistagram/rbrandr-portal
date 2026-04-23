import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
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

  // Try invite first (for users who haven't confirmed yet — Supabase sends the email)
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (inviteError) {
    // User already confirmed — generate a recovery link and email it via Resend
    const { data: linkData, error: resetError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 400 });

    const resetUrl = linkData.properties.action_link;
    const { error: emailError } = await resend.emails.send({
      from: "rbrandr Portal <notifications@rbrandr.com>",
      to: email,
      subject: "Set your rbrandr Portal password",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #111; margin: 0 0 8px;">Set your password</h2>
          <p style="color: #555; margin: 0 0 24px;">Your account manager has sent you a link to set your password for the rbrandr Portal.</p>
          <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Set password &amp; log in
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 24px;">This link expires in 24 hours. If you didn't expect this email, you can safely ignore it.</p>
        </div>
      `,
    });
    if (emailError) return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
