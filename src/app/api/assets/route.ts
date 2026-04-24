import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [{ data: ownedProjects }, { data: memberRows }] = await Promise.all([
    admin.from("projects").select("id").eq("client_id", user.id),
    admin.from("project_members").select("project_id").eq("user_id", user.id),
  ]);

  const ownedIds = new Set((ownedProjects ?? []).map((p) => p.id));
  const projectIds = [
    ...Array.from(ownedIds),
    ...(memberRows ?? []).map((r) => r.project_id).filter((id) => !ownedIds.has(id)),
  ];

  if (projectIds.length === 0) return NextResponse.json({ assets: [], projectIds: [] });

  const { data: assets } = await admin
    .from("assets")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  return NextResponse.json({ assets: assets ?? [], projectIds });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("assets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { project_id, name, file_url, file_type, file_size, category } = body;
  if (!project_id || !name || !file_url) {
    return NextResponse.json({ error: "project_id, name, and file_url required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user has access to this project
  const [{ data: owned }, { data: membership }] = await Promise.all([
    admin.from("projects").select("id").eq("id", project_id).eq("client_id", user.id).single(),
    admin.from("project_members").select("user_id").eq("project_id", project_id).eq("user_id", user.id).single(),
  ]);
  if (!owned && !membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await admin.from("assets").insert({
    project_id,
    uploaded_by: user.id,
    client_id: user.id,
    name,
    file_url,
    file_type: file_type ?? null,
    file_size: file_size ?? null,
    category: category ?? "other",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}
