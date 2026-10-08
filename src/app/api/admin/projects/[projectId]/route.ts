import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthlyPostTarget } from "@/lib/monthly-cadence";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return admin;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { projectId } = await params;
  const body = await request.json();
  const { name, service_type, goals, competition, status, kpis, brief } = body;
  const { data: currentProject, error: currentError } = await admin.from("projects")
    .select("client_id, brief").eq("id", projectId).maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!currentProject) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const savedBrief = currentProject.brief && typeof currentProject.brief === "object" && !Array.isArray(currentProject.brief) ? currentProject.brief : {};
  const nextBrief = brief && typeof brief === "object" && !Array.isArray(brief) ? brief : {};

  const { data, error } = await admin
    .from("projects")
    .update({ name, service_type, goals: goals || null, competition: competition || null, status, kpis: kpis ?? null, brief: { ...savedBrief, ...nextBrief, monthly_post_target: monthlyPostTarget(savedBrief) } })
    .eq("id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ project: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { projectId } = await params;
  const { error } = await admin.from("projects").delete().eq("id", projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
