import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, normalizeInstagramUsername } from "@/lib/social-tagging";

export const runtime = "nodejs";

const FIELDS = "id, display_name, instagram_username, linkedin_name, linkedin_connected_at";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function unavailable() {
  return NextResponse.json({ error: "Tagging is not set up yet." }, { status: 503 });
}

// GET /api/social/me — the signed-in user's own tagging handles.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().from("social_people").select(FIELDS).eq("profile_id", user.id).maybeSingle();
  if (error && isMissingTableError(error)) return NextResponse.json({ person: null, unavailable: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ person: data });
}

// PATCH /api/social/me — save the user's Instagram username.
export async function PATCH(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { instagram_username?: unknown };
  let instagram: string | null | undefined;
  try {
    instagram = normalizeInstagramUsername(body.instagram_username ?? null);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin.from("social_people").select("id").eq("profile_id", user.id).maybeSingle();
  if (lookupError && isMissingTableError(lookupError)) return unavailable();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });

  if (existing) {
    const { data, error } = await admin.from("social_people").update({ instagram_username: instagram }).eq("id", existing.id).select(FIELDS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ person: data });
  }
  if (!instagram) return NextResponse.json({ person: null });
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
  const { data, error } = await admin.from("social_people").insert({
    display_name: (profile?.full_name || instagram).replace(/[[\]\n]/g, "").slice(0, 120),
    kind: "person",
    instagram_username: instagram,
    profile_id: user.id,
    created_by: user.id,
  }).select(FIELDS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ person: data });
}

// DELETE /api/social/me — disconnect LinkedIn (stop being mentionable there).
export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().from("social_people")
    .update({ linkedin_urn: null, linkedin_name: null, linkedin_connected_at: null })
    .eq("profile_id", user.id)
    .select(FIELDS)
    .maybeSingle();
  if (error && isMissingTableError(error)) return unavailable();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ person: data });
}
