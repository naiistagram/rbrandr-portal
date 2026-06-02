import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const filePath = `avatars/${user.id}.${ext}`;
  const bytes = await file.arrayBuffer();

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("avatars")
    .upload(filePath, bytes, { contentType: file.type, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(filePath);
  // Cache-bust so browsers load the new image immediately
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  return NextResponse.json({ url: publicUrl });
}
