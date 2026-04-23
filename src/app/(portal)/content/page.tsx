"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  X,
  ImageIcon,
  Film,
  FileText,
  Camera,
  Globe,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Paperclip,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { cn, STATUS_CONFIG, formatDate } from "@/lib/utils";
import type { ContentItem } from "@/lib/supabase/types";

type FilterStatus = "all" | ContentItem["status"];
const CONTENT_TYPES = ["post", "story", "reel", "ad", "email", "blog", "other"] as const;
const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Email", "Blog"];

const PLATFORM_CONFIG: Record<string, { color: string; bg: string; dot: string; pill: string }> = {
  Instagram: { color: "text-pink-400", bg: "from-purple-600/30 to-pink-600/30", dot: "bg-gradient-to-br from-purple-500 to-pink-500", pill: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  Facebook: { color: "text-blue-400", bg: "from-blue-700/30 to-blue-500/30", dot: "bg-blue-500", pill: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  TikTok: { color: "text-rose-400", bg: "from-zinc-800/80 to-rose-900/30", dot: "bg-rose-500", pill: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  LinkedIn: { color: "text-sky-400", bg: "from-sky-700/30 to-sky-500/30", dot: "bg-sky-500", pill: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  "Twitter/X": { color: "text-zinc-300", bg: "from-zinc-700/40 to-zinc-600/20", dot: "bg-zinc-400", pill: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20" },
  YouTube: { color: "text-red-400", bg: "from-red-700/30 to-red-500/20", dot: "bg-red-500", pill: "bg-red-500/10 text-red-400 border-red-500/20" },
  Email: { color: "text-emerald-400", bg: "from-emerald-700/30 to-emerald-500/20", dot: "bg-emerald-500", pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  Blog: { color: "text-amber-400", bg: "from-amber-700/30 to-amber-500/20", dot: "bg-amber-500", pill: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

const TYPE_PILL: Record<string, string> = {
  post: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  story: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  reel: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  carousel: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  ad: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  email: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  blog: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  other: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const PLATFORM_ORDER = ["Instagram", "Facebook", "TikTok", "LinkedIn", "Twitter/X", "YouTube", "Email", "Blog"];

export default function ContentPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "", content_type: "post" as ContentItem["content_type"],
    platform: "", description: "", scheduled_date: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail modal
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const res = await fetch("/api/content");
      if (res.ok) {
        const json = await res.json();
        if (json.projectId) setProjectId(json.projectId);
        setItems(json.content ?? []);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statuses: FilterStatus[] = ["all", "draft", "in_review", "approved", "rejected", "published"];

  const filtered = items.filter((item) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.platform ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    const matchPlatform = platformFilter === "all" || item.platform === platformFilter;
    return matchSearch && matchStatus && matchPlatform;
  });

  const counts = {
    all: items.length,
    draft: items.filter((i) => i.status === "draft").length,
    in_review: items.filter((i) => i.status === "in_review").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    published: items.filter((i) => i.status === "published").length,
  };

  const platformCounts: Record<string, number> = {};
  for (const p of PLATFORM_ORDER) {
    platformCounts[p] = items.filter((i) => i.platform === p).length;
  }

  const grouped: Record<string, ContentItem[]> = {};
  for (const p of PLATFORM_ORDER) {
    const g = filtered.filter((i) => i.platform === p);
    if (g.length) grouped[p] = g;
  }
  const other = filtered.filter((i) => !i.platform || !PLATFORM_ORDER.includes(i.platform));
  if (other.length) grouped["Other"] = other;

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

    if (json.content) setItems((prev) => [json.content, ...prev]);
    setShowCreate(false);
    setCreateForm({ title: "", content_type: "post", platform: "", description: "", scheduled_date: "" });
    setCreating(false);
  }

  async function updateStatus(id: string, status: ContentItem["status"]) {
    setSubmitting(true);
    const body: Record<string, unknown> = { id, status };
    if (feedback) body.feedback = feedback;

    const res = await fetch("/api/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setSubmitting(false); return; }

    const updated = json.content as ContentItem;
    setItems((prev) => prev.map((item) => item.id === id ? updated : item));
    setSelected((prev) => prev ? updated : null);
    setFeedback("");
    setSubmitting(false);

    const item = items.find((i) => i.id === id);
    if (item) {
      const action = status === "approved" ? "approved" : "rejected";
      await fetch("/api/notify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Content ${action}`,
          message: `"${item.title}" was ${action} by the client.${feedback ? ` Feedback: "${feedback}"` : ""}`,
          type: "content",
          link: `/admin/clients`,
        }),
      });
    }
  }

  function openDetail(item: ContentItem) {
    setSelected(item);
    setFeedback("");
    setMediaIndex(0);
  }

  function contentIcon(type: string) {
    if (type === "reel" || type === "story") return Film;
    if (type === "post" || type === "ad") return Camera;
    return FileText;
  }

  function ContentCard({ item }: { item: ContentItem }) {
    const Icon = contentIcon(item.content_type);
    const thumb = item.file_urls?.[0];
    const platCfg = item.platform ? PLATFORM_CONFIG[item.platform] : null;

    return (
      <button
        onClick={() => openDetail(item)}
        className="group text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-zinc-600 transition-all w-full"
      >
        <div className={cn(
          "relative aspect-[4/3] bg-[var(--surface-2)] flex items-center justify-center overflow-hidden",
          !thumb && platCfg ? `bg-gradient-to-br ${platCfg.bg}` : ""
        )}>
          {thumb ? (
            <img
              src={thumb}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <Icon className="w-8 h-8 text-[var(--foreground-subtle)] opacity-40" />
          )}
          <div className="absolute top-2 right-2">
            <div className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-semibold",
              item.status === "approved" ? "bg-emerald-400 text-zinc-900" :
              item.status === "published" ? "bg-[var(--accent)] text-white" :
              item.status === "rejected" ? "bg-red-400 text-zinc-900" :
              item.status === "in_review" ? "bg-amber-400 text-zinc-900" :
              "bg-zinc-700 text-zinc-300"
            )}>
              {STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]?.label ?? item.status}
            </div>
          </div>
          {(item.file_urls?.length ?? 0) > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              +{item.file_urls!.length - 1}
            </div>
          )}
        </div>
        <div className="p-3 space-y-2">
          <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-2 leading-tight">{item.title}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              "text-[10px] font-medium capitalize px-2 py-0.5 rounded border",
              TYPE_PILL[item.content_type] ?? TYPE_PILL.other
            )}>
              {item.content_type}
            </span>
            {item.platform && platCfg && (
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded border flex items-center gap-1", platCfg.pill)}>
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", platCfg.dot)} />
                {item.platform}
              </span>
            )}
          </div>
          {item.scheduled_date && (
            <p className="text-[10px] text-[var(--foreground-subtle)]">{formatDate(item.scheduled_date)}</p>
          )}
        </div>
      </button>
    );
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-all";

  // Detail modal media
  const selectedMedia = selected?.file_urls ?? [];
  const isImage = (url: string) => /\.(png|jpg|jpeg|gif|webp)/i.test(url) || (!url.includes(".pdf") && !url.includes(".zip"));

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="All Content" subtitle="View all content across your project" userId={userId} />

      <div className="flex-1 p-6 space-y-5 animate-fade-in">
        {/* Top bar */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          {projectId && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Request Content
            </button>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
            <input
              type="text"
              placeholder="Search content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer flex items-center gap-1.5",
                  statusFilter === s
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                    : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                )}
              >
                {s !== "all" && <StatusDot status={s} />}
                {s === "all" ? "All" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label}
                <span className="ml-0.5 text-[var(--foreground-subtle)]">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Platform filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPlatformFilter("all")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
              platformFilter === "all"
                ? "bg-[var(--surface)] border-[var(--foreground-muted)] text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
            )}
          >
            All Platforms
          </button>
          {PLATFORM_ORDER.filter((p) => (platformCounts[p] ?? 0) > 0).map((p) => {
            const cfg = PLATFORM_CONFIG[p];
            const active = platformFilter === p;
            return (
              <button
                key={p}
                onClick={() => setPlatformFilter(active ? "all" : p)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                  active ? cfg.pill : "border-[var(--border)] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)]"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
                {p}
                <span className="opacity-60">{platformCounts[p]}</span>
              </button>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["draft", "in_review", "approved", "rejected", "published"] as const).map((s) => {
            const config = STATUS_CONFIG[s];
            return (
              <Card key={s} className="py-3 px-4 cursor-pointer" onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}>
                <p className="text-2xl font-bold text-[var(--foreground)]">{counts[s]}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusDot status={s} />
                  <p className="text-xs text-[var(--foreground-muted)]">{config.label}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Platform sections */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16">
            <ImageIcon className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-muted)]">No content found</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([platform, platformItems]) => {
              const cfg = PLATFORM_CONFIG[platform];
              return (
                <div key={platform}>
                  <div className="flex items-center gap-3 mb-4">
                    {cfg ? (
                      <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", cfg.dot)} />
                    ) : (
                      <Globe className="w-4 h-4 text-zinc-500" />
                    )}
                    <h3 className={cn("text-sm font-bold", cfg?.color ?? "text-zinc-400")}>
                      {platform}
                    </h3>
                    <span className="text-xs text-[var(--foreground-subtle)] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-full">
                      {platformItems.length}
                    </span>
                    <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {platformItems.map((item) => (
                      <ContentCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Request content modal ── */}
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
                <textarea rows={3} value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Any specific requirements?" className={`${inputClass} resize-none`} />
              </div>
              {createError && (
                <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 font-mono">{createError}</p>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                  {creating && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Content detail modal (Instagram style) ── */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>

            {/* Left: media panel */}
            <div className="relative bg-black flex items-center justify-center md:w-[55%] flex-shrink-0 min-h-[220px]">
              {selectedMedia.length > 0 ? (
                <>
                  {isImage(selectedMedia[mediaIndex]) ? (
                    <img
                      src={selectedMedia[mediaIndex]}
                      alt={selected.title}
                      className="max-w-full max-h-[480px] object-contain"
                    />
                  ) : /\.pdf$/i.test(selectedMedia[mediaIndex]) ? (
                    <iframe
                      src={selectedMedia[mediaIndex]}
                      className="w-full border-0"
                      style={{ height: "clamp(400px, 70vh, 720px)" }}
                      title="PDF preview"
                    />
                  ) : /\.(mp4|mov|webm|ogg)$/i.test(selectedMedia[mediaIndex]) ? (
                    <video
                      src={selectedMedia[mediaIndex]}
                      controls
                      className="max-w-full max-h-[480px]"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 p-8">
                      <Paperclip className="w-8 h-8 text-zinc-400" />
                      <a
                        href={selectedMedia[mediaIndex]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--accent)] hover:underline"
                      >
                        Download file
                      </a>
                    </div>
                  )}
                  {selectedMedia.length > 1 && (
                    <>
                      <button
                        onClick={() => setMediaIndex((i) => Math.max(0, i - 1))}
                        disabled={mediaIndex === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white disabled:opacity-30 transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setMediaIndex((i) => Math.min(selectedMedia.length - 1, i + 1))}
                        disabled={mediaIndex === selectedMedia.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white disabled:opacity-30 transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                        {selectedMedia.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setMediaIndex(i)}
                            className={cn("w-1.5 h-1.5 rounded-full transition-all cursor-pointer", i === mediaIndex ? "bg-white" : "bg-white/40")}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className={cn(
                  "w-full h-full min-h-[220px] flex items-center justify-center",
                  selected.platform && PLATFORM_CONFIG[selected.platform]
                    ? `bg-gradient-to-br ${PLATFORM_CONFIG[selected.platform].bg}`
                    : "bg-[var(--surface-2)]"
                )}>
                  {(() => { const Icon = contentIcon(selected.content_type); return <Icon className="w-16 h-16 text-white/20" />; })()}
                </div>
              )}
            </div>

            {/* Right: detail panel */}
            <div className="flex flex-col flex-1 min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {selected.platform ? (() => {
                    const cfg = PLATFORM_CONFIG[selected.platform];
                    return (
                      <span className="flex items-center gap-1 text-xs font-semibold text-[var(--foreground-muted)]">
                        {cfg && <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />}
                        {selected.platform}
                      </span>
                    );
                  })() : (
                    <span className="text-xs font-semibold text-[var(--foreground-muted)]">No platform</span>
                  )}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                >
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
                  <span className={cn(
                    "text-[10px] font-medium capitalize px-2 py-0.5 rounded border ml-auto",
                    TYPE_PILL[selected.content_type] ?? TYPE_PILL.other
                  )}>
                    {selected.content_type}
                  </span>
                </div>

                {/* Title & date */}
                <div>
                  <h4 className="text-base font-bold text-[var(--foreground)] leading-tight">{selected.title}</h4>
                  {selected.scheduled_date && (
                    <p className="text-xs text-[var(--foreground-subtle)] mt-1">
                      Scheduled: {formatDate(selected.scheduled_date)}
                    </p>
                  )}
                </div>

                {/* Description / caption */}
                {selected.description && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Caption</p>
                    <p className="text-sm text-[var(--foreground-muted)] leading-relaxed whitespace-pre-line">{selected.description}</p>
                  </div>
                )}

                {/* Existing feedback */}
                {selected.feedback && (
                  <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                    <p className="text-xs font-semibold text-[var(--foreground-muted)] mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" /> Feedback from you
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
                      Being prepared by your account manager. You&apos;ll be notified when it&apos;s ready for review.
                    </div>
                  </div>
                )}

                {selected.status === "approved" && (
                  <div className="p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    You approved this content.
                  </div>
                )}

                {selected.status === "rejected" && (
                  <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20 flex items-center gap-2 text-xs text-red-400">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    You rejected this content.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
