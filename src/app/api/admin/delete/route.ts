import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TABLES = ["contracts", "reports", "documents"] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { table, id } = await request.json();
  if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const { data: record } = await admin.from(table).select("file_url").eq("id", id).single();
  if (record?.file_url) {
    const parts = record.file_url.split("/object/public/");
    if (parts.length > 1) {
      const [bucketAndPath] = parts.slice(1);
      const pathParts = bucketAndPath.split("/");
      const bucket = pathParts[0];
      const filePath = pathParts.slice(1).join("/");
      await admin.storage.from(bucket).remove([filePath]);
    }
  }

  await admin.from(table).delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
