"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ExternalLink, Radio, Send } from "lucide-react";
import { cn, formatTime, STATUS_CONFIG } from "@/lib/utils";
import { PLATFORM_CONFIG } from "@/lib/content-display";

type CalendarContent = {
  id: string;
  project_id: string;
  title: string;
  platforms: string[];
  status: keyof typeof STATUS_CONFIG;
  scheduled_date: string | null;
  scheduled_time: string | null;
  publish_at: string | null;
  publish_error: string | null;
  projects: { client_id: string; name: string; profiles: { full_name: string; company_name: string | null } | null } | null;
};

type Connection = { project_id: string; platform: "Facebook" | "Instagram" | "LinkedIn"; account_name: string };

const PUBLISHABLE_PLATFORMS = new Set(["Facebook", "Instagram", "LinkedIn"]);

function clientName(item: CalendarContent) {
  return item.projects?.profiles?.company_name ?? item.projects?.profiles?.full_name ?? item.projects?.name ?? "Client";
}

function calendarDate(date: string) {
  // Add a local time component so the date never shifts based on browser timezone.
  return parseISO(`${date}T12:00:00`);
}

export function AdminPublishingCalendar({ initialContent, connections, loadError }: { initialContent: CalendarContent[]; connections: Connection[]; loadError: string | null }) {
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState<CalendarContent | null>(null);
  const [clientFilter, setClientFilter] = useState("all");

  const clients = useMemo(() => Array.from(new Set(initialContent.map(clientName))).sort(), [initialContent]);
  const visibleContent = useMemo(
    () => initialContent.filter((item) => clientFilter === "all" || clientName(item) === clientFilter),
    [initialContent, clientFilter],
  );
  const connectionMap = useMemo(() => {
    const map = new Map<string, Connection[]>();
    connections.forEach((connection) => map.set(connection.project_id, [...(map.get(connection.project_id) ?? []), connection]));
    return map;
  }, [connections]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const scheduledToPublish = visibleContent.filter((item) => item.publish_at && item.status === "approved").length;
  const readyToSchedule = visibleContent.filter((item) => item.status === "approved" && !item.publish_at).length;

  function itemsOn(day: Date) {
    const target = format(day, "yyyy-MM-dd");
    return visibleContent.filter((item) => item.scheduled_date === target);
  }

  function channelsFor(item: CalendarContent) {
    return connectionMap.get(item.project_id) ?? [];
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)]">Publishing Calendar</h1>
            <p className="text-sm text-[var(--foreground-muted)]">Plan content by date and see the channels each client has connected.</p>
          </div>
          <Link href="/admin/clients" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90">
            Manage client content <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 space-y-5 animate-fade-in">
        {loadError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">Calendar data could not fully load: {loadError}</p>}

        <section className="grid gap-3 sm:grid-cols-3">
          <Summary icon={CalendarDays} label="Planned content" value={visibleContent.length} />
          <Summary icon={Clock3} label="Scheduled to publish" value={scheduledToPublish} color="text-emerald-400" />
          <Summary icon={Send} label="Approved — needs a publish time" value={readyToSchedule} color="text-amber-400" />
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              <button onClick={() => setMonth((value) => subMonths(value, 1))} aria-label="Previous month" className="rounded-md p-2 text-[var(--foreground-muted)] hover:bg-[var(--surface-2)]"><ChevronLeft className="h-4 w-4" /></button>
              <h2 className="min-w-40 text-center text-sm font-semibold text-[var(--foreground)]">{format(month, "MMMM yyyy")}</h2>
              <button onClick={() => setMonth((value) => addMonths(value, 1))} aria-label="Next month" className="rounded-md p-2 text-[var(--foreground-muted)] hover:bg-[var(--surface-2)]"><ChevronRight className="h-4 w-4" /></button>
              <button onClick={() => setMonth(new Date())} className="ml-2 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]">Today</button>
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
              Client
              <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]">
                <option value="all">All clients</option>
                {clients.map((client) => <option key={client} value={client}>{client}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-2)]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayItems = itemsOn(day);
              return <div key={day.toISOString()} className={cn("min-h-30 border-b border-r border-[var(--border)] p-1.5 sm:min-h-36 sm:p-2", !isSameMonth(day, month) && "bg-[var(--surface-2)]/50")}>
                <p className={cn("mb-1 text-xs font-medium", isSameMonth(day, month) ? "text-[var(--foreground-muted)]" : "text-[var(--foreground-subtle)]")}>{format(day, "d")}</p>
                <div className="space-y-1">
                  {dayItems.slice(0, 3).map((item) => <button key={item.id} onClick={() => setSelected(item)} className={cn("block w-full rounded-md border px-1.5 py-1 text-left transition-colors hover:brightness-125", STATUS_CONFIG[item.status].bg, "border-white/5")}>
                    <p className="truncate text-[10px] font-semibold text-[var(--foreground)]">{item.title}</p>
                    <div className="mt-1 flex items-center gap-1">{item.platforms.filter((platform) => PUBLISHABLE_PLATFORMS.has(platform)).slice(0, 3).map((platform) => <span title={platform} key={platform} className={cn("h-1.5 w-1.5 rounded-full", PLATFORM_CONFIG[platform]?.dot ?? "bg-zinc-400")} />)}</div>
                  </button>)}
                  {dayItems.length > 3 && <button onClick={() => setSelected(dayItems[3])} className="w-full text-left text-[10px] font-medium text-[var(--accent)]">+{dayItems.length - 3} more</button>}
                </div>
              </div>;
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2"><Radio className="h-4 w-4 text-[var(--accent)]" /><h2 className="text-sm font-semibold text-[var(--foreground)]">How channel availability works</h2></div>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">Colour dots show the social platforms selected for each content item. The detail panel confirms whether that client has an account connected and ready to publish.</p>
        </section>
      </main>

      {selected && <DetailPanel item={selected} channels={channelsFor(selected)} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Summary({ icon: Icon, label, value, color = "text-[var(--accent)]" }: { icon: typeof CalendarDays; label: string; value: number; color?: string }) {
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><Icon className={cn("h-4 w-4", color)} /><p className="mt-3 text-2xl font-bold text-[var(--foreground)]">{value}</p><p className="text-xs text-[var(--foreground-muted)]">{label}</p></div>;
}

function DetailPanel({ item, channels, onClose }: { item: CalendarContent; channels: Connection[]; onClose: () => void }) {
  const connected = new Map(channels.map((channel) => [channel.platform, channel]));
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={onClose}>
    <aside className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-[var(--accent)]">{clientName(item)}</p><h2 className="mt-1 text-lg font-bold text-[var(--foreground)]">{item.title}</h2></div><button onClick={onClose} className="rounded-md p-2 text-[var(--foreground-muted)] hover:bg-[var(--surface-2)]">×</button></div>
      <div className="mt-5 space-y-4 text-sm">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--foreground-muted)]">Content plan</p><p className="mt-1 font-medium text-[var(--foreground)]">{item.scheduled_date ? format(calendarDate(item.scheduled_date), "EEE d MMMM") : "No planned date"}{item.scheduled_time ? ` · ${formatTime(item.scheduled_time)}` : ""}</p></div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"><p className="text-xs text-[var(--foreground-muted)]">Publishing status</p><p className={cn("mt-1 font-semibold", STATUS_CONFIG[item.status].color)}>{item.status === "approved" && item.publish_at ? "Scheduled to publish" : STATUS_CONFIG[item.status].label}</p>{item.publish_at && <p className="mt-1 text-xs text-[var(--foreground-muted)]">Publishing automatically at {format(new Date(item.publish_at), "d MMM, HH:mm")} UK time</p>}{item.publish_error && <p className="mt-1 text-xs text-red-300">Last publish attempt: {item.publish_error}</p>}</div>
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">Channels</p><div className="mt-2 space-y-2">{item.platforms.map((platform) => { const account = connected.get(platform as Connection["platform"]); const publishable = PUBLISHABLE_PLATFORMS.has(platform); return <div key={platform} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"><span className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]"><span className={cn("h-2 w-2 rounded-full", PLATFORM_CONFIG[platform]?.dot ?? "bg-zinc-400")} />{platform}</span>{publishable ? account ? <span className="text-xs text-emerald-400">Connected · {account.account_name}</span> : <span className="text-xs text-amber-300">Not connected</span> : <span className="text-xs text-[var(--foreground-subtle)]">No direct publishing</span>}</div>; })}</div></div>
      </div>
      {item.projects && <Link href={`/admin/clients/${item.projects.client_id}?tab=Content`} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90">Open client content <ExternalLink className="h-3.5 w-3.5" /></Link>}
    </aside>
  </div>;
}
