"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CalendarDays, Eye, Link2, MousePointer2, Users } from "lucide-react";
import { analyticsMetricLabels } from "@/lib/social-analytics-labels";

type Metric = { project_id: string; platform: "Facebook" | "Instagram" | "LinkedIn"; metric: string; metric_date: string; value: number | string };
type Connection = { project_id: string; platform: "Facebook" | "Instagram"; account_name: string };
type Sync = { status: "success" | "partial" | "failed"; metrics_written: number; message: string | null; created_at: string } | null;

const metricIcons: Record<string, typeof Eye> = {
  views: Eye,
  reach: Users,
  impressions: Eye,
  interactions: Activity,
  profile_visits: MousePointer2,
  visits: MousePointer2,
  link_clicks: Link2,
  reactions: Activity,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0, notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`));
}

function Trend({ values, label }: { values: Array<{ date: string; value: number }>; label: string }) {
  const width = 680;
  const height = 180;
  const max = Math.max(...values.map((item) => item.value), 1);
  const points = values.map((item, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - 12 - ((item.value / max) * (height - 36));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const area = points ? `0,${height} ${points} ${width},${height}` : "";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">Daily {label.toLowerCase()}</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Reported by the connected social account</p>
        </div>
        <p className="text-xl font-semibold tabular-nums text-[var(--foreground)]">{formatNumber(values.reduce((sum, item) => sum + item.value, 0))}</p>
      </div>
      <div className="mt-6 h-48">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" role="img" aria-label={`Daily ${label.toLowerCase()} trend`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="performance-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ed0194" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((position) => <line key={position} x1="0" x2={width} y1={height * position} y2={height * position} stroke="var(--border)" strokeDasharray="3 6" />)}
          {area && <polygon points={area} fill="url(#performance-fill)" />}
          {points && <polyline points={points} fill="none" stroke="#ed0194" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-[var(--foreground-subtle)]">
        <span>{values[0] ? formatDate(values[0].date) : ""}</span>
        <span>{values.at(-1) ? formatDate(values.at(-1)!.date) : ""}</span>
      </div>
    </div>
  );
}

export function PerformanceDashboard() {
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState<string>("all");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [latestSync, setLatestSync] = useState<Sync>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/analytics?days=${days}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Performance data could not be loaded.");
        if (!cancelled) {
          setMetrics(body.metrics ?? []);
          setConnections(body.connections ?? []);
          setLatestSync(body.latestSync ?? null);
          setError("");
        }
      })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Performance data could not be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const platforms = useMemo(() => [...new Set([...connections.map((connection) => connection.platform), ...metrics.map((metric) => metric.platform)])], [connections, metrics]);
  const visibleMetrics = useMemo(() => platform === "all" ? metrics : metrics.filter((metric) => metric.platform === platform), [metrics, platform]);
  const totals = useMemo(() => {
    const values = new Map<string, number>();
    for (const metric of visibleMetrics) values.set(metric.metric, (values.get(metric.metric) ?? 0) + Number(metric.value));
    return values;
  }, [visibleMetrics]);
  const preferredMetrics = platform === "Facebook"
    ? ["views", "reach", "interactions", "follows", "impressions", "visits", "reactions"]
    : ["views", "reach", "interactions", "engaged_accounts", "profile_visits", "link_clicks", "impressions", "visits", "reactions"];
  const cards = preferredMetrics.filter((metric) => totals.has(metric)).slice(0, 4);
  const chartMetric = cards.find((metric) => ["views", "impressions", "reach"].includes(metric)) ?? cards[0];
  const dailyValues = useMemo(() => {
    if (!chartMetric) return [];
    const values = new Map<string, number>();
    for (const metric of visibleMetrics) {
      if (metric.metric === chartMetric) values.set(metric.metric_date, (values.get(metric.metric_date) ?? 0) + Number(metric.value));
    }
    return [...values.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  }, [chartMetric, visibleMetrics]);
  const formatShare = useMemo(() => cards.map((metric) => ({ metric, value: totals.get(metric) ?? 0 })).filter((item) => item.value > 0), [cards, totals]);
  const shareMax = Math.max(...formatShare.map((item) => item.value), 1);

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[radial-gradient(circle_at_80%_-20%,rgba(180,0,167,0.18),transparent_38%),var(--surface)] p-5 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent)]"><BarChart3 className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[0.18em]">Performance</span></div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">Social performance, in one place</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--foreground-muted)]">Live reporting from your connected Instagram and Facebook accounts. Platform metrics stay separate so their definitions remain clear.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="performance-platform">Platform</label>
          <select id="performance-platform" value={platform} onChange={(event) => setPlatform(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--foreground)] outline-none focus:border-[var(--accent)]">
            <option value="all">All platforms</option>
            {platforms.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="sr-only" htmlFor="performance-range">Date range</label>
          <select id="performance-range" value={days} onChange={(event) => { setLoading(true); setDays(Number(event.target.value)); }} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--foreground)] outline-none focus:border-[var(--accent)]">
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {loading ? <div className="mt-7 h-56 animate-pulse rounded-xl bg-white/5" /> : error ? <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{error}</p> : metrics.length === 0 ? (
        <div className="mt-7 rounded-xl border border-dashed border-[var(--border)] bg-black/10 p-6 text-center">
          <CalendarDays className="mx-auto h-5 w-5 text-[var(--accent)]" />
          <p className="mt-3 text-sm font-medium text-[var(--foreground)]">Performance data will appear here once your account is synced.</p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Your account manager can connect Meta and run the first sync from the client workspace.</p>
        </div>
      ) : (
        <>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((metric) => {
              const Icon = metricIcons[metric] ?? Activity;
              return <div key={metric} className="rounded-xl border border-white/8 bg-black/15 p-4"><Icon className="h-4 w-4 text-[var(--accent)]" /><p className="mt-5 text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">{formatNumber(totals.get(metric) ?? 0)}</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">{analyticsMetricLabels[metric] ?? metric}</p></div>;
            })}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_0.85fr]">
            <Trend values={dailyValues} label={analyticsMetricLabels[chartMetric ?? ""] ?? "Performance"} />
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><p className="text-sm font-semibold text-[var(--foreground)]">Performance mix</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">Reported actions in this period</p><div className="mt-7 space-y-4">{formatShare.map(({ metric, value }) => <div key={metric}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="text-[var(--foreground-muted)]">{analyticsMetricLabels[metric] ?? metric}</span><span className="font-semibold tabular-nums text-[var(--foreground)]">{formatNumber(value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-[#ed0194] to-[#7c3aed]" style={{ width: `${(value / shareMax) * 100}%` }} /></div></div>)}</div></div>
          </div>
          {latestSync && <p className="mt-5 text-xs text-[var(--foreground-subtle)]">Last sync {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(latestSync.created_at))}{latestSync.status === "partial" ? " · Some account metrics were unavailable." : ""}</p>}
        </>
      )}
    </section>
  );
}
