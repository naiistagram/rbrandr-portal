import Link from "next/link";
import { CheckCircle2, Clock3, Send } from "lucide-react";

type Props = {
  monthLabel: string;
  planned: number;
  target: number;
  inReview: number;
  published: number;
  scheduled: number;
  readyToSchedule: number;
  audience: "admin" | "client";
  context?: string;
  preview?: boolean;
};

export function MonthlyCadenceSummary({ monthLabel, planned, target, inReview, published, scheduled, readyToSchedule, audience, context, preview = false }: Props) {
  const secondary = audience === "admin"
    ? [
        { label: "Scheduled to publish", value: scheduled, icon: Clock3, color: "text-emerald-400" },
        { label: "Approved — needs a publish time", value: readyToSchedule, icon: Send, color: "text-amber-400" },
      ]
    : [
        { label: "Awaiting your review", value: inReview, icon: Clock3, color: "text-amber-400" },
        { label: "Published this month", value: published, icon: CheckCircle2, color: "text-emerald-400" },
      ];

  return (
    <section aria-label={`Monthly posting progress for ${monthLabel}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">At a glance</h2>
        <div className="flex items-center gap-3 text-xs text-[var(--foreground-subtle)]">
          <span>{monthLabel}{context ? ` · ${context}` : ""}</span>
          {!preview && <Link href={audience === "admin" ? "/admin/calendar" : "/calendar"} className="font-medium text-[var(--accent)] hover:underline">View calendar →</Link>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-[var(--foreground-muted)]">Planned social posts</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{planned}<span className="text-base font-medium text-[var(--foreground-subtle)]"> / {target}</span></p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${target ? Math.min(100, planned / target * 100) : 0}%` }} /></div>
          <p className="mt-1 text-[11px] text-[var(--foreground-subtle)]">{audience === "admin" && !context ? "Combined client targets" : "Client target"} · count starts fresh each month</p>
        </div>
        {secondary.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border-t border-[var(--border)] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <Icon className={`h-4 w-4 ${color}`} />
            <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>
            <p className="text-xs text-[var(--foreground-muted)]">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
