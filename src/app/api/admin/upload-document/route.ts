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
  const clientId = (formData.get("clientId") as string) || null;
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || "";

  if (!file || !projectId || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const path = `${projectId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("documents")
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("documents").getPublicUrl(path);

  const { data, error: insertError } = await admin
    .from("documents")
    .insert({
      project_id: projectId,
      client_id: clientId,
      uploaded_by: user.id,
      title,
      description: description || null,
      file_url: publicUrl,
      file_type: file.type,
      file_size: file.size,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ document: data });
}
