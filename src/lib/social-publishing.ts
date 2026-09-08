import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSocialToken } from "@/lib/social-crypto";

type Connection = {
  id: string;
  platform: "Facebook" | "Instagram" | "LinkedIn";
  account_id: string;
  encrypted_access_token: string;
};

type PublishableContent = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  platforms: string[];
  file_urls: string[] | null;
};

export type PublishResult = {
  platform: string;
  accountId: string | null;
  ok: boolean;
  error: string | null;
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
  return graphRequest(`${connection.account_id}/media_publish`, token, { creation_id: container.id });
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
  if (!response.ok) throw new Error(await response.text() || "LinkedIn rejected this post.");
  return { id: response.headers.get("x-restli-id") ?? undefined };
}

export async function publishContent(
  admin: SupabaseClient,
  content: PublishableContent,
  createdBy: string | null,
) {
  const supportedPlatforms = content.platforms.filter((platform) => ["Facebook", "Instagram", "LinkedIn"].includes(platform));
  if (!supportedPlatforms.length) throw new Error("Select Instagram, Facebook, or LinkedIn before publishing.");

  const { data: connections, error } = await admin
    .from("social_connections")
    .select("id, platform, account_id, encrypted_access_token")
    .eq("project_id", content.project_id)
    .in("platform", supportedPlatforms);
  if (error) throw new Error(error.message);

  // Titles are internal labels for the content calendar. Social platforms must
  // receive the caption/notes the admin wrote — never the internal title.
  const caption = content.description?.trim() ?? "";
  if (!caption) throw new Error("Add a caption or notes before publishing this content.");
  const attachment = firstMedia(content.file_urls);
  const results: PublishResult[] = await Promise.all((connections ?? []).map(async (connection) => {
    const item = connection as Connection;
    let outcome: { id?: string } | undefined;
    let errorMessage: string | null = null;
    try {
      if (item.platform === "Facebook") outcome = await publishFacebook(item, caption, attachment);
      if (item.platform === "Instagram") outcome = await publishInstagram(item, caption, attachment);
      if (item.platform === "LinkedIn") outcome = await publishLinkedIn(item, caption, attachment);
    } catch (publishError) {
      errorMessage = publishError instanceof Error ? publishError.message : "Publishing failed.";
    }
    await admin.from("social_publish_attempts").insert({
      content_item_id: content.id, social_connection_id: item.id, platform: item.platform,
      status: errorMessage ? "failed" : "published", external_post_id: outcome?.id ?? null,
      external_post_url: null, error_message: errorMessage, created_by: createdBy,
    });
    return { platform: item.platform, accountId: item.account_id, ok: !errorMessage, error: errorMessage };
  }));

  const missing = supportedPlatforms.filter((platform) => !(connections ?? []).some((connection) => connection.platform === platform));
  for (const platform of missing) results.push({ platform, accountId: null, ok: false, error: "No connected account for this platform." });

  const published = results.length > 0 && results.every((result) => result.ok);
  const publishError = published ? null : results.filter((result) => !result.ok).map((result) => `${result.platform}: ${result.error}`).join(" ");
  await admin.from("content_items").update({
    status: published ? "published" : "approved",
    publish_at: null,
    publish_started_at: null,
    publish_error: publishError,
  }).eq("id", content.id);

  return { results, published };
}
