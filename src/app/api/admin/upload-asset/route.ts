import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string;
  const clientId = formData.get("clientId") as string;
  const name = formData.get("name") as string;
  const category = (formData.get("category") as string) || "other";

  if (!file || !projectId || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const path = `${projectId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("assets")
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("assets").getPublicUrl(path);

  const { data, error: insertError } = await admin
    .from("assets")
    .insert({
      project_id: projectId,
      client_id: clientId,
      uploaded_by: user.id,
      name,
      file_url: publicUrl,
      file_type: file.type,
      file_size: file.size,
      category,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ asset: data });
}
