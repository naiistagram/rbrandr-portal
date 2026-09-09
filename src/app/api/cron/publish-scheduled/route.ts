import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPendingFacebookSchedule, markPendingFacebookSchedulePublished, publishContent } from "@/lib/social-publishing";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: due, error } = await admin.from("content_items")
    .select("id, project_id, title, description, platforms, file_urls")
    .eq("status", "approved")
    .lte("publish_at", now)
    .is("publish_started_at", null)
    .order("publish_at", { ascending: true })
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const outcomes = [];
  for (const item of due ?? []) {
    const { data: claimed } = await admin.from("content_items").update({ publish_started_at: now })
      .eq("id", item.id).eq("status", "approved").is("publish_started_at", null)
      .select("id").maybeSingle();
    if (!claimed) continue;
    try {
      const facebookIsInMetaPlanner = await hasPendingFacebookSchedule(admin, item.id);
      const result = await publishContent(admin, item, null, facebookIsInMetaPlanner ? ["Facebook"] : []);
      if (facebookIsInMetaPlanner) await markPendingFacebookSchedulePublished(admin, item.id);
      outcomes.push({ id: item.id, published: result.published });
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : "Scheduled publishing failed.";
      await admin.from("content_items").update({ publish_at: null, publish_started_at: null, publish_error: message }).eq("id", item.id);
      outcomes.push({ id: item.id, published: false, error: message });
    }
  }
  return NextResponse.json({ processed: outcomes.length, outcomes });
}
