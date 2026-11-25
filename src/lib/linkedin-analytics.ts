import { decryptSocialToken } from "@/lib/social-crypto";

const LINKEDIN_API = "https://api.linkedin.com/rest";
const MAX_LOOKBACK_DAYS = 90;

export type LinkedInConnection = {
  id: string;
  project_id: string;
  provider: "linkedin";
  platform: "LinkedIn";
  account_id: string; // urn:li:organization:{id}
  encrypted_access_token: string;
};

type MetricRow = {
  project_id: string; social_connection_id: string; provider: "linkedin"; platform: "LinkedIn"; account_id: string;
  metric: string; metric_date: string; value: number; collected_at: string;
};
type ContentRow = {
  project_id: string; social_connection_id: string; provider: "linkedin"; platform: "LinkedIn"; account_id: string;
  external_post_id: string; content_type: string; title: string; permalink: string | null; thumbnail_url: string | null;
  published_at: string; views: number; reach: number; interactions: number; collected_at: string;
};

type TimeRange = { start?: number; end?: number };
type ShareStats = {
  impressionCount?: number; uniqueImpressionsCount?: number; clickCount?: number;
  likeCount?: number; commentCount?: number; shareCount?: number;
};
type LinkedInPost = {
  id?: string;
  commentary?: string;
  publishedAt?: number;
  createdAt?: number;
  lifecycleState?: string;
  content?: {
    media?: { id?: string };
    multiImage?: { images?: unknown[] };
    article?: { thumbnail?: string };
  };
};

function headers(token: string, method?: "FINDER") {
  return {
    Authorization: `Bearer ${token}`,
    "Linkedin-Version": "202602",
    "X-Restli-Protocol-Version": "2.0.0",
    ...(method ? { "X-RestLi-Method": method } : {}),
  };
}

