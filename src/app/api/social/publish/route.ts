import { NextRequest, NextResponse } from "next/server";
import { decryptSocialToken } from "@/lib/social-crypto";
import { getVerifiedAdmin } from "@/lib/social-auth";

export const runtime = "nodejs";

type Connection = {
  id: string;
  platform: "Facebook" | "Instagram" | "LinkedIn";
  account_id: string;
  encrypted_access_token: string;
};

function firstMedia(urls: string[] | null) {
  return urls?.find((url) => /\.(jpe?g|png|webp|gif|mp4|mov|webm)(\?|$)/i.test(url)) ?? null;
}

function mediaType(url: string | null) {
  return url && /\.(mp4|mov|webm)(\?|$)/i.test(url) ? "video" : "image";
}

async function graphRequest(path: string, token: string, fields: Record<string, string>) {
  const body = new URLSearchParams({ ...fields, access_token: token });
  const response = await fetch(`https://graph.facebook.com/v25.0/${path}`, { method: "POST", body });
  const payload = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Meta rejected this post.");
  return payload;
}

async function publishFacebook(connection: Connection, caption: string, mediaUrl: string | null) {
  const token = decryptSocialToken(connection.encrypted_access_token);
  if (!mediaUrl) return graphRequest(`${connection.account_id}/feed`, token, { message: caption });
  if (mediaType(mediaUrl) === "video") throw new Error("Facebook video publishing is not enabled in this first release.");
  return graphRequest(`${connection.account_id}/photos`, token, { url: mediaUrl, caption });
}

async function publishInstagram(connection: Connection, caption: string, mediaUrl: string | null) {
  if (!mediaUrl) throw new Error("Instagram needs an image or video attachment.");
  const token = decryptSocialToken(connection.encrypted_access_token);
  const fields: Record<string, string> = mediaType(mediaUrl) === "video"
    ? { media_type: "REELS", video_url: mediaUrl, caption }
    : { image_url: mediaUrl, caption };
  const container = await graphRequest(`${connection.account_id}/media`, token, fields);
  if (!container.id) throw new Error("Instagram did not create a media container.");
  // Meta processes a new media container asynchronously. A retry from the same Publish
  // button is intentional if it is not ready yet; we never mark the item published early.
  const published = await graphRequest(`${connection.account_id}/media_publish`, token, { creation_id: container.id });
  return published;
}

async function publishLinkedIn(connection: Connection, caption: string, mediaUrl: string | null) {
  if (mediaUrl) throw new Error("LinkedIn image/video publishing will be enabled after its upload flow is connected; text posts can publish now.");
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${decryptSocialToken(connection.encrypted_access_token)}`,
      "Content-Type": "application/json",
      "Linkedin-Version": "202602",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: connection.account_id,
      commentary: caption,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || "LinkedIn rejected this post.");
  }
  return { id: response.headers.get("x-restli-id") ?? undefined };
}

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { contentId } = await request.json();
  if (!contentId) return NextResponse.json({ error: "contentId required" }, { status: 400 });

  const { data: content, error: contentError } = await auth.admin
    .from("content_items").select("id, project_id, title, description, platforms, status, file_urls").eq("id", contentId).single();
  if (contentError || !content) return NextResponse.json({ error: "Content item not found" }, { status: 404 });
  if (content.status !== "approved") return NextResponse.json({ error: "Only client-approved content can be published." }, { status: 409 });

  const supportedPlatforms = (content.platforms as string[]).filter((platform) => ["Facebook", "Instagram", "LinkedIn"].includes(platform));
  if (!supportedPlatforms.length) return NextResponse.json({ error: "Select Instagram, Facebook, or LinkedIn before publishing." }, { status: 400 });
  const { data: connections, error: connectionsError } = await auth.admin
    .from("social_connections")
    .select("id, platform, account_id, encrypted_access_token")
    .eq("project_id", content.project_id)
    .in("platform", supportedPlatforms);
  if (connectionsError) return NextResponse.json({ error: connectionsError.message }, { status: 500 });

  const caption = content.description?.trim() || content.title;
  const attachment = firstMedia(content.file_urls as string[] | null);
  const results: Array<{ platform: string; accountId: string | null; ok: boolean; error: string | null }> = await Promise.all((connections ?? []).map(async (connection) => {
    const item = connection as Connection;
    let outcome: { id?: string } | undefined;
    let errorMessage: string | null = null;
    try {
      if (item.platform === "Facebook") outcome = await publishFacebook(item, caption, attachment);
      if (item.platform === "Instagram") outcome = await publishInstagram(item, caption, attachment);
      if (item.platform === "LinkedIn") outcome = await publishLinkedIn(item, caption, attachment);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Publishing failed.";
    }
    await auth.admin.from("social_publish_attempts").insert({
      content_item_id: content.id, social_connection_id: item.id, platform: item.platform,
      status: errorMessage ? "failed" : "published", external_post_id: outcome?.id ?? null,
      external_post_url: null, error_message: errorMessage, created_by: auth.user.id,
    });
    return { platform: item.platform, accountId: item.account_id, ok: !errorMessage, error: errorMessage };
  }));

  const missing = supportedPlatforms.filter((platform) => !(connections ?? []).some((connection) => connection.platform === platform));
  for (const platform of missing) {
    results.push({ platform, accountId: null, ok: false, error: "No connected account for this platform." });
  }
  if (results.length > 0 && results.every((result) => result.ok)) {
    await auth.admin.from("content_items").update({ status: "published" }).eq("id", content.id);
  }
  return NextResponse.json({ results, published: results.length > 0 && results.every((result) => result.ok) });
}
