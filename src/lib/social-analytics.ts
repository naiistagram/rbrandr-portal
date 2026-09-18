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

async function fetchMetric(accountId: string, token: string, request: MetricRequest, since: number, until: number) {
  const query = new URLSearchParams({ metric: request.sourceMetric, period: "day", since: String(since), until: String(until), access_token: token });
  if (request.metricType) query.set("metric_type", request.metricType);
  const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${accountId}/insights?${query}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as GraphResponse;
  if (!response.ok) throw new Error(`${request.sourceMetric}: ${payload.error?.message ?? "Meta could not retrieve this metric."}`);
  return payload.data ?? [];
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

  return { rows, errors };
}
