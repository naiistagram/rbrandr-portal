import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAdmin } from "@/lib/social-auth";
import { cancelPendingFacebookSchedules, publishContent } from "@/lib/social-publishing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { contentId } = await request.json();
  if (!contentId) return NextResponse.json({ error: "contentId required" }, { status: 400 });

  const { data: content, error: contentError } = await auth.admin
    .from("content_items").select("id, project_id, title, description, platforms, status, file_urls").eq("id", contentId).single();
  if (contentError || !content) return NextResponse.json({ error: "Content item not found" }, { status: 404 });
  if (content.status !== "approved") return NextResponse.json({ error: "Only client-approved content can be published." }, { status: 409 });
  try {
    // A post sent to Meta Planner must be removed before an immediate publish,
    // otherwise Facebook would publish it twice at the former scheduled time.
    await cancelPendingFacebookSchedules(auth.admin, content.id);
    return NextResponse.json(await publishContent(auth.admin, content, auth.user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publishing failed." }, { status: 500 });
  }
}
