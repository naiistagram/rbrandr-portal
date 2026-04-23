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
  const period = formData.get("period") as string;
  const summary = (formData.get("summary") as string) || "";
  const clientId = formData.get("clientId") as string;

  if (!file || !projectId || !title || !period) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const path = `${projectId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("reports")
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("reports").getPublicUrl(path);

  const { data, error: insertError } = await admin
    .from("reports")
    .insert({ project_id: projectId, title, period, file_url: publicUrl, summary: summary || null })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (clientId) {
    await admin.from("notifications").insert({
      user_id: clientId,
      title: "New Report Available",
      message: `Your ${period} report has been uploaded.`,
      type: "report",
      read: false,
      link: "/reports",
    });
  }

  return NextResponse.json({ report: data });
}
