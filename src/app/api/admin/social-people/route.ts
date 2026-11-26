import { NextRequest, NextResponse } from "next/server";
import { getVerifiedAdmin } from "@/lib/social-auth";
import { decryptSocialToken } from "@/lib/social-crypto";
import {
  isMissingTableError,
  linkedInVanityName,
  normalizeInstagramUsername,
  normalizeLinkedInUrn,
  SOCIAL_PERSON_FIELDS,
  type SocialPerson,
} from "@/lib/social-tagging";

export const runtime = "nodejs";

const MIGRATION_MESSAGE = "Run supabase-social-tagging-migration.sql in Supabase before using tagging.";

function errorResponse(error: { message: string; code?: string }, status = 500) {
  if (isMissingTableError(error)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
  if (error.code === "23505") return NextResponse.json({ error: "That portal user is already linked to another person." }, { status: 409 });
  return NextResponse.json({ error: error.message }, { status });
}

function readPersonFields(body: Record<string, unknown>, existingKind?: SocialPerson["kind"]) {
  const updates: Record<string, unknown> = {};
  const kind = body.kind === undefined ? existingKind ?? "person" : body.kind;
  if (kind !== "person" && kind !== "organization") throw new Error("Choose person or company.");
  if (body.kind !== undefined) updates.kind = kind;
  if (body.display_name !== undefined) {
    if (typeof body.display_name !== "string" || !body.display_name.trim() || body.display_name.trim().length > 120) throw new Error("Name is required (max 120 characters).");
    if (/[[\]\n]/.test(body.display_name)) throw new Error("Names cannot contain square brackets or line breaks.");
    updates.display_name = body.display_name.trim();
  }
  const instagram = normalizeInstagramUsername(body.instagram_username);
  if (instagram !== undefined) updates.instagram_username = instagram;
  const linkedInUrn = normalizeLinkedInUrn(body.linkedin_urn, kind);
  // A person URN is only trustworthy when it came from that person's own
  // LinkedIn sign-in, so admins may clear it but never type one in.
  if (linkedInUrn?.startsWith("urn:li:person:")) throw new Error("A person's LinkedIn ID is added when they connect LinkedIn from their portal settings.");
  if (linkedInUrn !== undefined) updates.linkedin_urn = linkedInUrn;
  if (body.linkedin_name !== undefined) {
    if (body.linkedin_name !== null && typeof body.linkedin_name !== "string") throw new Error("LinkedIn name must be text.");
    updates.linkedin_name = typeof body.linkedin_name === "string" && body.linkedin_name.trim() ? body.linkedin_name.trim().slice(0, 200) : null;
  }
  if (body.profile_id !== undefined) {
    if (body.profile_id !== null && typeof body.profile_id !== "string") throw new Error("Invalid portal user.");
    updates.profile_id = body.profile_id || null;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") throw new Error("Notes must be text.");
    updates.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;
  }
  return updates;
}

// GET /api/admin/social-people — directory, tag history and portal users to link.
export async function GET(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // The content editor only needs the directory itself.
  if (request.nextUrl.searchParams.get("view") === "directory") {
    const { data, error } = await auth.admin.from("social_people").select(SOCIAL_PERSON_FIELDS).order("display_name");
    if (error) return errorResponse(error);
    return NextResponse.json({ people: data ?? [] });
  }

  const [{ data: people, error: peopleError }, { data: tags, error: tagsError }, { data: profiles }] = await Promise.all([
    auth.admin.from("social_people").select(SOCIAL_PERSON_FIELDS).order("display_name"),
    auth.admin.from("content_tags")
      .select("id, content_item_id, social_person_id, platform, display_name, handle, status, error_message, published_at, created_at, content_items(title, scheduled_date, project_id, projects(name, client_id))")
      .order("created_at", { ascending: false })
      .limit(1000),
    auth.admin.from("profiles").select("id, full_name, company_name, email").order("full_name"),
  ]);
  if (peopleError) return errorResponse(peopleError);
  if (tagsError) return errorResponse(tagsError);

  const history = (tags ?? []).map((tag) => {
    const item = Array.isArray(tag.content_items) ? tag.content_items[0] : tag.content_items;
    const project = item && (Array.isArray(item.projects) ? item.projects[0] : item.projects);
    return {
      id: tag.id,
      content_item_id: tag.content_item_id,
      social_person_id: tag.social_person_id,
      platform: tag.platform,
      display_name: tag.display_name,
      handle: tag.handle,
      status: tag.status,
      error_message: tag.error_message,
      published_at: tag.published_at,
      created_at: tag.created_at,
      content_title: item?.title ?? "Deleted content",
      scheduled_date: item?.scheduled_date ?? null,
      project_name: project?.name ?? null,
      client_id: project?.client_id ?? null,
    };
  });

  return NextResponse.json({ people: people ?? [], history, profiles: profiles ?? [] });
}

// POST /api/admin/social-people — create a person, or look up a LinkedIn company.
export async function POST(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  if (body.action === "lookup_linkedin_org") {
    const vanity = typeof body.value === "string" ? linkedInVanityName(body.value) : null;
    if (!vanity) return NextResponse.json({ error: "Paste the company's LinkedIn page URL, e.g. linkedin.com/company/acme." }, { status: 400 });
    // Any connected LinkedIn Company Page token can look up public company details.
    const { data: connection } = await auth.admin.from("social_connections")
      .select("encrypted_access_token")
      .eq("platform", "LinkedIn")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!connection) return NextResponse.json({ error: "Connect a LinkedIn Company Page for any client first, or paste the company's numeric ID instead." }, { status: 400 });
    const response = await fetch(`https://api.linkedin.com/rest/organizations?q=vanityName&vanityName=${encodeURIComponent(vanity)}`, {
      headers: {
        Authorization: `Bearer ${decryptSocialToken(connection.encrypted_access_token)}`,
        "Linkedin-Version": "202602",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "LinkedIn would not look up this company with the current connection. Paste the company's numeric ID instead (it appears in the Page admin URL)." }, { status: 502 });
    }
    const payload = await response.json() as { elements?: Array<{ id?: number | string; localizedName?: string; vanityName?: string }> };
    const organization = payload.elements?.[0];
    if (!organization?.id) return NextResponse.json({ error: "No LinkedIn company was found at that address." }, { status: 404 });
    return NextResponse.json({ organization: { urn: `urn:li:organization:${organization.id}`, name: organization.localizedName ?? vanity } });
  }

  let fields: Record<string, unknown>;
  try {
    fields = readPersonFields(body);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  if (!fields.display_name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const { data, error } = await auth.admin.from("social_people")
    .insert({ ...fields, created_by: auth.user.id })
    .select(SOCIAL_PERSON_FIELDS)
    .single();
  if (error) return errorResponse(error);
  return NextResponse.json({ person: data });
}

// PATCH /api/admin/social-people — update a person's handles.
export async function PATCH(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (typeof body.id !== "string") return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: existing, error: lookupError } = await auth.admin.from("social_people").select("kind").eq("id", body.id).maybeSingle();
  if (lookupError) return errorResponse(lookupError);
  if (!existing) return NextResponse.json({ error: "Person not found." }, { status: 404 });

  let fields: Record<string, unknown>;
  try {
    fields = readPersonFields(body, existing.kind as SocialPerson["kind"]);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  // Switching between person and company invalidates the saved LinkedIn ID.
  if (fields.kind !== undefined && fields.kind !== existing.kind) fields.linkedin_urn = fields.linkedin_urn ?? null;

  const { data, error } = await auth.admin.from("social_people")
    .update(fields)
    .eq("id", body.id)
    .select(SOCIAL_PERSON_FIELDS)
    .single();
  if (error) return errorResponse(error);
  return NextResponse.json({ person: data });
}

// DELETE /api/admin/social-people?id= — remove from the directory; tag history is kept.
export async function DELETE(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await auth.admin.from("social_people").delete().eq("id", id);
  if (error) return errorResponse(error);
  return NextResponse.json({ ok: true });
}
