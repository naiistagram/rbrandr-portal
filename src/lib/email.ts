import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const FROM = "RBRANDR Portal <notifications@rbrandr.com>";

export async function getProjectMemberEmails(
  projectId: string,
  ceoOnly = false
): Promise<string[]> {
  const admin = createAdminClient();

  const { data: project } = await admin
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .single();

  const { data: members } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  const userIds = Array.from(
    new Set([
      ...(project?.client_id ? [project.client_id] : []),
      ...(members?.map((m) => m.user_id) ?? []),
    ])
  );

  if (userIds.length === 0) return [];

  const { data: profiles } = await admin
    .from("profiles")
    .select("email, client_role")
    .in("id", userIds);

  if (!profiles) return [];

  return ceoOnly
    ? profiles.filter((p) => p.client_role === "ceo").map((p) => p.email)
    : profiles.map((p) => p.email);
}

export async function getAdminEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("role", "admin");
  return data?.map((p) => p.email) ?? [];
}

export function buildEmailHtml(params: {
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
}): string {
  const { title, body, ctaText, ctaUrl } = params;
  return `<!DOCTYPE html>
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
            ${title}
          </h1>
          <p style="margin:0 0 28px;font-size:14px;color:#a1a1aa;line-height:1.6;">
            ${body}
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="border-radius:8px;background:linear-gradient(135deg,#ed0194,#b400a7);">
              <a href="${ctaUrl}" style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;border-radius:8px;">
                ${ctaText} →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:12px;color:#52525b;line-height:1.6;">
            You're receiving this because you're a member of the RBRANDR Client Portal.
          </p>
        </td></tr>

        <tr><td style="padding-top:24px;" align="center">
          <p style="margin:0;font-size:11px;color:#3f3f46;">© RBRANDR · Sent by RBRANDR Portal</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendPortalEmail(params: {
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  const { to, subject, html } = params;
  if (to.length === 0) return;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) console.error("[sendPortalEmail] Resend error:", error);
  } catch (err) {
    console.error("[sendPortalEmail] Unhandled error:", err);
  }
}
