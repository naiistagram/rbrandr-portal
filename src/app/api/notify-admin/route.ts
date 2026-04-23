import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, message, type, link } = await request.json();
  if (!title || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

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
        type: type ?? "content",
        read: false,
        link: link ?? "/admin/dashboard",
      })
    )
  );

  return NextResponse.json({ ok: true });
}
