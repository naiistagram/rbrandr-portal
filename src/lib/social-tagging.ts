import type { SupabaseClient } from "@supabase/supabase-js";

export type SocialPerson = {
  id: string;
  display_name: string;
  kind: "person" | "organization";
  instagram_username: string | null;
  linkedin_urn: string | null;
  linkedin_name: string | null;
  linkedin_connected_at?: string | null;
  profile_id: string | null;
  notes?: string | null;
};

export type ContentTag = {
  id: string;
  content_item_id: string;
  social_person_id: string | null;
  platform: "Instagram" | "LinkedIn";
  media_index: number;
  x: number | null;
  y: number | null;
  display_name: string;
  handle: string | null;
  status: "pending" | "published" | "failed";
  external_post_id: string | null;
  error_message: string | null;
  published_at: string | null;
};

export type TagPlatform = ContentTag["platform"];
export const TAG_PLATFORMS: TagPlatform[] = ["Instagram", "LinkedIn"];

/** Instagram accepts at most 20 tagged accounts on a single image. */
export const MAX_INSTAGRAM_TAGS = 20;

export const SOCIAL_PERSON_FIELDS = "id, display_name, kind, instagram_username, linkedin_urn, linkedin_name, linkedin_connected_at, profile_id, notes";
export const CONTENT_TAG_FIELDS = "id, content_item_id, social_person_id, platform, media_index, x, y, display_name, handle, status, external_post_id, error_message, published_at";

const INSTAGRAM_USERNAME = /^[A-Za-z0-9._]{1,30}$/;
const LINKEDIN_URN = /^urn:li:(person|organization):[A-Za-z0-9_-]+$/;

/** Accepts "@handle", "handle" or an instagram.com profile URL. */
export function normalizeInstagramUsername(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Instagram username must be text.");
  let username = value.trim();
  if (!username) return null;
  const fromUrl = username.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (fromUrl) username = fromUrl[1];
  username = username.replace(/^@/, "");
  if (!INSTAGRAM_USERNAME.test(username)) throw new Error("Instagram usernames use only letters, numbers, full stops and underscores (max 30).");
  return username.toLowerCase();
}

/**
 * Accepts a full URN, a numeric company ID, or a company admin URL that
 * contains the numeric ID (linkedin.com/company/12345/admin). Person URNs only
 * come from the person connecting their LinkedIn account, never from a URL.
 */
export function normalizeLinkedInUrn(value: unknown, kind: SocialPerson["kind"]): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("LinkedIn ID must be text.");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (LINKEDIN_URN.test(trimmed)) return trimmed;
  const numeric = trimmed.match(/^(\d+)$/) ?? trimmed.match(/linkedin\.com\/company\/(\d+)/i);
  if (numeric && kind === "organization") return `urn:li:organization:${numeric[1]}`;
  throw new Error(kind === "organization"
    ? "Use the company's numeric LinkedIn ID (it appears in the Page admin URL) or look the company up by its page URL."
    : "A person's LinkedIn ID can only be added by them connecting their LinkedIn account.");
}

