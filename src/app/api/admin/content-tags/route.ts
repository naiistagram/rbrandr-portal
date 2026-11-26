import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAdmin } from "@/lib/social-auth";
import {
  CONTENT_TAG_FIELDS,
  isMissingTableError,
  MAX_INSTAGRAM_TAGS,
  TAG_PLATFORMS,
  type TagPlatform,
} from "@/lib/social-tagging";

export const runtime = "nodejs";

const MIGRATION_MESSAGE = "Run supabase-social-tagging-migration.sql in Supabase before using tagging.";

type IncomingTag = { social_person_id: string; platform: TagPlatform; media_index: number; x: number | null; y: number | null };

function coordinate(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error("Tag positions must be between 0 and 1.");
  return Math.round(number * 10000) / 10000;
}

function readTags(value: unknown): IncomingTag[] {
  if (!Array.isArray(value)) throw new Error("tags must be a list.");
  const seen = new Set<string>();
  const tags = value.map((raw) => {
    const tag = raw as Record<string, unknown>;
    if (typeof tag.social_person_id !== "string") throw new Error("Each tag needs a person.");
    if (!TAG_PLATFORMS.includes(tag.platform as TagPlatform)) throw new Error("Tags can be added for Instagram or LinkedIn.");
    const key = `${tag.social_person_id}:${tag.platform}`;
    if (seen.has(key)) throw new Error("Each person can only be tagged once per platform.");
    seen.add(key);
    const mediaIndex = Number(tag.media_index ?? 0);
    if (!Number.isInteger(mediaIndex) || mediaIndex < 0) throw new Error("Invalid attachment for tag.");
    return {
      social_person_id: tag.social_person_id,
      platform: tag.platform as TagPlatform,
      media_index: mediaIndex,
      x: tag.platform === "Instagram" ? coordinate(tag.x) : null,
      y: tag.platform === "Instagram" ? coordinate(tag.y) : null,
    };
  });
  if (tags.filter((tag) => tag.platform === "Instagram").length > MAX_INSTAGRAM_TAGS) {
    throw new Error(`Instagram allows up to ${MAX_INSTAGRAM_TAGS} people to be tagged in one image.`);
  }
  return tags;
}

// GET /api/admin/content-tags?contentId= — the tags placed on one content item.
export async function GET(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const contentId = request.nextUrl.searchParams.get("contentId");
  if (!contentId) return NextResponse.json({ error: "contentId required" }, { status: 400 });
  const { data, error } = await auth.admin.from("content_tags")
    .select(CONTENT_TAG_FIELDS)
    .eq("content_item_id", contentId)
    .order("created_at");
  if (error && isMissingTableError(error)) return NextResponse.json({ tags: [], unavailable: MIGRATION_MESSAGE });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tags: data ?? [] });
}

// PUT /api/admin/content-tags — replace the tags on a content item that has not been published.
export async function PUT(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { contentId?: unknown; tags?: unknown };
  if (typeof body.contentId !== "string") return NextResponse.json({ error: "contentId required" }, { status: 400 });

  let tags: IncomingTag[];
  try {
    tags = readTags(body.tags);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const { data: content, error: contentError } = await auth.admin.from("content_items")
    .select("id, status, publish_started_at")
    .eq("id", body.contentId)
    .maybeSingle();
  if (contentError) return NextResponse.json({ error: contentError.message }, { status: 500 });
  if (!content) return NextResponse.json({ error: "Content not found." }, { status: 404 });
  // Published tags are the historical record of who was tagged; keep them fixed.
  if (content.status === "published") return NextResponse.json({ error: "This content has been published, so its tags can no longer change." }, { status: 409 });
  if (content.publish_started_at) return NextResponse.json({ error: "This content is publishing right now. Try again in a moment." }, { status: 409 });

  const personIds = [...new Set(tags.map((tag) => tag.social_person_id))];
  const { data: people, error: peopleError } = personIds.length
    ? await auth.admin.from("social_people").select("id, display_name, instagram_username, linkedin_urn").in("id", personIds)
    : { data: [], error: null };
  if (peopleError && isMissingTableError(peopleError)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
  if (peopleError) return NextResponse.json({ error: peopleError.message }, { status: 500 });
  const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
  for (const tag of tags) {
    const person = peopleById.get(tag.social_person_id);
    if (!person) return NextResponse.json({ error: "One of the tagged people no longer exists." }, { status: 400 });
    if (tag.platform === "Instagram" && !person.instagram_username) return NextResponse.json({ error: `${person.display_name} has no Instagram username saved.` }, { status: 400 });
    if (tag.platform === "LinkedIn" && !person.linkedin_urn) return NextResponse.json({ error: `${person.display_name} has no LinkedIn ID yet.` }, { status: 400 });
  }

  const { error: deleteError } = await auth.admin.from("content_tags").delete().eq("content_item_id", body.contentId);
  if (deleteError && isMissingTableError(deleteError)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (!tags.length) return NextResponse.json({ tags: [] });
  const { data, error } = await auth.admin.from("content_tags").insert(tags.map((tag) => {
    const person = peopleById.get(tag.social_person_id)!;
    return {
      ...tag,
      content_item_id: body.contentId,
      display_name: person.display_name,
      handle: tag.platform === "Instagram" ? person.instagram_username : person.linkedin_urn,
      status: "pending",
      created_by: auth.user.id,
    };
  })).select(CONTENT_TAG_FIELDS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tags: data ?? [] });
}
