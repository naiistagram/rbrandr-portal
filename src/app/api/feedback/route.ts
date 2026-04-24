import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { project_id, rating, message, category } = body;
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  const admin = createAdminClient();

  const { data, error } = await admin.from("feedback").insert({
    project_id: project_id ?? null,
    submitted_by: user.id,
    rating: rating ?? null,
    message,
    category: category ?? "general",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}
