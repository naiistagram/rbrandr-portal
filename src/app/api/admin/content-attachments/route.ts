import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

function isAllowedContentAttachment(fileName: string, contentType: string) {
  const lowerName = fileName.toLowerCase();
  return (
    contentType === "application/pdf" ||
    lowerName.endsWith(".pdf") ||
    contentType.startsWith("image/") ||
    contentType.startsWith("video/")
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const originalName = typeof body.fileName === "string" ? body.fileName : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

  if (!projectId || !originalName || !isAllowedContentAttachment(originalName, contentType)) {
    return NextResponse.json({ error: "Only PDF, image, and video attachments are supported." }, { status: 400 });
  }

  const maxSize = contentType.startsWith("video/") ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxSize) {
    const limit = contentType.startsWith("video/") ? "500MB" : "50MB";
    return NextResponse.json({ error: `File is too large. The limit is ${limit}.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: profile }, { data: project }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("projects").select("id").eq("id", projectId).maybeSingle(),
  ]);

  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "attachment";
  const path = `${projectId}/content-${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await admin.storage.from("assets").createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not prepare the attachment upload." }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from("assets").getPublicUrl(path);
  return NextResponse.json({ path, token: data.token, publicUrl });
}
