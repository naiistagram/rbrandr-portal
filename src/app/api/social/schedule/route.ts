import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAdmin } from "@/lib/social-auth";
import { cancelPendingFacebookSchedules, scheduleFacebookInMeta } from "@/lib/social-publishing";

export const runtime = "nodejs";

function londonTimeToUtc(date: string, time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Choose a valid date and time.");
  const [year, month, day] = match.slice(1).map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const localParts = formatter.formatToParts(new Date(desired)).reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const shown = Date.UTC(Number(localParts.year), Number(localParts.month) - 1, Number(localParts.day), Number(localParts.hour), Number(localParts.minute));
  return new Date(desired - (shown - desired));
}

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { contentId, scheduledDate, scheduledTime } = await request.json();
  if (!contentId || !scheduledDate || !scheduledTime) return NextResponse.json({ error: "Choose both a publish date and time." }, { status: 400 });

  let publishAt: Date;
  try { publishAt = londonTimeToUtc(scheduledDate, scheduledTime); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid schedule." }, { status: 400 });
  }
  if (publishAt.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future time to schedule this post." }, { status: 400 });

  const { data: content, error: contentError } = await auth.admin
    .from("content_items").select("id, project_id, title, description, file_urls, status, platforms").eq("id", contentId).single();
  if (contentError || !content) return NextResponse.json({ error: "Content item not found." }, { status: 404 });
  if (content.status !== "approved") return NextResponse.json({ error: "Only client-approved content can be scheduled." }, { status: 409 });
  if (!(content.platforms as string[]).some((platform) => ["Facebook", "Instagram", "LinkedIn"].includes(platform))) {
    return NextResponse.json({ error: "Select Instagram, Facebook, or LinkedIn before scheduling." }, { status: 400 });
  }

  // An updated schedule must replace the old native Facebook post too, or the
  // old time would still publish from Meta and create a duplicate.
  try {
    await cancelPendingFacebookSchedules(auth.admin, content.id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update the existing Facebook schedule." }, { status: 409 });
  }

  const { data, error } = await auth.admin.from("content_items").update({
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    publish_at: publishAt.toISOString(),
    publish_started_at: null,
    publish_error: null,
  }).eq("id", contentId).select("id, publish_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const metaPlanner = await scheduleFacebookInMeta(auth.admin, content, auth.user.id, publishAt);
  return NextResponse.json({ content: data, metaPlanner });
}
