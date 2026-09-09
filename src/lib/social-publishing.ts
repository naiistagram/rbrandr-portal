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

export type NativeScheduleResult = {
  scheduled: boolean;
  message?: string;
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

async function graphDelete(path: string, token: string) {
  const response = await fetch(`https://graph.facebook.com/v25.0/${path}?access_token=${encodeURIComponent(token)}`, { method: "DELETE" });
  const payload = await response.json().catch(() => ({})) as { success?: boolean; error?: { message?: string } };
  if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Meta could not cancel the scheduled post.");
}

async function publishFacebook(connection: Connection, caption: string, mediaUrl: string | null) {
  const token = decryptSocialToken(connection.encrypted_access_token);
  if (!mediaUrl) return graphRequest(`${connection.account_id}/feed`, token, { message: caption });
  if (mediaType(mediaUrl) === "video") throw new Error("Facebook video publishing is not enabled in this first release.");
  return graphRequest(`${connection.account_id}/photos`, token, { url: mediaUrl, caption });
}

/**
 * Facebook Pages support a real scheduled-post API. Instagram does not: its
 * media containers expire, so Instagram remains in RBRANDR's timed queue.
 */
export async function scheduleFacebookInMeta(
  admin: SupabaseClient,
  content: PublishableContent,
  createdBy: string,
  publishAt: Date,
): Promise<NativeScheduleResult> {
  if (!content.platforms.includes("Facebook")) return { scheduled: false };

  const millisecondsUntilPublish = publishAt.getTime() - Date.now();
  if (millisecondsUntilPublish < 10 * 60 * 1000) {
    return { scheduled: false, message: "Facebook needs at least 10 minutes' notice for a Meta Planner schedule; RBRANDR will publish it at the chosen time instead." };
  }

  const { data: connection, error } = await admin
    .from("social_connections")
    .select("id, platform, account_id, encrypted_access_token")
    .eq("project_id", content.project_id)
    .eq("platform", "Facebook")
    .maybeSingle();
  if (error) return { scheduled: false, message: error.message };
  if (!connection) return { scheduled: false, message: "No Facebook account is connected." };

  const caption = content.description?.trim() ?? "";
  if (!caption) return { scheduled: false, message: "Add a caption or notes before scheduling this content in Meta." };
  const attachment = firstMedia(content.file_urls);
  if (attachment && mediaType(attachment) === "video") {
    return { scheduled: false, message: "Facebook video scheduling will remain in RBRANDR's timed queue for now." };
  }

  try {
    const fields: Record<string, string> = attachment
      ? { url: attachment, caption, published: "false", scheduled_publish_time: String(Math.floor(publishAt.getTime() / 1000)), unpublished_content_type: "SCHEDULED" }
      : { message: caption, published: "false", scheduled_publish_time: String(Math.floor(publishAt.getTime() / 1000)) };
    const path = attachment ? `${connection.account_id}/photos` : `${connection.account_id}/feed`;
    const outcome = await graphRequest(path, decryptSocialToken(connection.encrypted_access_token), fields);
    if (!outcome.id) throw new Error("Meta did not return a scheduled-post ID.");
    const { error: attemptError } = await admin.from("social_publish_attempts").insert({
      content_item_id: content.id,
      social_connection_id: connection.id,
      platform: "Facebook",
      status: "pending",
      external_post_id: outcome.id,
      external_post_url: null,
      error_message: null,
      created_by: createdBy,
    });
    if (attemptError) throw new Error(attemptError.message);
    return { scheduled: true };
  } catch (scheduleError) {
    return { scheduled: false, message: scheduleError instanceof Error ? scheduleError.message : "Meta could not schedule the Facebook post." };
  }
}

export async function cancelPendingFacebookSchedules(admin: SupabaseClient, contentId: string) {
  const { data: attempts, error } = await admin
    .from("social_publish_attempts")
    .select("id, social_connection_id, external_post_id")
    .eq("content_item_id", contentId)
    .eq("platform", "Facebook")
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  for (const attempt of attempts ?? []) {
    if (!attempt.social_connection_id || !attempt.external_post_id) continue;
    const { data: connection, error: connectionError } = await admin
      .from("social_connections")
      .select("encrypted_access_token")
      .eq("id", attempt.social_connection_id)
      .maybeSingle();
    if (connectionError || !connection) throw new Error("The Facebook connection used for this scheduled post is no longer available.");
    await graphDelete(attempt.external_post_id, decryptSocialToken(connection.encrypted_access_token));
    const { error: updateError } = await admin.from("social_publish_attempts")
      .update({ status: "failed", error_message: "Cancelled before publishing." })
      .eq("id", attempt.id);
    if (updateError) throw new Error(updateError.message);
  }
}

export async function hasPendingFacebookSchedule(admin: SupabaseClient, contentId: string) {
  const { data, error } = await admin.from("social_publish_attempts")
    .select("id")
    .eq("content_item_id", contentId)
    .eq("platform", "Facebook")
    .eq("status", "pending")
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

export async function markPendingFacebookSchedulePublished(admin: SupabaseClient, contentId: string) {
  const { error } = await admin.from("social_publish_attempts")
    .update({ status: "published", error_message: null })
    .eq("content_item_id", contentId)
    .eq("platform", "Facebook")
    .eq("status", "pending");
  if (error) throw new Error(error.message);
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
  alreadyScheduledPlatforms: string[] = [],
) {
  const selectedSupportedPlatforms = content.platforms.filter((platform) => ["Facebook", "Instagram", "LinkedIn"].includes(platform));
  if (!selectedSupportedPlatforms.length) throw new Error("Select Instagram, Facebook, or LinkedIn before publishing.");
  const supportedPlatforms = selectedSupportedPlatforms.filter((platform) => !alreadyScheduledPlatforms.includes(platform));

  let connections: Connection[] = [];
  if (supportedPlatforms.length) {
    const { data, error } = await admin
      .from("social_connections")
      .select("id, platform, account_id, encrypted_access_token")
      .eq("project_id", content.project_id)
      .in("platform", supportedPlatforms);
    if (error) throw new Error(error.message);
    connections = (data ?? []) as Connection[];
  }

  // Titles are internal labels for the content calendar. Social platforms must
  // receive the caption/notes the admin wrote — never the internal title.
  const caption = content.description?.trim() ?? "";
  if (!caption) throw new Error("Add a caption or notes before publishing this content.");
  const attachment = firstMedia(content.file_urls);
  const results: PublishResult[] = [
    ...alreadyScheduledPlatforms.map((platform) => ({ platform, accountId: null, ok: true, error: null })),
    ...await Promise.all(connections.map(async (item) => {
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
    })),
  ];

  const missing = supportedPlatforms.filter((platform) => !connections.some((connection) => connection.platform === platform));
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
