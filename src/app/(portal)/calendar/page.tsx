"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  X,
  List,
  CalendarDays,
  Calendar,
  Paperclip,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isToday,
} from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Topbar } from "@/components/layout/topbar";
import { FileViewer } from "@/components/ui/file-viewer";
import { cn, STATUS_CONFIG, formatDate } from "@/lib/utils";
import type { ContentItem } from "@/lib/supabase/types";

type ContentStatus = ContentItem["status"];
type CalView = "month" | "week" | "list";

const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Email", "Blog"];
const CONTENT_TYPES = ["post", "story", "reel", "ad", "email", "blog", "other"] as const;

const PLATFORM_CONFIG: Record<string, { dot: string; pill: string }> = {
  Instagram: { dot: "bg-gradient-to-br from-purple-500 to-pink-500", pill: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  Facebook: { dot: "bg-blue-500", pill: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  TikTok: { dot: "bg-rose-500", pill: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  LinkedIn: { dot: "bg-sky-500", pill: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  "Twitter/X": { dot: "bg-zinc-400", pill: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20" },
  YouTube: { dot: "bg-red-500", pill: "bg-red-500/10 text-red-400 border-red-500/20" },
  Email: { dot: "bg-emerald-500", pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  Blog: { dot: "bg-amber-500", pill: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

type NewContentForm = {
  title: string;
  content_type: ContentItem["content_type"];
  platform: string;
  description: string;
  scheduled_date: string;
};

const statusColors: Record<ContentStatus, string> = {
  draft: "bg-zinc-700 text-zinc-300",
  in_review: "bg-amber-400 text-zinc-900",
  approved: "bg-emerald-400 text-zinc-900",
  rejected: "bg-red-400 text-zinc-900",
  published: "bg-[var(--accent)] text-white",
};

export default function CalendarPage() {
  const supabase = createClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [view, setView] = useState<CalView>("month");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<NewContentForm>({
    title: "", content_type: "post", platform: "", description: "", scheduled_date: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Day view modal
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // File viewer state
  const [viewerFiles, setViewerFiles] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItemId, setViewerItemId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const res = await fetch("/api/content");
      if (res.ok) {
        const json = await res.json();
        if (json.projectId) setProjectId(json.projectId);
        const sorted = (json.content ?? []).sort((a: { scheduled_date: string | null }, b: { scheduled_date: string | null }) => {
          if (!a.scheduled_date && !b.scheduled_date) return 0;
          if (!a.scheduled_date) return 1;
          if (!b.scheduled_date) return -1;
          return a.scheduled_date.localeCompare(b.scheduled_date);
        });
        setItems(sorted);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreateForDay(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    setCreateForm((f) => ({ ...f, scheduled_date: `${y}-${m}-${d}` }));
    setShowCreate(true);
  }

  async function handleCreateContent(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !createForm.title) return;
    setCreating(true);
    setCreateError(null);

    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        title: createForm.title,
        content_type: createForm.content_type,
        platform: createForm.platform || null,
        description: createForm.description || null,
        scheduled_date: createForm.scheduled_date || null,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setCreateError(json.error ?? "Unknown error");
      setCreating(false);
      return;
    }

    if (json.content) setItems((prev) => [...prev, json.content]);
    setShowCreate(false);
    setCreateForm({ title: "", content_type: "post", platform: "", description: "", scheduled_date: "" });
    setCreating(false);
  }

  async function updateStatus(id: string, status: ContentStatus) {
    setSubmitting(true);
    const body: Record<string, unknown> = { id, status };
    if (feedback && (status === "rejected" || status === "approved")) body.feedback = feedback;

    const res = await fetch("/api/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setSubmitting(false); return; }

    const updated = json.content as ContentItem;
    setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    setSelected((prev) => (prev ? updated : null));
    setFeedback("");
    setSubmitting(false);

    await supabase.from("notifications").insert({
      user_id: userId,
      title: `Content ${STATUS_CONFIG[status].label}`,
      message: `"${selected?.title}" has been marked as ${STATUS_CONFIG[status].label.toLowerCase()}`,
      type: "content",
      read: false,
      link: "/calendar",
    });
  }

  function openViewer(files: string[], idx: number, itemId: string) {
    setViewerFiles(files);
    setViewerIndex(idx);
    setViewerItemId(itemId);
  }

  function handleAnnotationSaved(newUrls: string[]) {
    if (!viewerItemId) return;
    setItems((prev) => prev.map((item) => item.id === viewerItemId ? { ...item, file_urls: newUrls } : item));
    setSelected((prev) => prev?.id === viewerItemId ? { ...prev, file_urls: newUrls } : prev);
    setViewerFiles(newUrls);
  }

  // ── Calendar helpers ──
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  function itemsOnDay(day: Date) {
    return items.filter(
      (item) => item.scheduled_date && isSameDay(parseISO(item.scheduled_date), day)
    );
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-all";

  // Sorted items for list view
  const sortedItems = [...items].sort((a, b) => {
    if (!a.scheduled_date && !b.scheduled_date) return 0;
    if (!a.scheduled_date) return 1;
    if (!b.scheduled_date) return -1;
    return a.scheduled_date.localeCompare(b.scheduled_date);
  });

  // Nav label
  const navLabel = view === "month"
    ? format(currentDate, "MMMM yyyy")
    : view === "week"
    ? `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`
    : "All Content";

  function navPrev() {
    if (view === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => subWeeks(d, 1));
  }
  function navNext() {
    if (view === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (view === "week") setCurrentDate((d) => addWeeks(d, 1));
  }

  function DayItem({ item }: { item: ContentItem }) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setSelected(item); setFeedback(""); }}
        className={cn(
          "w-full text-left px-1.5 py-1 rounded text-[10px] font-medium truncate cursor-pointer transition-opacity hover:opacity-80",
          statusColors[item.status]
        )}
      >
        {item.title}
      </button>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Content Calendar" subtitle="Review and approve your scheduled content" userId={userId} />

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 p-6 flex flex-col space-y-4 animate-fade-in overflow-auto">
          {/* Controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Nav */}
            <div className="flex items-center gap-2">
              {view !== "list" && (
                <>
                  <button
                    onClick={navPrev}
                    className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-sm font-semibold text-[var(--foreground)] min-w-[160px] text-center">
                    {navLabel}
                  </h2>
                  <button
                    onClick={navNext}
                    className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentDate(new Date())}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-all cursor-pointer"
                  >
                    Today
                  </button>
                </>
              )}
              {view === "list" && (
                <h2 className="text-sm font-semibold text-[var(--foreground)]">All Content</h2>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Status legend */}
              <div className="hidden lg:flex items-center gap-3 mr-1">
                {(Object.keys(STATUS_CONFIG) as ContentStatus[]).map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <StatusDot status={s} />
                    <span className="text-xs text-[var(--foreground-muted)]">{STATUS_CONFIG[s].label}</span>
                  </div>
                ))}
              </div>

              {/* View toggle */}
              <div className="flex gap-0.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-0.5">
                {([
                  { key: "month", icon: Calendar, label: "Month" },
                  { key: "week", icon: CalendarDays, label: "Week" },
                  { key: "list", icon: List, label: "List" },
                ] as const).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer",
                      view === key
                        ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {projectId && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>
          </div>

          {/* ── MONTH VIEW ── */}
          {view === "month" && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden flex-1">
              <div className="grid grid-cols-7 border-b border-[var(--border)]">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="py-2.5 text-center text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7" style={{ minHeight: 480 }}>
                {monthDays.map((day, i) => {
                  const dayItems = itemsOnDay(day);
                  const today = isToday(day);
                  const inMonth = isSameMonth(day, currentDate);
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (!projectId || !inMonth) return;
                        if (dayItems.length > 0) setSelectedDay(day);
                        else openCreateForDay(day);
                      }}
                      className={cn(
                        "min-h-24 p-2 border-b border-r border-[var(--border-subtle)] last:border-r-0",
                        !inMonth && "opacity-30",
                        projectId && inMonth && "cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1.5",
                        today ? "bg-[var(--accent)] text-white" : "text-[var(--foreground-muted)]"
                      )}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayItems.slice(0, 3).map((item) => (
                          <DayItem key={item.id} item={item} />
                        ))}
                        {dayItems.length > 3 && (
                          <p className="text-[10px] text-[var(--foreground-subtle)] px-1">+{dayItems.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── WEEK VIEW ── */}
          {view === "week" && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden flex-1">
              <div className="grid grid-cols-7 border-b border-[var(--border)]">
                {weekDays.map((day) => {
                  const today = isToday(day);
                  return (
                    <div key={day.toISOString()} className="py-3 text-center border-r border-[var(--border-subtle)] last:border-r-0">
                      <p className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider">
                        {format(day, "EEE")}
                      </p>
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mx-auto mt-1",
                        today ? "bg-[var(--accent)] text-white" : "text-[var(--foreground)]"
                      )}>
                        {format(day, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7" style={{ minHeight: 400 }}>
                {weekDays.map((day) => {
                  const dayItems = itemsOnDay(day);
                  return (
                    <div key={day.toISOString()} className="p-2 border-r border-[var(--border-subtle)] last:border-r-0 min-h-40">
                      <div className="space-y-1.5">
                        {dayItems.length === 0 ? (
                          <p className="text-[10px] text-[var(--foreground-subtle)] text-center mt-4">—</p>
                        ) : (
                          dayItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => { setSelected(item); setFeedback(""); }}
                              className={cn(
                                "w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-opacity hover:opacity-80",
                                statusColors[item.status]
                              )}
                            >
                              <p className="truncate">{item.title}</p>
                              {item.platform && (
                                <p className="text-[10px] opacity-70 truncate">{item.platform}</p>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="space-y-2 flex-1">
              {sortedItems.length === 0 ? (
                <div className="text-center py-16 text-sm text-[var(--foreground-subtle)]">
                  No content yet
                </div>
              ) : (
                sortedItems.map((item) => {
                  const s = STATUS_CONFIG[item.status];
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setSelected(item); setFeedback(""); }}
                      className="w-full text-left flex items-center gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-zinc-600 transition-all cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)] truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {item.platform && <span className="text-xs text-[var(--foreground-subtle)]">{item.platform}</span>}
                          <span className="text-xs text-[var(--foreground-subtle)] capitalize">{item.content_type}</span>
                        </div>
                      </div>
                      {item.scheduled_date && (
                        <p className="text-xs text-[var(--foreground-subtle)] flex-shrink-0">{formatDate(item.scheduled_date)}</p>
                      )}
                      {(item.file_urls?.length ?? 0) > 0 && (
                        <Paperclip className="w-3.5 h-3.5 text-[var(--foreground-subtle)] flex-shrink-0" />
                      )}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <StatusDot status={item.status} />
                        <span className={cn("text-xs font-medium", s?.color)}>{s?.label}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Day view modal */}
        {selectedDay && (() => {
          const dayItems = itemsOnDay(selectedDay);
          return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-[var(--foreground)]">
                      {format(selectedDay, "EEEE, d MMMM yyyy")}
                    </h3>
                    <p className="text-xs text-[var(--foreground-subtle)] mt-0.5">
                      {dayItems.length} item{dayItems.length !== 1 ? "s" : ""} scheduled
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedDay(null); openCreateForDay(selectedDay); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Request
                    </button>
                    <button onClick={() => setSelectedDay(null)} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto p-4 space-y-2">
                  {dayItems.map((item) => {
                    const platCfg = item.platform ? PLATFORM_CONFIG[item.platform] : null;
                    const thumb = item.file_urls?.[0];
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setSelectedDay(null); setSelected(item); setFeedback(""); }}
                        className="w-full text-left flex items-center gap-3 p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl hover:border-zinc-600 transition-all cursor-pointer group"
                      >
                        {/* Thumbnail or placeholder */}
                        <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center bg-[var(--surface)]">
                          {thumb ? (
                            <img src={thumb} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className={cn("text-lg", platCfg ? "" : "text-[var(--foreground-subtle)]")}>
                              {item.content_type === "reel" || item.content_type === "story" ? "🎬" : item.content_type === "email" ? "✉️" : item.content_type === "blog" ? "📝" : "📸"}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--foreground)] truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.platform && platCfg && (
                              <span className="flex items-center gap-1 text-xs text-[var(--foreground-subtle)]">
                                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", platCfg.dot)} />
                                {item.platform}
                              </span>
                            )}
                            <span className="text-xs text-[var(--foreground-subtle)] capitalize">{item.content_type}</span>
                          </div>
                        </div>
                        <div className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0",
                          statusColors[item.status]
                        )}>
                          {STATUS_CONFIG[item.status]?.label ?? item.status}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Request content modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md animate-fade-in">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                <h3 className="text-sm font-bold text-[var(--foreground)]">Request Content</h3>
                <button onClick={() => setShowCreate(false)} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateContent} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Title *</label>
                  <input type="text" required value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} placeholder="What content would you like?" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Type</label>
                  <select value={createForm.content_type} onChange={(e) => setCreateForm((f) => ({ ...f, content_type: e.target.value as ContentItem["content_type"] }))} className={inputClass}>
                    {CONTENT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Platform</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreateForm((f) => ({ ...f, platform: "" }))}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                        !createForm.platform
                          ? "bg-[var(--surface)] border-[var(--foreground-muted)] text-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
                      )}
                    >
                      None
                    </button>
                    {PLATFORMS.map((p) => {
                      const cfg = PLATFORM_CONFIG[p];
                      const active = createForm.platform === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCreateForm((f) => ({ ...f, platform: p }))}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                            active ? cfg.pill : "border-[var(--border)] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
                          )}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Scheduled Date *</label>
                  <input type="date" required value={createForm.scheduled_date} onChange={(e) => setCreateForm((f) => ({ ...f, scheduled_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Notes</label>
                  <textarea rows={3} value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Any specific requirements or ideas?" className={`${inputClass} resize-none`} />
                </div>
                <p className="text-xs text-[var(--foreground-subtle)]">Submitted as a draft for your account manager to review.</p>
                {createError && (
                  <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 font-mono">{createError}</p>
                )}
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" loading={creating}>Submit Request</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Content detail panel */}
        {selected && (
          <div className="w-80 border-l border-[var(--border)] bg-[var(--surface)] flex flex-col animate-fade-in flex-shrink-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Content Details</h3>
              <button onClick={() => setSelected(null)} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <StatusDot status={selected.status} />
                <span className={cn("text-xs font-semibold", STATUS_CONFIG[selected.status as keyof typeof STATUS_CONFIG]?.color)}>
                  {STATUS_CONFIG[selected.status as keyof typeof STATUS_CONFIG]?.label}
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold text-[var(--foreground)]">{selected.title}</h4>
                {selected.scheduled_date && (
                  <p className="text-xs text-[var(--foreground-subtle)] mt-1">
                    Scheduled: {format(parseISO(selected.scheduled_date), "d MMM yyyy")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {selected.platform && <Badge variant="default">{selected.platform}</Badge>}
                {selected.content_type && <Badge variant="purple" className="capitalize">{selected.content_type}</Badge>}
              </div>

              {selected.description && (
                <div>
                  <p className="text-xs font-semibold text-[var(--foreground-muted)] mb-1.5 uppercase tracking-wider">Description</p>
                  <p className="text-sm text-[var(--foreground-muted)] leading-relaxed whitespace-pre-line">{selected.description}</p>
                </div>
              )}

              {/* Attachments — show images inline, files as links */}
              {selected.file_urls && selected.file_urls.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--foreground-muted)] mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-3 h-3" /> Attachments ({selected.file_urls.length})
                  </p>
                  {/* Image thumbnails grid */}
                  {(() => {
                    const images = selected.file_urls.filter((u) => /\.(png|jpg|jpeg|gif|webp)/i.test(u) || (u.includes("storage") && !u.includes(".pdf") && !u.includes(".zip")));
                    const pdfs = selected.file_urls.filter((u) => /\.pdf$/i.test(u));
                    const files = selected.file_urls.filter((u) => !images.includes(u) && !pdfs.includes(u));
                    return (
                      <div className="space-y-2">
                        {images.length > 0 && (
                          <div className={cn(
                            "grid gap-1.5",
                            images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                          )}>
                            {images.map((url, i) => (
                              <button
                                key={url}
                                onClick={() => openViewer(selected.file_urls!, selected.file_urls!.indexOf(url), selected.id)}
                                className="relative aspect-square rounded-lg overflow-hidden bg-[var(--surface-2)] cursor-pointer group"
                              >
                                <img
                                  src={url}
                                  alt={`Attachment ${i + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                        {pdfs.map((url) => (
                          <div key={url} className="rounded-lg overflow-hidden border border-[var(--border)]">
                            <iframe
                              src={url}
                              className="w-full border-0"
                              style={{ height: "420px" }}
                              title="PDF attachment"
                            />
                          </div>
                        ))}
                        {files.map((url, i) => {
                          const isAnn = url.includes("annotation-") && url.endsWith(".png");
                          const origIdx = selected.file_urls!.indexOf(url);
                          return (
                            <button
                              key={url}
                              onClick={() => openViewer(selected.file_urls!, origIdx, selected.id)}
                              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] hover:border-zinc-500 transition-all text-xs cursor-pointer"
                            >
                              <span className={cn("flex-1 truncate", isAnn ? "text-amber-400" : "text-[var(--accent)]")}>
                                {isAnn ? "📝 Annotation" : `📎 File ${i + 1}`}
                              </span>
                              <span className="text-[var(--foreground-subtle)] text-[10px] flex-shrink-0">View →</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {selected.feedback && (
                <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--foreground-muted)] mb-1 flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" /> Feedback
                  </p>
                  <p className="text-sm text-[var(--foreground-muted)]">{selected.feedback}</p>
                </div>
              )}

              {/* Approve / Reject */}
              {selected.status === "in_review" && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Your Response</p>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Add feedback or notes (optional)…"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] resize-none transition-all"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="danger" size="sm" loading={submitting} onClick={() => updateStatus(selected.id, "rejected")} className="gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                    <Button size="sm" loading={submitting} onClick={() => updateStatus(selected.id, "approved")} className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </Button>
                  </div>
                </div>
              )}

              {selected.status === "draft" && (
                <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-dashed border-[var(--border)]">
                  <div className="flex items-center gap-2 text-xs text-[var(--foreground-subtle)]">
                    <Clock className="w-3.5 h-3.5" />
                    This content is being prepared and will be sent for your review soon.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* File Viewer */}
      {viewerFiles.length > 0 && viewerItemId && (
        <FileViewer
          files={viewerFiles}
          initialIndex={viewerIndex}
          contentId={viewerItemId}
          onClose={() => { setViewerFiles([]); setViewerItemId(null); }}
          onAnnotationSaved={handleAnnotationSaved}
        />
      )}
    </div>
  );
}
