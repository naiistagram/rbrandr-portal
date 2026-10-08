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

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { clientId, name, service_type, goals, competition, status, kpis, brief } = body;

  if (!clientId || !name) {
    return NextResponse.json({ error: "clientId and name are required" }, { status: 400 });
  }

  const { data: existingProjects, error: existingError } = await admin.from("projects")
    .select("brief").eq("client_id", clientId);
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const configuredProject = (existingProjects ?? []).find((entry) => entry.brief && typeof entry.brief === "object" && !Array.isArray(entry.brief) && "monthly_post_target" in entry.brief);
  const target = monthlyPostTarget(configuredProject?.brief);
  const projectBrief = brief && typeof brief === "object" && !Array.isArray(brief) ? brief : {};

  const { data, error } = await admin
    .from("projects")
    .insert({ client_id: clientId, name, service_type: service_type || "social_media", goals: goals || null, competition: competition || null, status: status || "draft", kpis: kpis ?? null, brief: { ...projectBrief, monthly_post_target: target } })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ project: data });
}
