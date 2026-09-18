"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Eye, Minus, Users } from "lucide-react";

type Metric = {
  metric: string;
  metric_date: string;
  value: number | string;
};

type PerformanceResponse = { metrics?: Metric[]; error?: string };

const METRICS = [
  { key: "views", label: "Views", icon: Eye },
  { key: "reach", label: "Reach", icon: Users },
  { key: "interactions", label: "Interactions", icon: Activity },
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0, notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function formatChange(value: number) {
  return `${Math.abs(value).toLocaleString("en-GB", { maximumFractionDigits: 0 })}%`;
}

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function SocialPerformanceSummary() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/analytics?days=60")
      .then(async (response) => {
        const body = await response.json() as PerformanceResponse;
        if (!response.ok) throw new Error(body.error ?? "Unable to load performance.");
        if (!cancelled) setMetrics(body.metrics ?? []);
      })
      .catch(() => {
        if (!cancelled) setMetrics([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const cards = useMemo(() => {
    const currentPeriodStart = isoDateDaysAgo(29);
    const previousPeriodStart = isoDateDaysAgo(59);
    return METRICS.map((definition) => {
      let current = 0;
      let previous = 0;
      for (const point of metrics) {
        if (point.metric !== definition.key) continue;
        const value = Number(point.value);
        if (!Number.isFinite(value)) continue;
        if (point.metric_date >= currentPeriodStart) current += value;
        else if (point.metric_date >= previousPeriodStart) previous += value;
      }
      const change = previous > 0 ? ((current - previous) / previous) * 100 : null;
      return { ...definition, current, previous, change };
    });
  }, [metrics]);

  const hasPerformance = cards.some((card) => card.current > 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[radial-gradient(circle_at_90%_-40%,rgba(180,0,167,0.24),transparent_42%),var(--surface)]">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-subtle)]">
            <BarChart3 className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Social performance</p>
            <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">Last 30 days · compared with the previous 30 days</p>
          </div>
        </div>
        <a href="/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] transition-colors hover:text-pink-300">
          View full report <span aria-hidden="true">→</span>
        </a>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-px bg-[var(--border)] sm:grid-cols-3">
          {[0, 1, 2].map((index) => <div key={index} className="h-28 animate-pulse bg-[var(--surface)]" />)}
        </div>
      ) : hasPerformance ? (
        <div className="grid grid-cols-1 gap-px bg-[var(--border)] sm:grid-cols-3">
          {cards.map(({ key, label, icon: Icon, current, change }) => {
            const rising = change !== null && change > 0;
            const falling = change !== null && change < 0;
            return (
              <div key={key} className="bg-[var(--surface)] px-5 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[var(--foreground-muted)]">{label}</span>
                  <Icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">{formatNumber(current)}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                  {change === null ? (
                    <><Minus className="h-3.5 w-3.5 text-[var(--foreground-subtle)]" /><span className="text-[var(--foreground-subtle)]">Comparison available after the next sync</span></>
                  ) : rising ? (
                    <><ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" /><span className="font-semibold text-emerald-400">{formatChange(change)}</span><span className="text-[var(--foreground-subtle)]">vs previous period</span></>
                  ) : falling ? (
                    <><ArrowDownRight className="h-3.5 w-3.5 text-rose-400" /><span className="font-semibold text-rose-400">{formatChange(change)}</span><span className="text-[var(--foreground-subtle)]">vs previous period</span></>
                  ) : (
                    <><Minus className="h-3.5 w-3.5 text-[var(--foreground-subtle)]" /><span className="text-[var(--foreground-subtle)]">No change vs previous period</span></>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-6 text-sm text-[var(--foreground-muted)] sm:px-6">
          Your live social results will appear here after the first performance sync.
        </div>
      )}
    </section>
  );
}
