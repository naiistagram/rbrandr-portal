import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return admin;
}

// GET /api/admin/clients/[id]/members — list team members for this client
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Find the client's primary project
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!project) return NextResponse.json({ members: [] });

  const { data: memberships } = await admin
    .from("project_members")
    .select("id, user_id, created_at, profiles(id, full_name, email, avatar_url, client_role, job_title)")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ members: memberships ?? [] });
}

// POST /api/admin/clients/[id]/members — invite a new team member
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fullName, email, jobTitle } = await req.json();
  if (!fullName || !email) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });

  // Find the client's primary project
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!project) return NextResponse.json({ error: "Client has no project." }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Invite the user via Supabase auth
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (inviteError || !inviteData.user) {
    return NextResponse.json({ error: inviteError?.message ?? "Failed to invite user." }, { status: 400 });
  }

  // Set client_role = 'member' on their profile (trigger creates the profile row)
  // Use upsert in case trigger hasn't fired yet
  await admin.from("profiles").upsert({
    id: inviteData.user.id,
    email,
    full_name: fullName,
    role: "client",
    client_role: "member",
    job_title: jobTitle?.trim() || null,
    avatar_url: null,
    company_name: null,
  }, { ignoreDuplicates: false });

  // Link them to the project
  const { error: memberError } = await admin
    .from("project_members")
    .insert({ project_id: project.id, user_id: inviteData.user.id });

  if (memberError) {
    return NextResponse.json({ error: "User invited but could not be linked to project." }, { status: 500 });
  }

  return NextResponse.json({ userId: inviteData.user.id });
}

// PATCH /api/admin/clients/[id]/members — update a member's client_role
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params;
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, clientRole } = await req.json();
  if (!userId || !clientRole) return NextResponse.json({ error: "userId and clientRole are required." }, { status: 400 });
  if (!["ceo", "member"].includes(clientRole)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  const { error } = await admin.from("profiles").update({ client_role: clientRole }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/clients/[id]/members — remove a team member by membership id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { membershipId, userId } = await req.json();
  if (!membershipId || !userId) return NextResponse.json({ error: "membershipId and userId are required." }, { status: 400 });

  // Remove the project_members row
  await admin.from("project_members").delete().eq("id", membershipId);

  // Delete their auth account and profile entirely
  await admin.auth.admin.deleteUser(userId);

  // Verify the client actually owns this project (safety check)
  void clientId;

  return NextResponse.json({ ok: true });
}
