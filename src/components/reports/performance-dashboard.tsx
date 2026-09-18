"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, Eye, Film, ImageIcon, Layers, Link2, Minus, MousePointer2, Users } from "lucide-react";
import { analyticsMetricLabels } from "@/lib/social-analytics-labels";

type Metric = { project_id: string; platform: "Facebook" | "Instagram" | "LinkedIn"; metric: string; metric_date: string; value: number | string };
type Connection = { project_id: string; platform: "Facebook" | "Instagram"; account_name: string };
type ContentPost = {
  project_id: string; platform: "Facebook" | "Instagram" | "LinkedIn"; external_post_id: string; content_type: "post" | "reel" | "carousel" | "story";
  title: string; permalink: string | null; thumbnail_url: string | null; published_at: string; views: number | string; reach: number | string; interactions: number | string;
};
type Sync = { status: "success" | "partial" | "failed"; metrics_written: number; message: string | null; created_at: string } | null;

const metricIcons: Record<string, typeof Eye> = {
  views: Eye, reach: Users, impressions: Eye, interactions: Activity,
  profile_visits: MousePointer2, visits: MousePointer2, link_clicks: Link2, reactions: Activity,
};
const contentTypeMeta = {
  post: { label: "Posts", icon: ImageIcon }, reel: { label: "Reels", icon: Film },
  carousel: { label: "Carousels", icon: Layers }, story: { label: "Stories", icon: ImageIcon },
} as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0, notation: value >= 10000 ? "compact" : "standard" }).format(value);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`));
}
function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
function weekStart(dateString: string) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function WeeklyTrend({ values, label }: { values: Array<{ date: string; value: number }>; label: string }) {
  const width = 680;
  const height = 180;
  const max = Math.max(...values.map((item) => item.value), 1);
  const points = values.map((item, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - 12 - ((item.value / max) * (height - 36));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const area = points ? `0,${height} ${points} ${width},${height}` : "";
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--foreground)]">Weekly {label.toLowerCase()}</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">Weekly totals from the selected platform</p></div><p className="text-xl font-semibold tabular-nums text-[var(--foreground)]">{formatNumber(values.reduce((sum, item) => sum + item.value, 0))}</p></div>
    <div className="mt-6 h-48"><svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" role="img" aria-label={`Weekly ${label.toLowerCase()} trend`} preserveAspectRatio="none"><defs><linearGradient id="performance-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ed0194" stopOpacity="0.38" /><stop offset="100%" stopColor="#7c3aed" stopOpacity="0" /></linearGradient></defs>{[0.25, 0.5, 0.75].map((position) => <line key={position} x1="0" x2={width} y1={height * position} y2={height * position} stroke="var(--border)" strokeDasharray="3 6" />)}{area && <polygon points={area} fill="url(#performance-fill)" />}{points && <polyline points={points} fill="none" stroke="#ed0194" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}</svg></div>
    <div className="mt-1 flex justify-between text-[11px] text-[var(--foreground-subtle)]"><span>{values[0] ? `Week of ${formatDate(values[0].date)}` : ""}</span><span>{values.at(-1) ? `Week of ${formatDate(values.at(-1)!.date)}` : ""}</span></div>
  </div>;
}

function ChangeMarker({ change }: { change: number | null }) {
  if (change === null) return <span className="flex items-center gap-1 text-[11px] text-[var(--foreground-subtle)]"><Minus className="h-3.5 w-3.5" />Benchmark building</span>;
  if (change > 0) return <span className="flex items-center gap-1 text-[11px] text-emerald-400"><ArrowUpRight className="h-3.5 w-3.5" /><strong>{Math.abs(change).toLocaleString("en-GB", { maximumFractionDigits: 0 })}%</strong> vs prior period</span>;
  if (change < 0) return <span className="flex items-center gap-1 text-[11px] text-rose-400"><ArrowDownRight className="h-3.5 w-3.5" /><strong>{Math.abs(change).toLocaleString("en-GB", { maximumFractionDigits: 0 })}%</strong> vs prior period</span>;
  return <span className="flex items-center gap-1 text-[11px] text-[var(--foreground-subtle)]"><Minus className="h-3.5 w-3.5" />No change vs prior period</span>;
}

export function PerformanceDashboard() {
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState<string>("all");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [content, setContent] = useState<ContentPost[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [latestSync, setLatestSync] = useState<Sync>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/analytics?days=${days * 2}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Performance data could not be loaded.");
      if (!cancelled) { setMetrics(body.metrics ?? []); setContent(body.content ?? []); setConnections(body.connections ?? []); setLatestSync(body.latestSync ?? null); setError(""); }
    }).catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Performance data could not be loaded."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const currentPeriodStart = useMemo(() => isoDateDaysAgo(days - 1), [days]);
  const previousPeriodStart = useMemo(() => isoDateDaysAgo((days * 2) - 1), [days]);
  const platforms = useMemo(() => [...new Set([...connections.map((connection) => connection.platform), ...metrics.map((metric) => metric.platform)])], [connections, metrics]);
  const selectedMetrics = useMemo(() => platform === "all" ? metrics : metrics.filter((metric) => metric.platform === platform), [metrics, platform]);
  const visibleMetrics = useMemo(() => selectedMetrics.filter((metric) => metric.metric_date >= currentPeriodStart), [selectedMetrics, currentPeriodStart]);
  const visibleContent = useMemo(() => (platform === "all" ? content : content.filter((item) => item.platform === platform)).filter((item) => item.published_at >= `${currentPeriodStart}T00:00:00.000Z`), [content, currentPeriodStart, platform]);
  const totals = useMemo(() => {
    const values = new Map<string, number>();
    for (const metric of visibleMetrics) values.set(metric.metric, (values.get(metric.metric) ?? 0) + Number(metric.value));
    return values;
  }, [visibleMetrics]);
  const previousTotals = useMemo(() => {
    const values = new Map<string, number>();
    for (const metric of selectedMetrics) {
      if (metric.metric_date < previousPeriodStart || metric.metric_date >= currentPeriodStart) continue;
      values.set(metric.metric, (values.get(metric.metric) ?? 0) + Number(metric.value));
    }
    return values;
  }, [currentPeriodStart, previousPeriodStart, selectedMetrics]);
  const preferredMetrics = platform === "Facebook" ? ["views", "reach", "interactions", "follows", "impressions", "visits", "reactions"] : ["views", "reach", "interactions", "engaged_accounts", "profile_visits", "link_clicks", "impressions", "visits", "reactions"];
  const cards = preferredMetrics.filter((metric) => totals.has(metric)).slice(0, 4);
  const comparisons = useMemo(() => new Map(cards.map((metric) => {
    const current = totals.get(metric) ?? 0;
    const previous = previousTotals.get(metric) ?? 0;
    return [metric, previous > 0 ? ((current - previous) / previous) * 100 : null] as const;
  })), [cards, previousTotals, totals]);
  const chartMetric = cards.find((metric) => ["views", "impressions", "reach"].includes(metric)) ?? cards[0];
  const weeklyValues = useMemo(() => {
    if (!chartMetric) return [];
    const values = new Map<string, number>();
    for (const metric of visibleMetrics) if (metric.metric === chartMetric) {
      const week = weekStart(metric.metric_date);
      values.set(week, (values.get(week) ?? 0) + Number(metric.value));
    }
    return [...values.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
  }, [chartMetric, visibleMetrics]);
  const formatShare = useMemo(() => cards.map((metric) => ({ metric, value: totals.get(metric) ?? 0 })).filter((item) => item.value > 0), [cards, totals]);
  const shareMax = Math.max(...formatShare.map((item) => item.value), 1);
  const contentTypes = useMemo(() => {
    const groups = new Map<string, { count: number; views: number }>();
    for (const item of visibleContent) { const current = groups.get(item.content_type) ?? { count: 0, views: 0 }; current.count += 1; current.views += Number(item.views); groups.set(item.content_type, current); }
    return [...groups.entries()].map(([type, values]) => ({ type: type as keyof typeof contentTypeMeta, ...values })).sort((a, b) => b.views - a.views || b.count - a.count);
  }, [visibleContent]);
  const contentTypeMax = Math.max(...contentTypes.map((item) => item.views), 1);
  const topContent = useMemo(() => [...visibleContent].sort((a, b) => (Number(b.views) - Number(a.views)) || (Number(b.interactions) - Number(a.interactions))).slice(0, 5), [visibleContent]);
  const momentumChange = comparisons.get("interactions") ?? comparisons.get("views") ?? comparisons.get("reach") ?? null;
  const momentum = momentumChange === null ? { label: "Building benchmark", className: "text-[var(--foreground-subtle)]" } : momentumChange > 5 ? { label: "Accelerating", className: "text-emerald-400" } : momentumChange < -5 ? { label: "Cooling", className: "text-rose-400" } : { label: "Steady", className: "text-amber-300" };
  const facebookConnected = connections.some((connection) => connection.platform === "Facebook");
  const instagramConnected = connections.some((connection) => connection.platform === "Instagram");
  const facebookNeedsReconnection = facebookConnected && latestSync?.status === "failed";

  return <section className="mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[radial-gradient(circle_at_80%_-20%,rgba(180,0,167,0.18),transparent_38%),var(--surface)] p-5 sm:p-7">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2 text-[var(--accent)]"><BarChart3 className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[0.18em]">Performance</span></div><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">Social performance, in one place</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">Instagram and Facebook are live Meta sources and remain filterable, rather than being blended with LinkedIn. LinkedIn reporting will follow once API access is reviewed.</p><div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold"><span className={`rounded-full border px-2.5 py-1 ${instagramConnected ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-[var(--foreground-subtle)]"}`}>Instagram · {instagramConnected ? "Live" : "Not connected"}</span><span className={`rounded-full border px-2.5 py-1 ${facebookNeedsReconnection ? "border-amber-400/25 bg-amber-400/10 text-amber-300" : facebookConnected ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-[var(--foreground-subtle)]"}`}>Facebook · {facebookNeedsReconnection ? "Needs reconnection" : facebookConnected ? "Live" : "Not connected"}</span><span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 text-violet-300">LinkedIn · Coming soon</span><span className={`rounded-full border border-white/10 bg-white/5 px-2.5 py-1 ${momentum.className}`}>Momentum · {momentum.label}</span></div></div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="performance-platform">Platform</label><select id="performance-platform" value={platform} onChange={(event) => setPlatform(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--foreground)] outline-none focus:border-[var(--accent)]"><option value="all">Meta: Instagram + Facebook</option>{platforms.map((item) => <option key={item} value={item}>{item}</option>)}<option disabled>LinkedIn — Coming soon</option></select><label className="sr-only" htmlFor="performance-range">Date range</label><select id="performance-range" value={days} onChange={(event) => { setLoading(true); setDays(Number(event.target.value)); }} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs font-medium text-[var(--foreground)] outline-none focus:border-[var(--accent)]"><option value={7}>Last week</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div></div>
    {loading ? <div className="mt-7 h-56 animate-pulse rounded-xl bg-white/5" /> : error ? <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{error}</p> : metrics.length === 0 ? <div className="mt-7 rounded-xl border border-dashed border-[var(--border)] bg-black/10 p-6 text-center"><CalendarDays className="mx-auto h-5 w-5 text-[var(--accent)]" /><p className="mt-3 text-sm font-medium text-[var(--foreground)]">Performance data will appear here once your Meta account is synced.</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">LinkedIn is clearly marked as coming soon while its API access is in review.</p></div> : <>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map((metric) => { const Icon = metricIcons[metric] ?? Activity; return <div key={metric} className="rounded-xl border border-white/8 bg-black/15 p-4"><Icon className="h-4 w-4 text-[var(--accent)]" /><p className="mt-5 text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">{formatNumber(totals.get(metric) ?? 0)}</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">{analyticsMetricLabels[metric] ?? metric}</p><div className="mt-2"><ChangeMarker change={comparisons.get(metric) ?? null} /></div></div>; })}</div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.55fr_0.85fr]"><WeeklyTrend values={weeklyValues} label={analyticsMetricLabels[chartMetric ?? ""] ?? "Performance"} /><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><p className="text-sm font-semibold text-[var(--foreground)]">Performance mix</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">Reported actions in this period</p><div className="mt-7 space-y-4">{formatShare.map(({ metric, value }) => <div key={metric}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="text-[var(--foreground-muted)]">{analyticsMetricLabels[metric] ?? metric}</span><span className="font-semibold tabular-nums text-[var(--foreground)]">{formatNumber(value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-[#ed0194] to-[#7c3aed]" style={{ width: `${(value / shareMax) * 100}%` }} /></div></div>)}</div></div></div>
      {visibleContent.length > 0 && <div className="mt-4 grid gap-4 lg:grid-cols-[0.78fr_1.22fr]"><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><p className="text-sm font-semibold text-[var(--foreground)]">By content type</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">Published content in this reporting period</p><div className="mt-6 space-y-4">{contentTypes.map(({ type, count, views }) => { const meta = contentTypeMeta[type]; const Icon = meta.icon; return <div key={type}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-[var(--foreground-muted)]"><Icon className="h-3.5 w-3.5 text-[var(--accent)]" />{meta.label}<span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px]">{count}</span></span><span className="font-semibold tabular-nums text-[var(--foreground)]">{formatNumber(views)} views</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-[#ed0194] to-[#7c3aed]" style={{ width: `${(views / contentTypeMax) * 100}%` }} /></div></div>; })}</div></div><div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--foreground)]">Top content</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">Best performers, ranked by views</p></div><span className="text-xs text-[var(--foreground-subtle)]">{topContent.length} shown</span></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{topContent.map((item) => { const type = contentTypeMeta[item.content_type] ?? contentTypeMeta.post; const Icon = type.icon; const post = <div className="group overflow-hidden rounded-xl border border-white/8 bg-black/15"><div className="relative aspect-[0.82] overflow-hidden bg-gradient-to-br from-[#531246] to-[#28133a]">{item.thumbnail_url ? <div className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105" style={{ backgroundImage: `url(${item.thumbnail_url})` }} /> : <div className="absolute inset-0 flex items-center justify-center"><Icon className="h-6 w-6 text-white/50" /></div>}<span className="absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-1 text-[10px] font-medium text-white">{type.label.slice(0, -1)}</span><span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-1 text-xs font-semibold text-white">{formatNumber(Number(item.views))}</span></div><div className="p-2.5"><p className="line-clamp-2 text-xs font-medium leading-snug text-[var(--foreground)]">{item.title}</p><p className="mt-1 text-[10px] text-[var(--foreground-muted)]">{formatNumber(Number(item.interactions))} interactions</p></div></div>; return item.permalink ? <a key={item.external_post_id} href={item.permalink} target="_blank" rel="noreferrer" className="block">{post}</a> : <div key={item.external_post_id}>{post}</div>; })}</div></div></div>}
      {latestSync && <p className="mt-5 text-xs text-[var(--foreground-subtle)]">Last Meta sync {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(latestSync.created_at))}{latestSync.status === "partial" ? " · Some account metrics were unavailable." : latestSync.status === "failed" ? " · Facebook needs reconnection before its data can be imported." : ""}</p>}
    </>}
  </section>;
}