/** Extracts a company vanity name from "acme" or "linkedin.com/company/acme". */
export function linkedInVanityName(value: string) {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/linkedin\.com\/company\/([^/?#\s]+)/i);
  const vanity = (fromUrl ? fromUrl[1] : trimmed).replace(/\/$/, "");
  return /^[A-Za-z0-9_-]{1,100}$/.test(vanity) ? vanity : null;
}

// ── Caption rendering ────────────────────────────────────────────────────────
//
// Captions are shared across platforms, so mentions are written as @[Name]
// and resolved per platform at publish time.

const MENTION_TOKEN = /@\[([^\]\n]{1,120})\]/g;

export function mentionToken(person: Pick<SocialPerson, "display_name">) {
  return `@[${person.display_name}]`;
}

function peopleByName(people: SocialPerson[]) {
  const map = new Map<string, SocialPerson>();
  for (const person of people) map.set(person.display_name.trim().toLowerCase(), person);
  return map;
}

/** Display names referenced by @[Name] tokens in a caption. */
export function mentionedNames(caption: string) {
  return Array.from(caption.matchAll(MENTION_TOKEN), (match) => match[1].trim());
}

/**
 * LinkedIn's "little text format" treats these characters as markup. Left
 * unescaped they can truncate a post (e.g. at a bracket), so escape them.
 * Hashtags written as #word are left alone, matching how captions behaved
 * before mentions were supported.
 */
export function escapeLinkedInText(text: string) {
  return text.replace(/[|{}@[\]()<>\\*_~]|#(?![\p{L}\p{N}_])/gu, (char) => `\\${char}`);
}

function linkedInMention(person: SocialPerson) {
  const name = (person.linkedin_name || person.display_name).trim();
  return `@[${escapeLinkedInText(name)}](${person.linkedin_urn})`;
}

export function renderCaptionForPlatform(
  caption: string,
  platform: string,
  directory: SocialPerson[],
  linkedInTagged: SocialPerson[] = [],
) {
  const byName = peopleByName(directory);
  const mentionedLinkedIn = new Set<string>();

  if (platform !== "LinkedIn") {
    return caption.replace(MENTION_TOKEN, (_, rawName: string) => {
      const person = byName.get(rawName.trim().toLowerCase());
      if (platform === "Instagram" && person?.instagram_username) return `@${person.instagram_username}`;
      return person?.display_name ?? rawName.trim();
    });
  }

  let output = "";
  let lastIndex = 0;
  for (const match of caption.matchAll(MENTION_TOKEN)) {
    output += escapeLinkedInText(caption.slice(lastIndex, match.index));
    const person = byName.get(match[1].trim().toLowerCase());
    if (person?.linkedin_urn) {
      output += linkedInMention(person);
      mentionedLinkedIn.add(person.id);
    } else {
      output += escapeLinkedInText(person?.display_name ?? match[1].trim());
    }
    lastIndex = (match.index ?? 0) + match[0].length;
  }
  output += escapeLinkedInText(caption.slice(lastIndex));

  // Every person tagged for LinkedIn must appear in the text, because a
  // LinkedIn mention only exists inside the post commentary.
  const missing = linkedInTagged.filter((person) => person.linkedin_urn && !mentionedLinkedIn.has(person.id));
  if (missing.length) output += `\n\n${missing.map(linkedInMention).join(" ")}`;
  return output;
}

// ── Loading tags for publishing ──────────────────────────────────────────────

export function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}

export type TaggingContext = {
  directory: SocialPerson[];
  tags: ContentTag[];
  peopleById: Map<string, SocialPerson>;
};

export async function loadTaggingContext(admin: SupabaseClient, contentId: string, caption: string): Promise<TaggingContext> {
  const { data: tags, error: tagError } = await admin.from("content_tags")
    .select(CONTENT_TAG_FIELDS)
    .eq("content_item_id", contentId);
  // Publishing must keep working before the tagging migration has been run.
  if (tagError && isMissingTableError(tagError)) return { directory: [], tags: [], peopleById: new Map() };
  if (tagError) throw new Error(tagError.message);

  const tagPersonIds = (tags ?? []).map((tag) => tag.social_person_id).filter((id): id is string => Boolean(id));
  const names = mentionedNames(caption);
  if (!tagPersonIds.length && !names.length) return { directory: [], tags: (tags ?? []) as ContentTag[], peopleById: new Map() };

  // The directory is small and admin-curated; loading it whole keeps name
  // matching case-insensitive without a fragile SQL filter.
  const { data: people, error: peopleError } = await admin.from("social_people").select(SOCIAL_PERSON_FIELDS);
  if (peopleError) throw new Error(peopleError.message);
  const directory = (people ?? []) as SocialPerson[];
  return { directory, tags: (tags ?? []) as ContentTag[], peopleById: new Map(directory.map((person) => [person.id, person])) };
}

export async function recordTagOutcome(
  admin: SupabaseClient,
  tags: ContentTag[],
  outcome: { ok: true; externalPostId: string | null } | { ok: false; error: string },
  handles: Map<string, string | null>,
) {
  const now = new Date().toISOString();
  await Promise.all(tags.map((tag) => admin.from("content_tags").update(outcome.ok
    ? { status: "published", external_post_id: outcome.externalPostId, error_message: null, published_at: now, handle: handles.get(tag.id) ?? tag.handle }
    : { status: "failed", error_message: outcome.error, handle: handles.get(tag.id) ?? tag.handle },
  ).eq("id", tag.id)));
}