async function get<T>(url: string, token: string, method?: "FINDER") {
  const response = await fetch(url, { headers: headers(token, method), cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? `LinkedIn returned ${response.status}.`);
  return payload;
}

// Rest.li query syntax: the parentheses and colons must reach LinkedIn
// unescaped, while URNs inside them are percent-encoded.
function dailyIntervals(start: Date, end: Date) {
  return `(timeRange:(start:${start.getTime()},end:${end.getTime()}),timeGranularityType:DAY)`;
}

function day(ms: number | undefined) {
  return ms ? new Date(ms).toISOString().slice(0, 10) : null;
}

function interactionsOf(stats: ShareStats) {
  return (stats.likeCount ?? 0) + (stats.commentCount ?? 0) + (stats.shareCount ?? 0) + (stats.clickCount ?? 0);
}

function shortCommentary(text: string | undefined) {
  // Undo the little-text escaping applied when publishing.
  const firstLine = text?.replace(/\\([\\|{}@[\]()<>*_~#])/g, "$1").split("\n").find(Boolean)?.trim() ?? "LinkedIn post";
  return firstLine.length > 84 ? `${firstLine.slice(0, 81)}…` : firstLine;
}

function contentType(post: LinkedInPost) {
  const mediaId = post.content?.media?.id ?? "";
  if (post.content?.multiImage || mediaId.startsWith("urn:li:document:")) return "carousel";
  if (mediaId.startsWith("urn:li:video:")) return "reel";
  return "post";
}

async function thumbnailFor(post: LinkedInPost, token: string) {
  const mediaId = post.content?.media?.id;
  if (mediaId?.startsWith("urn:li:image:")) {
    // LinkedIn image URLs are signed and expire after a while; a stale
    // thumbnail falls back to the type icon in the dashboard.
    const image = await get<{ downloadUrl?: string }>(`${LINKEDIN_API}/images/${encodeURIComponent(mediaId)}`, token).catch(() => null);
    return image?.downloadUrl ?? null;
  }
  return post.content?.article?.thumbnail ?? null;
}

export async function syncLinkedInConnection(connection: LinkedInConnection, requestedDays = 30) {
  const days = Math.min(Math.max(Math.round(requestedDays), 1), MAX_LOOKBACK_DAYS);
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0); // whole days only; today is still in progress
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const token = decryptSocialToken(connection.encrypted_access_token);
  const organization = encodeURIComponent(connection.account_id);
  const collectedAt = new Date().toISOString();
  const rows: MetricRow[] = [];
  const contentRows: ContentRow[] = [];
  const errors: string[] = [];
  const push = (metric: string, date: string | null, value: number | undefined) => {
    if (!date || typeof value !== "number" || !Number.isFinite(value) || value < 0) return;
    rows.push({
      project_id: connection.project_id, social_connection_id: connection.id, provider: "linkedin", platform: "LinkedIn",
      account_id: connection.account_id, metric, metric_date: date, value, collected_at: collectedAt,
    });
  };

  try {
    const shares = await get<{ elements?: Array<{ timeRange?: TimeRange; totalShareStatistics?: ShareStats }> }>(
      `${LINKEDIN_API}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${organization}&timeIntervals=${dailyIntervals(start, end)}`,
      token,
    );
    for (const element of shares.elements ?? []) {
      const date = day(element.timeRange?.start);
      const stats = element.totalShareStatistics ?? {};
      push("views", date, stats.impressionCount);
      push("reach", date, stats.uniqueImpressionsCount);
      push("interactions", date, interactionsOf(stats));
      push("link_clicks", date, stats.clickCount);
    }
  } catch (error) {
    errors.push(`LinkedIn post statistics: ${error instanceof Error ? error.message : "unavailable"}`);
  }

  try {
    const followers = await get<{ elements?: Array<{ timeRange?: TimeRange; followerGains?: { organicFollowerGain?: number; paidFollowerGain?: number } }> }>(
      `${LINKEDIN_API}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${organization}&timeIntervals=${dailyIntervals(start, end)}`,
      token,
    );
    for (const element of followers.elements ?? []) {
      const gains = element.followerGains ?? {};
      push("follows", day(element.timeRange?.start), Math.max(0, (gains.organicFollowerGain ?? 0) + (gains.paidFollowerGain ?? 0)));
    }
  } catch (error) {
    errors.push(`LinkedIn follower statistics: ${error instanceof Error ? error.message : "unavailable"}`);
  }

  try {
    const pages = await get<{ elements?: Array<{ timeRange?: TimeRange; totalPageStatistics?: { views?: { allPageViews?: { pageViews?: number } } } }> }>(
      `${LINKEDIN_API}/organizationPageStatistics?q=organization&organization=${organization}&timeIntervals=${dailyIntervals(start, end)}`,
      token,
    );
    for (const element of pages.elements ?? []) {
      push("visits", day(element.timeRange?.start), element.totalPageStatistics?.views?.allPageViews?.pageViews);
    }
  } catch (error) {
    errors.push(`LinkedIn page views: ${error instanceof Error ? error.message : "unavailable"}`);
  }

  try {
    const posts = await get<{ elements?: LinkedInPost[] }>(
      `${LINKEDIN_API}/posts?q=author&author=${organization}&count=50&sortBy=CREATED`,
      token,
      "FINDER",
    );
    const recent = (posts.elements ?? []).filter((post) => {
      const published = post.publishedAt ?? post.createdAt;
      return post.id && published && published >= start.getTime() && post.lifecycleState !== "DRAFT";
    });
    if (recent.length) {
      const shareIds = recent.filter((post) => post.id!.startsWith("urn:li:share:")).map((post) => encodeURIComponent(post.id!));
      const ugcIds = recent.filter((post) => post.id!.startsWith("urn:li:ugcPost:")).map((post) => encodeURIComponent(post.id!));
      const lists = [
        shareIds.length ? `&shares=List(${shareIds.join(",")})` : "",
        ugcIds.length ? `&ugcPosts=List(${ugcIds.join(",")})` : "",
      ].join("");
      const stats = await get<{ elements?: Array<{ share?: string; ugcPost?: string; totalShareStatistics?: ShareStats }> }>(
        `${LINKEDIN_API}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${organization}${lists}`,
        token,
      ).catch((error) => {
        errors.push(`LinkedIn per-post statistics: ${error instanceof Error ? error.message : "unavailable"}`);
        return { elements: [] };
      });
      const byPost = new Map((stats.elements ?? []).map((element) => [element.share ?? element.ugcPost, element.totalShareStatistics ?? {}]));
      for (const post of recent) {
        const postStats = byPost.get(post.id) ?? {};
        contentRows.push({
          project_id: connection.project_id, social_connection_id: connection.id, provider: "linkedin", platform: "LinkedIn",
          account_id: connection.account_id, external_post_id: post.id!, content_type: contentType(post),
          title: shortCommentary(post.commentary), permalink: `https://www.linkedin.com/feed/update/${post.id}/`,
          thumbnail_url: await thumbnailFor(post, token), published_at: new Date(post.publishedAt ?? post.createdAt!).toISOString(),
          views: postStats.impressionCount ?? 0, reach: postStats.uniqueImpressionsCount ?? 0,
          interactions: interactionsOf(postStats), collected_at: collectedAt,
        });
      }
    }
  } catch (error) {
    errors.push(`LinkedIn posts: ${error instanceof Error ? error.message : "unavailable"}`);
  }

  return { rows, contentRows, errors };
}
