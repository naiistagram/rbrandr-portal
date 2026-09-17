import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { full_name, company_name, avatar_url } = body;
  if (full_name !== undefined && (typeof full_name !== "string" || !full_name.trim() || full_name.length > 120)) return NextResponse.json({ error: "Name must be 1–120 characters." }, { status: 400 });
  if (company_name !== undefined && (typeof company_name !== "string" || company_name.length > 160)) return NextResponse.json({ error: "Company name is too long." }, { status: 400 });
  if (avatar_url !== undefined && (typeof avatar_url !== "string" || avatar_url.length > 2048 || (avatar_url && !/^https:\/\//.test(avatar_url)))) return NextResponse.json({ error: "Avatar URL must use HTTPS." }, { status: 400 });

  const admin = createAdminClient();
  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name.trim();
  if (company_name !== undefined) updates.company_name = company_name.trim() || null;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  const { data, error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
