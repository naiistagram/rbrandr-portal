import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmFacebookSchedulePublished, finalizeMetaFacebookPublication } from "@/lib/social-publishing";

export const runtime = "nodejs";

type FeedValue = {
  post_id?: string;
  verb?: string;
  item?: string;
  published?: boolean | number | string;
  from?: { id?: string };
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: FeedValue }>;
  }>;
};

function validSignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const received = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}

function isPublishedPagePost(value: FeedValue, pageId?: string) {
  if (!value.post_id || value.verb !== "add" || value.from?.id !== pageId) return false;
  // Feed webhooks use `status` for text posts and `photo`/`video` for media.
  if (!["status", "photo", "video"].includes(value.item ?? "")) return false;
  return value.published !== false && value.published !== 0 && value.published !== "0" && value.published !== "false";
}

/** Meta's webhook verification handshake. Configure this exact URL in Meta. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (
    verifyToken
    && params.get("hub.mode") === "subscribe"
    && params.get("hub.verify_token") === verifyToken
  ) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** Receives Page feed notifications after Meta has actually published a post. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (payload.object !== "page") return NextResponse.json({ received: true });

  const postIds = new Set<string>();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === "feed" && isPublishedPagePost(change.value ?? {}, entry.id)) {
        const postId = change.value?.post_id;
        if (postId) postIds.add(postId);
      }
    }
  }

  const admin = createAdminClient();
  const contentIds = new Set<string>();
  for (const postId of postIds) {
    for (const contentId of await confirmFacebookSchedulePublished(admin, postId)) contentIds.add(contentId);
  }
  await Promise.all([...contentIds].map((contentId) => finalizeMetaFacebookPublication(admin, contentId)));

  return NextResponse.json({ received: true });
}
