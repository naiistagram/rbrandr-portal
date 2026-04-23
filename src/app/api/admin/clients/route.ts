import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: clients } = await admin.from("profiles").select("*").eq("role", "client").order("created_at", { ascending: false });

  return NextResponse.json({ clients: clients ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { fullName, email, companyName, serviceType, projectName } = await request.json();
  if (!fullName || !email) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      company_name: companyName || null,
    },
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (inviteError || !inviteData.user) {
    return NextResponse.json({ error: inviteError?.message ?? "Failed to create user." }, { status: 400 });
  }

  // The DB trigger creates the profile. Create the project.
  const { data: project, error: projectError } = await admin
    .from("projects")
    .insert({
      client_id: inviteData.user.id,
      name: projectName?.trim() || `${fullName}'s Project`,
      service_type: serviceType || "social_media",
    })
    .select()
    .single();

  if (projectError) {
    console.error("Project creation failed:", projectError);
  }

  return NextResponse.json({ userId: inviteData.user.id, projectId: project?.id ?? null });
}
