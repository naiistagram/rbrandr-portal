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
type Insight = { name?: string; values?: InsightValue[] };
type GraphResponse = { data?: Insight[]; error?: { message?: string } };

const METRICS = {
  Instagram: ["views", "reach", "total_interactions", "profile_views", "website_clicks"],
  Facebook: ["page_impressions", "page_engaged_users", "page_views_total", "page_actions_post_reactions_total"],
} as const;

const METRIC_NAMES: Record<string, string> = {
  views: "views",
  reach: "reach",
  total_interactions: "interactions",
  profile_views: "profile_visits",
  website_clicks: "link_clicks",
  page_impressions: "impressions",
  page_engaged_users: "interactions",
  page_views_total: "visits",
  page_actions_post_reactions_total: "reactions",
};

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

async function fetchMetric(accountId: string, token: string, metric: string, since: number, until: number) {
  const query = new URLSearchParams({ metric, period: "day", since: String(since), until: String(until), access_token: token });
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/insights?${query}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as GraphResponse;
  if (!response.ok) throw new Error(payload.error?.message ?? `Meta could not retrieve ${metric}.`);
  return payload.data ?? [];
}

export async function syncMetaConnection(connection: MetaConnection, requestedDays = 30) {
  const days = Math.min(Math.max(Math.round(requestedDays), 1), MAX_LOOKBACK_DAYS);
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  const token = decryptSocialToken(connection.encrypted_access_token);
  const rows: Array<{ project_id: string; social_connection_id: string; provider: "meta"; platform: "Facebook" | "Instagram"; account_id: string; metric: string; metric_date: string; value: number; collected_at: string }> = [];
  const errors: string[] = [];

  // Metrics are fetched separately. Meta can make a metric unavailable for an
  // account type without preventing the rest of the dashboard from updating.
  for (const sourceMetric of METRICS[connection.platform]) {
    try {
      const insights = await fetchMetric(connection.account_id, token, sourceMetric, Math.floor(start.getTime() / 1000), Math.floor(end.getTime() / 1000));
      for (const insight of insights) {
        const metric = METRIC_NAMES[insight.name ?? sourceMetric];
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
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Unable to retrieve ${sourceMetric}.`);
    }
  }

  return { rows, errors };
}
