import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { project_id, rating, message, category } = body;
  if (typeof message !== "string" || !message.trim() || message.length > 5000) return NextResponse.json({ error: "A message of up to 5,000 characters is required." }, { status: 400 });
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  if (category !== undefined && !["general", "service", "platform", "other"].includes(category)) return NextResponse.json({ error: "Invalid feedback category." }, { status: 400 });

  const admin = createAdminClient();
  if (project_id) {
    const [{ data: owned }, { data: membership }] = await Promise.all([
      admin.from("projects").select("id").eq("id", project_id).eq("client_id", user.id).maybeSingle(),
      admin.from("project_members").select("id").eq("project_id", project_id).eq("user_id", user.id).maybeSingle(),
    ]);
    if (!owned && !membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await admin.from("feedback").insert({
    project_id: project_id ?? null,
    submitted_by: user.id,
    rating: rating ?? null,
    message: message.trim(),
    category: category ?? "general",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}
