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
  const title = formData.get("title") as string;
  const type = (formData.get("type") as string) || "contract";
  const clientId = formData.get("clientId") as string;

  if (!file || !projectId || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const path = `${projectId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("contracts")
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("contracts").getPublicUrl(path);

  const { data, error: insertError } = await admin
    .from("contracts")
    .insert({ project_id: projectId, title, file_url: publicUrl, type, status: "pending" })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (clientId) {
    await admin.from("notifications").insert({
      user_id: clientId,
      title: type === "terms" ? "New T&Cs to Review" : "New Contract to Sign",
      message: `"${title}" has been uploaded and requires your attention.`,
      type: "contract",
      read: false,
      link: "/contracts",
    });
  }

  return NextResponse.json({ contract: data });
}
