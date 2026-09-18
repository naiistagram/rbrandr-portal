import { decryptSocialToken } from "@/lib/social-crypto";
export { analyticsMetricLabels } from "@/lib/social-analytics-labels";

const GRAPH_API_VERSION = "v25.0";
const MAX_LOOKBACK_DAYS = 90;

export type MetaConnection = {
  id: string;
  project_id: string;
  provider: "meta";
  platform: "Facebook" | "Instagram";
  account_id: string;
  encrypted_access_token: string;
};

type InsightValue = { value?: number | string | Record<string, unknown>; end_time?: string };
type Insight = { name?: string; values?: InsightValue[]; total_value?: InsightValue };
type GraphResponse = { data?: Insight[]; error?: { message?: string } };
type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

type FacebookPost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  attachments?: { data?: Array<{
    media_type?: string;
    media?: { image?: { src?: string }; source?: string };
    subattachments?: { data?: unknown[] };
  }> };
};

type ContentMetricRow = {
  project_id: string; social_connection_id: string; provider: "meta"; platform: "Facebook" | "Instagram"; account_id: string;
  external_post_id: string; content_type: string; title: string; permalink: string | null; thumbnail_url: string | null;
  published_at: string; views: number; reach: number; interactions: number; collected_at: string;
};

type MetricRequest = {
  sourceMetric: string;
  metric: string;
  metricType?: "time_series" | "total_value";
};

// Meta replaced several account-level Instagram metrics in 2025. Views and
// interactions must now be requested as aggregate totals, while reach remains
// available as a daily time series.
const METRICS: Record<MetaConnection["platform"], MetricRequest[]> = {
  Instagram: [
    { sourceMetric: "views", metric: "views", metricType: "total_value" },
    { sourceMetric: "reach", metric: "reach", metricType: "time_series" },
    { sourceMetric: "total_interactions", metric: "interactions", metricType: "total_value" },
    { sourceMetric: "accounts_engaged", metric: "engaged_accounts", metricType: "total_value" },
    { sourceMetric: "profile_links_taps", metric: "link_clicks", metricType: "total_value" },
  ],
  Facebook: [
    { sourceMetric: "page_media_view", metric: "views" },
    { sourceMetric: "page_total_media_view_unique", metric: "reach" },
    { sourceMetric: "page_post_engagements", metric: "interactions" },
    { sourceMetric: "page_follows", metric: "follows" },
  ],
} as const;

