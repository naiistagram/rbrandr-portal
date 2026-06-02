import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getUserProjectIds(userId: string, admin: ReturnType<typeof createAdminClient>) {
  const [{ data: ownedProjects }, { data: memberRows }] = await Promise.all([
    admin.from("projects").select("id").eq("client_id", userId),
    admin.from("project_members").select("project_id").eq("user_id", userId),
  ]);
  const ids = new Set<string>((ownedProjects ?? []).map((p) => p.id));
  for (const r of memberRows ?? []) ids.add(r.project_id);
  return Array.from(ids);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const projectIds = await getUserProjectIds(user.id, admin);
  if (projectIds.length === 0) return NextResponse.json({ contracts: [] });

  const { data: contracts } = await admin
    .from("contracts")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  return NextResponse.json({ contracts: contracts ?? [] });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, signature_data, signature_name, signed_at } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();

  // Verify user has access to this contract's project
  const projectIds = await getUserProjectIds(user.id, admin);
  const { data: contract } = await admin.from("contracts").select("project_id").eq("id", id).single();
  if (!contract || !projectIds.includes(contract.project_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("contracts")
    .update({ status, signature_data, signature_name, signed_at })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contract: data });
}
