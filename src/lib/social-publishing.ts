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

type FacebookScheduleState = "none" | "pending" | "published";

type InstagramContainerStatus = "ERROR" | "EXPIRED" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

const INSTAGRAM_CONTAINER_TIMEOUT_MS = 45_000;
const INSTAGRAM_CONTAINER_POLL_INTERVAL_MS = 3_000;

function firstMedia(urls: string[] | null) {
  return urls?.find((url) => /\.(jpe?g|png|webp|gif|mp4|mov|webm)(\?|$)/i.test(url)) ?? null;
}

function mediaType(url: string | null) {
  return url && /\.(mp4|mov|webm)(\?|$)/i.test(url) ? "video" : "image";
}

async function graphRequest(path: string, token: string, fields: Record<string, string>) {
  const body = new URLSearchParams({ ...fields, access_token: token });
  const response = await fetch(`https://graph.facebook.com/v25.0/${path}`, { method: "POST", body });
  const payload = await response.json().catch(() => ({})) as { id?: string; post_id?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Meta rejected this post.");
  return payload;
}

async function graphGet(path: string, token: string, fields: Record<string, string>) {
  const query = new URLSearchParams({ ...fields, access_token: token });
  const response = await fetch(`https://graph.facebook.com/v25.0/${path}?${query}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as { status_code?: InstagramContainerStatus; status?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Meta could not check the Instagram media status.");
  return payload;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForInstagramContainer(containerId: string, token: string) {
  const deadline = Date.now() + INSTAGRAM_CONTAINER_TIMEOUT_MS;
  let lastStatus: InstagramContainerStatus | undefined;

  while (Date.now() < deadline) {
    const container = await graphGet(containerId, token, { fields: "status_code,status" });
    lastStatus = container.status_code;
    if (lastStatus === "FINISHED") return;
    if (lastStatus === "ERROR") throw new Error(container.status || "Instagram could not prepare this media for publishing.");
    if (lastStatus === "EXPIRED") throw new Error("Instagram's media container expired before it could be published.");
    if (lastStatus === "PUBLISHED") throw new Error("Instagram reported this media container as already published.");
    await wait(Math.min(INSTAGRAM_CONTAINER_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
  }

  throw new Error(`Instagram is still preparing the media${lastStatus ? ` (${lastStatus.toLowerCase()})` : ""}. Please try again in a moment.`);
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
    const externalPostId = outcome.post_id ?? outcome.id;
    if (!externalPostId) throw new Error("Meta did not return a scheduled-post ID.");
    const { error: attemptError } = await admin.from("social_publish_attempts").insert({
      content_item_id: content.id,
      social_connection_id: connection.id,
      platform: "Facebook",
      status: "pending",
      external_post_id: externalPostId,
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

export async function getFacebookScheduleState(admin: SupabaseClient, contentId: string): Promise<FacebookScheduleState> {
  const { data, error } = await admin.from("social_publish_attempts")
    .select("status")
    .eq("content_item_id", contentId)
    .eq("platform", "Facebook")
    .in("status", ["pending", "published"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (data?.some((attempt) => attempt.status === "pending")) return "pending";
  return data?.some((attempt) => attempt.status === "published") ? "published" : "none";
}

/**
 * Records the exact publication event sent by Meta. This must only be called
 * from a signature-verified Meta webhook; a scheduled time is not proof that
 * Meta actually published the Page post.
 */
export async function confirmFacebookSchedulePublished(admin: SupabaseClient, externalPostId: string) {
  const { data: attempts, error: lookupError } = await admin.from("social_publish_attempts")
    .select("id, content_item_id, external_post_id, status")
    .eq("platform", "Facebook")
    .in("status", ["pending", "published"]);
  if (lookupError) throw new Error(lookupError.message);
  // Page photo webhooks identify the feed post as `PAGE_ID_PHOTO_ID`, while
  // Meta's create-photo response can contain only `PHOTO_ID`.
  const matchingAttempts = (attempts ?? []).filter((attempt) => {
    const scheduledId = attempt.external_post_id;
    return scheduledId && (scheduledId === externalPostId || externalPostId.endsWith(`_${scheduledId}`));
  });
  if (!matchingAttempts.length) return [];

  const pendingAttemptIds = matchingAttempts
    .filter((attempt) => attempt.status === "pending")
    .map((attempt) => attempt.id);
  if (pendingAttemptIds.length) {
    const { error } = await admin.from("social_publish_attempts")
      .update({ status: "published", error_message: null })
      .in("id", pendingAttemptIds);
    if (error) throw new Error(error.message);
  }
  return [...new Set(matchingAttempts.map((attempt) => attempt.content_item_id))];
}

/**
 * A Facebook-only item can become Published directly from the Meta webhook.
 * Multi-network items wait until the timed queue has successfully published
 * every other selected network as well.
 */
export async function finalizeMetaFacebookPublication(admin: SupabaseClient, contentId: string) {
  const { data: content, error: contentError } = await admin.from("content_items")
    .select("id, platforms, status, publish_started_at, publish_error")
    .eq("id", contentId)
    .maybeSingle();
  if (contentError) throw new Error(contentError.message);
  if (!content || content.status !== "approved" || content.publish_error) return false;

  const directPlatforms = (content.platforms as string[])
    .filter((platform) => ["Instagram", "LinkedIn"].includes(platform));

  if (directPlatforms.length) {
    // A webhook can arrive before Vercel's timed queue starts. In that case it
    // confirms Facebook only; the queue will publish the remaining platforms.
    if (!content.publish_started_at) return false;
    const { data: directAttempts, error: attemptsError } = await admin.from("social_publish_attempts")
      .select("platform")
      .eq("content_item_id", contentId)
      .eq("status", "published")
      .gte("created_at", content.publish_started_at);
    if (attemptsError) throw new Error(attemptsError.message);
    const completedPlatforms = new Set((directAttempts ?? []).map((attempt) => attempt.platform));
    if (!directPlatforms.every((platform) => completedPlatforms.has(platform))) return false;
  }

  const { error } = await admin.from("content_items").update({
    status: "published",
    publish_at: null,
    publish_started_at: null,
    publish_error: null,
  }).eq("id", contentId).eq("status", "approved");
  if (error) throw new Error(error.message);
  return true;
}

async function publishInstagram(connection: Connection, caption: string, mediaUrl: string | null) {
  if (!mediaUrl) throw new Error("Instagram needs an image or video attachment.");
  const token = decryptSocialToken(connection.encrypted_access_token);
  const fields: Record<string, string> = mediaType(mediaUrl) === "video"
    ? { media_type: "REELS", video_url: mediaUrl, caption }
    : { image_url: mediaUrl, caption };
  const container = await graphRequest(`${connection.account_id}/media`, token, fields);
  if (!container.id) throw new Error("Instagram did not create a media container.");
  // Meta processes the container asynchronously. Publishing it before it is
  // FINISHED intermittently produces "Media ID is not available", even for
  // valid images that have published successfully before.
  await waitForInstagramContainer(container.id, token);
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
  awaitingPlatformConfirmation: string[] = [],
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

  const allDirectPublishingSucceeded = results.length > 0 && results.every((result) => result.ok);
  const published = allDirectPublishingSucceeded && awaitingPlatformConfirmation.length === 0;
  const publishError = allDirectPublishingSucceeded ? null : results.filter((result) => !result.ok).map((result) => `${result.platform}: ${result.error}`).join(" ");
  const update: Record<string, string | null> = {
    status: published ? "published" : "approved",
    publish_at: null,
    publish_error: publishError,
  };
  // Preserve the queue claim while a Meta-scheduled Facebook post awaits its
  // signed webhook. Clearing it would make it impossible to safely coordinate
  // a multi-platform item if Meta's notification arrives first.
  if (!awaitingPlatformConfirmation.length) update.publish_started_at = null;
  await admin.from("content_items").update(update).eq("id", content.id);

  return { results, published, awaitingPlatformConfirmation: awaitingPlatformConfirmation.length > 0 };
}