function isoDate(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function numericValue(value: InsightValue["value"]) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function instagramContentType(media: InstagramMedia) {
  if (media.media_product_type === "REELS" || media.media_type === "VIDEO") return "reel";
  if (media.media_type === "CAROUSEL_ALBUM") return "carousel";
  return "post";
}

function shortCaption(caption: string | undefined) {
  const firstLine = caption?.split("\n").find(Boolean)?.trim() ?? "Instagram post";
  return firstLine.length > 84 ? `${firstLine.slice(0, 81)}…` : firstLine;
}

function facebookContentType(post: FacebookPost) {
  const attachment = post.attachments?.data?.[0];
  if (attachment?.subattachments?.data && attachment.subattachments.data.length > 1) return "carousel";
  if (attachment?.media_type?.includes("video")) return "reel";
  return "post";
}

function shortPostMessage(message: string | undefined) {
  const firstLine = message?.split("\n").find(Boolean)?.trim() ?? "Facebook post";
  return firstLine.length > 84 ? `${firstLine.slice(0, 81)}…` : firstLine;
}

async function fetchContentInsights(postId: string, token: string, metrics: string[]) {
  const values = new Map<string, number>();
  for (const metric of metrics) {
    try {
      const query = new URLSearchParams({ metric, access_token: token });
      const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${postId}/insights?${query}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as GraphResponse;
      if (!response.ok) continue;
      for (const insight of payload.data ?? []) {
        const value = numericValue(insight.values?.[0]?.value ?? insight.total_value?.value);
        if (value !== null && insight.name) values.set(insight.name, value);
      }
    } catch {
      // Insight availability varies by Page and post type. The caller retains
      // the post using engagement fields returned by the Page posts endpoint.
    }
  }
  return values;
}

async function fetchMetric(accountId: string, token: string, request: MetricRequest, since: number, until: number) {
  const query = new URLSearchParams({ metric: request.sourceMetric, period: "day", since: String(since), until: String(until), access_token: token });
  if (request.metricType) query.set("metric_type", request.metricType);
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/insights?${query}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as GraphResponse;
  if (!response.ok) throw new Error(`${request.sourceMetric}: ${payload.error?.message ?? "Meta could not retrieve this metric."}`);
  return payload.data ?? [];
}

async function syncInstagramContent(connection: MetaConnection, token: string, since: Date) {
  const query = new URLSearchParams({
    fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: "100",
    access_token: token,
  });
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${connection.account_id}/media?${query}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as { data?: InstagramMedia[]; error?: { message?: string } };
  if (!response.ok) throw new Error(`content: ${payload.error?.message ?? "Meta could not retrieve Instagram posts."}`);

  const rows: ContentMetricRow[] = [];
  for (const media of payload.data ?? []) {
    const publishedAt = media.timestamp ? new Date(media.timestamp) : null;
    if (!publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt < since) continue;
    const values = await fetchContentInsights(media.id, token, ["views", "reach", "total_interactions"]);
    const interactions = values.get("total_interactions") ?? ((media.like_count ?? 0) + (media.comments_count ?? 0));
    rows.push({
      project_id: connection.project_id,
      social_connection_id: connection.id,
      provider: "meta",
      platform: "Instagram",
      account_id: connection.account_id,
      external_post_id: media.id,
      content_type: instagramContentType(media),
      title: shortCaption(media.caption),
      permalink: media.permalink ?? null,
      thumbnail_url: media.thumbnail_url ?? media.media_url ?? null,
      published_at: publishedAt.toISOString(),
      views: values.get("views") ?? 0,
      reach: values.get("reach") ?? 0,
      interactions,
      collected_at: new Date().toISOString(),
    });
  }
  return rows;
}

async function syncFacebookContent(connection: MetaConnection, token: string, since: Date) {
  const query = new URLSearchParams({
    fields: "id,message,created_time,permalink_url,full_picture,shares,reactions.limit(0).summary(true),comments.limit(0).summary(true),attachments{media_type,media,subattachments}",
    limit: "100",
    access_token: token,
  });
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${connection.account_id}/posts?${query}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as { data?: FacebookPost[]; error?: { message?: string } };
  if (!response.ok) throw new Error(`content: ${payload.error?.message ?? "Meta could not retrieve Facebook posts."}`);

  const rows: ContentMetricRow[] = [];
  for (const post of payload.data ?? []) {
    const publishedAt = post.created_time ? new Date(post.created_time) : null;
    if (!publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt < since) continue;
    const values = await fetchContentInsights(post.id, token, ["post_impressions", "post_impressions_unique", "post_engaged_users"]);
    const interactions = values.get("post_engaged_users")
      ?? (post.reactions?.summary?.total_count ?? 0) + (post.comments?.summary?.total_count ?? 0) + (post.shares?.count ?? 0);
    const attachment = post.attachments?.data?.[0];
    rows.push({
      project_id: connection.project_id,
      social_connection_id: connection.id,
      provider: "meta",
      platform: "Facebook",
      account_id: connection.account_id,
      external_post_id: post.id,
      content_type: facebookContentType(post),
      title: shortPostMessage(post.message),
      permalink: post.permalink_url ?? null,
      thumbnail_url: post.full_picture ?? attachment?.media?.image?.src ?? null,
      published_at: publishedAt.toISOString(),
      views: values.get("post_impressions") ?? 0,
      reach: values.get("post_impressions_unique") ?? 0,
      interactions,
      collected_at: new Date().toISOString(),
    });
  }
  return rows;
}

export async function syncMetaConnection(connection: MetaConnection, requestedDays = 30) {
  const days = Math.min(Math.max(Math.round(requestedDays), 1), MAX_LOOKBACK_DAYS);
  const end = new Date();
  const start = new Date(end);
  // Meta accepts a maximum 30 × 24 hour window. Starting at midnight exactly
  // 30 calendar days ago would exceed that once today's partial day is added.
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);
  const token = decryptSocialToken(connection.encrypted_access_token);
  const rows: Array<{ project_id: string; social_connection_id: string; provider: "meta"; platform: "Facebook" | "Instagram"; account_id: string; metric: string; metric_date: string; value: number; collected_at: string }> = [];
  const errors: string[] = [];
  let contentRows: ContentMetricRow[] = [];

  // Metrics are fetched separately. Meta can make a metric unavailable for an
  // account type without preventing the rest of the dashboard from updating.
  for (const metricRequest of METRICS[connection.platform]) {
    try {
      const insights = await fetchMetric(connection.account_id, token, metricRequest, Math.floor(start.getTime() / 1000), Math.floor(end.getTime() / 1000));
      for (const insight of insights) {
        const metric = metricRequest.metric;
        let wrotePoint = false;
        for (const point of insight.values ?? []) {
          const date = isoDate(point.end_time);
          const value = numericValue(point.value);
          if (!date || value === null) continue;
          rows.push({
            project_id: connection.project_id,
            social_connection_id: connection.id,
            provider: "meta",
            platform: connection.platform,
            account_id: connection.account_id,
            metric,
            metric_date: date,
            value,
            collected_at: new Date().toISOString(),
          });
          wrotePoint = true;
        }
        // total_value responses are interval totals and do not have a daily
        // timestamp. Store one snapshot for the selected interval so the KPI
        // can still accurately report the current reporting window.
        const total = numericValue(insight.total_value?.value);
        if (!wrotePoint && total !== null) {
          rows.push({
            project_id: connection.project_id,
            social_connection_id: connection.id,
            provider: "meta",
            platform: connection.platform,
            account_id: connection.account_id,
            metric,
            metric_date: isoDate(end.toISOString())!,
            value: total,
            collected_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Unable to retrieve ${metricRequest.sourceMetric}.`);
    }
  }

  if (connection.platform === "Instagram") {
    try {
      contentRows = await syncInstagramContent(connection, token, start);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unable to retrieve Instagram content performance.");
    }
  }
  if (connection.platform === "Facebook") {
    try {
      contentRows = await syncFacebookContent(connection, token, start);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unable to retrieve Facebook content performance.");
    }
  }

  return { rows, contentRows, errors };
}
