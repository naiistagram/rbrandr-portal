import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, message, type, link } = await request.json();
  if (!title || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (typeof title !== "string" || typeof message !== "string" || title.length > 200 || message.length > 2000) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  const ALLOWED_TYPES = ["content", "ticket", "contract", "document", "asset"];
  const notifType = ALLOWED_TYPES.includes(type) ? type : "content";
  // Only allow same-origin relative links — never trust an absolute/external URL from the caller
  const safeLink = typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link : "/admin/dashboard";

  const admin = createAdminClient();
  const { data: adminUsers } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (!adminUsers?.length) return NextResponse.json({ ok: true });

  await Promise.all(
    adminUsers.map((a) =>
      admin.from("notifications").insert({
        user_id: a.id,
        title,
        message,
        type: notifType,
        read: false,
        link: safeLink,
      })
    )
  );

  return NextResponse.json({ ok: true });
}
