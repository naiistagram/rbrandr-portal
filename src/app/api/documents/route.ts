import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signStorageUrl } from "@/lib/storage-url";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
]);

async function getAccessibleProjectIds(userId: string, admin: ReturnType<typeof createAdminClient>) {
  const [{ data: ownedProjects }, { data: memberRows }] = await Promise.all([
    admin.from("projects").select("id").eq("client_id", userId),
    admin.from("project_members").select("project_id").eq("user_id", userId),
  ]);
  return Array.from(new Set([
    ...(ownedProjects ?? []).map((project) => project.id),
    ...(memberRows ?? []).map((member) => member.project_id),
  ]));
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const projectIds = await getAccessibleProjectIds(user.id, admin);

  if (projectIds.length === 0) return NextResponse.json({ documents: [], projectIds: [] });

  const { data: documents } = await admin
    .from("documents")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  const signedDocuments = await Promise.all((documents ?? []).map(async (document) => ({
    ...document,
    file_url: await signStorageUrl(admin, "documents", document.file_url),
  })));
  return NextResponse.json({ documents: signedDocuments, projectIds });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const projectId = formData.get("projectId");
  if (!(file instanceof File) || typeof projectId !== "string") {
    return NextResponse.json({ error: "A file and project are required." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE || !ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file or file exceeds the 50MB limit." }, { status: 400 });
  }

  const admin = createAdminClient();
  const projectIds = await getAccessibleProjectIds(user.id, admin);
  if (!projectIds.includes(projectId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "document";
  const path = `${projectId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await admin.storage.from("documents").upload(path, file, { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from("documents").getPublicUrl(path);
  const { data, error } = await admin.from("documents").insert({
    project_id: projectId,
    uploaded_by: user.id,
    title: file.name.slice(0, 255),
    file_url: publicUrl,
    file_type: file.type,
    file_size: file.size,
  }).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create the document." }, { status: 500 });

  return NextResponse.json({ document: { ...data, file_url: await signStorageUrl(admin, "documents", data.file_url) } });
}
