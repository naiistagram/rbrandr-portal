"use client";

import { useState } from "react";
import {
  Target,
  TrendingUp,
  Swords,
  CheckCircle2,
  Clock,
  FileText,
  CalendarDays,
  FolderOpen,
  Layers,
  ScrollText,
  Ticket,
  AlertCircle,
  X,
  Users,
  Radio,
  Film,
  Camera,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, STATUS_CONFIG } from "@/lib/utils";
import { PLATFORM_CONFIG, TYPE_PILL } from "@/lib/content-display";
import type { Project, ContentItem, Form } from "@/lib/supabase/types";

const SERVICE_LABELS: Record<string, string> = {
  social_media: "Social Media",
  marketing: "Marketing",
  both: "Website + Marketing",
  website: "Website",
  brand: "Brand",
};

const SERVICE_COLORS: Record<string, string> = {
  social_media: "text-pink-400 bg-pink-400/10",
  marketing: "text-purple-400 bg-purple-400/10",
  both: "text-[var(--accent)] bg-[var(--accent-subtle)]",
  website: "text-sky-400 bg-sky-400/10",
  brand: "text-amber-400 bg-amber-400/10",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10",
  draft: "text-zinc-400 bg-zinc-400/10",
  paused: "text-amber-400 bg-amber-400/10",
  completed: "text-sky-400 bg-sky-400/10",
};

interface Props {
  projects: Project[];
  allContent: ContentItem[];
  pendingForms: Form[];
  pendingContracts: { id: string; title: string; status: string }[];
  openTickets: { id: string; title: string; status: string; priority: string }[];
  /** Read-only admin preview: the linked pages (tickets/content/etc.) don't
   * exist in an admin-viewable, client-scoped form, so nav links are disabled. */
  preview?: boolean;
}

export function DashboardClient({ projects, allContent, pendingForms, pendingContracts, openTickets, preview = false }: Props) {
  const [modalProject, setModalProject] = useState<Project | null>(null);

  const pendingContent = allContent.filter((c) => c.status === "in_review");
  const contentInReview = pendingContent.length;
  const contentApproved = allContent.filter((c) => c.status === "approved").length;
  const contentPublished = allContent.filter((c) => c.status === "published").length;
  const totalActions = contentInReview + pendingForms.length + pendingContracts.length + openTickets.length;

  const modalKpis = (modalProject?.kpis as string[] | null) ?? [];
  const modalBrief = (modalProject?.brief as Record<string, string> | null) ?? {};

  return (
    <div className="flex-1 p-6 space-y-6 animate-fade-in">

      {/* ── Projects row ── */}
      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
          <FolderOpen className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
          <p className="text-sm text-[var(--foreground-muted)]">No projects yet.</p>
          <p className="text-xs text-[var(--foreground-subtle)] mt-1">Your account manager will set this up for you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--foreground-subtle)]" />
            <h2 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Your Projects</h2>
          </div>
          <div className={cn("grid gap-3", projects.length === 1 ? "grid-cols-1 max-w-sm" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
            {projects.map((p) => {
              const svcClass = SERVICE_COLORS[p.service_type] ?? "text-zinc-400 bg-zinc-400/10";
              const stClass = STATUS_COLORS[p.status] ?? "text-zinc-400 bg-zinc-400/10";
              return (
                <button
                  key={p.id}
                  onClick={() => setModalProject(p)}
                  className="text-left p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-zinc-600 hover:bg-[var(--surface-2)] transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", svcClass)}>
                      {SERVICE_LABELS[p.service_type] ?? p.service_type}
                    </span>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", stClass)}>
                      {p.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[var(--foreground)] truncate">{p.name}</h3>
                  {p.goals && (
                    <p className="text-xs text-[var(--foreground-subtle)] mt-1.5 line-clamp-2 leading-relaxed">{p.goals}</p>
                  )}
                  <p className="text-[10px] text-[var(--accent)] mt-2 opacity-0 group-hover:opacity-100 transition-opacity">View details →</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-xs text-[var(--foreground-subtle)]">Awaiting Review</p>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">{contentInReview}</p>
          {contentInReview > 0 && !preview && <a href="/content" className="text-[10px] text-amber-400 hover:underline mt-0.5 block">Review now →</a>}
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-xs text-[var(--foreground-subtle)]">Approved</p>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">{contentApproved}</p>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--accent)]" />
            <p className="text-xs text-[var(--foreground-subtle)]">Published</p>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">{contentPublished}</p>
        </Card>
        <Card className={cn("py-3 px-4", totalActions > 0 ? "border-amber-400/30" : "")}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className={cn("w-3.5 h-3.5", totalActions > 0 ? "text-amber-400" : "text-emerald-400")} />
            <p className="text-xs text-[var(--foreground-subtle)]">Actions Needed</p>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">{totalActions}</p>
          {totalActions === 0 && <p className="text-[10px] text-emerald-400 mt-0.5">All caught up!</p>}
        </Card>
      </div>

      {/* ── Pending contracts banner ── */}
      {pendingContracts.length > 0 && (
        <div className="space-y-2">
          {pendingContracts.map((c) => (
            <a
              key={c.id}
              href={preview ? undefined : "/contracts"}
              onClick={preview ? (e) => e.preventDefault() : undefined}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl bg-[var(--surface)] border border-amber-400/20 transition-colors",
                preview ? "cursor-default" : "hover:border-amber-400/40"
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                <ScrollText className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{c.title}</p>
                <p className="text-xs text-[var(--foreground-subtle)]">Contract requires your signature</p>
              </div>
              <Badge variant="warning">Sign</Badge>
            </a>
          ))}
        </div>
      )}

      {/* ── Content pending review ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">
              Content Pending Review{pendingContent.length > 0 ? ` (${pendingContent.length})` : ""}
            </h2>
          </div>
          {!preview && pendingContent.length > 0 && (
            <a href="/content" className="text-xs text-[var(--accent)] hover:underline">View all</a>
          )}
        </div>
        {pendingContent.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {pendingContent.slice(0, 8).map((item) => {
              const Icon = item.content_type === "reel" || item.content_type === "story" ? Film
                : item.content_type === "post" || item.content_type === "ad" ? Camera
                : FileText;
              const thumb = item.file_urls?.[0];
              const platCfg = item.platform ? PLATFORM_CONFIG[item.platform] : null;
              return (
                <a
                  key={item.id}
                  href={preview ? undefined : "/content"}
                  onClick={preview ? (e) => e.preventDefault() : undefined}
                  className={cn(
                    "group text-left bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden transition-all",
                    preview ? "cursor-default" : "hover:border-zinc-600"
                  )}
                >
                  <div className={cn(
                    "relative aspect-[4/3] bg-[var(--surface-2)] flex items-center justify-center overflow-hidden",
                    !thumb && platCfg ? `bg-gradient-to-br ${platCfg.bg}` : ""
                  )}>
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={item.title}
                        className={cn("w-full h-full object-cover transition-transform duration-300", !preview && "group-hover:scale-105")}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <Icon className="w-7 h-7 text-[var(--foreground-subtle)] opacity-40" />
                    )}
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400 text-zinc-900">
                      {STATUS_CONFIG.in_review?.label ?? "In Review"}
                    </div>
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    <p className="text-xs font-semibold text-[var(--foreground)] line-clamp-2 leading-tight">{item.title}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={cn("text-[10px] font-medium capitalize px-1.5 py-0.5 rounded border", TYPE_PILL[item.content_type] ?? TYPE_PILL.other)}>
                        {item.content_type}
                      </span>
                      {item.platform && platCfg && (
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border", platCfg.pill)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", platCfg.dot)} />
                          {item.platform}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] py-8 text-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-[var(--foreground-muted)]">No content awaiting review.</p>
          </div>
        )}
      </div>

      {/* ── Pending actions ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Pending Actions
          </CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {pendingForms.length === 0 && openTickets.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-[var(--foreground-muted)]">All caught up!</p>
              <p className="text-xs text-[var(--foreground-subtle)]">No pending actions</p>
            </div>
          ) : (
            <>
              {pendingForms.map((form) => (
                <a
                  key={form.id}
                  href={preview ? undefined : "/forms"}
                  onClick={preview ? (e) => e.preventDefault() : undefined}
                  className={cn("flex items-center gap-3 p-2.5 rounded-lg transition-colors group", preview ? "cursor-default" : "hover:bg-[var(--surface-2)]")}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{form.title}</p>
                    <p className="text-xs text-[var(--foreground-subtle)]">Form needs your response</p>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </a>
              ))}
              {openTickets.map((t) => (
                <a
                  key={t.id}
                  href={preview ? undefined : "/tickets"}
                  onClick={preview ? (e) => e.preventDefault() : undefined}
                  className={cn("flex items-center gap-3 p-2.5 rounded-lg transition-colors", preview ? "cursor-default" : "hover:bg-[var(--surface-2)]")}
                >
                  <div className="w-7 h-7 rounded-lg bg-orange-400/10 flex items-center justify-center flex-shrink-0">
                    <Ticket className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{t.title}</p>
                    <p className="text-xs text-[var(--foreground-subtle)] capitalize">{t.priority} priority · open</p>
                  </div>
                </a>
              ))}
            </>
          )}
        </div>
      </Card>

      {/* ── Project detail modal ── */}
      {modalProject && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalProject(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--border)]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", SERVICE_COLORS[modalProject.service_type] ?? "text-zinc-400 bg-zinc-400/10")}>
                    {SERVICE_LABELS[modalProject.service_type] ?? modalProject.service_type}
                  </span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[modalProject.status] ?? "text-zinc-400 bg-zinc-400/10")}>
                    {modalProject.status}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[var(--foreground)]">{modalProject.name}</h2>
              </div>
              <button onClick={() => setModalProject(null)} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors cursor-pointer mt-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Goals + Competition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Goals</p>
                  </div>
                  <p className="text-sm text-[var(--foreground-muted)] leading-relaxed whitespace-pre-line">
                    {modalProject.goals || "Not set yet."}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Swords className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Competitive Landscape</p>
                  </div>
                  <p className="text-sm text-[var(--foreground-muted)] leading-relaxed whitespace-pre-line">
                    {modalProject.competition || "Not set yet."}
                  </p>
                </div>
              </div>

              {/* KPIs */}
              {modalKpis.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">KPIs</p>
                  </div>
                  <div className="space-y-1.5">
                    {modalKpis.map((kpi, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-[var(--foreground-muted)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
                        {kpi}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Brief */}
              {(modalBrief.target_audience || modalBrief.messaging || modalBrief.channels) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[var(--border)]">
                  {modalBrief.target_audience && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                        <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Target Audience</p>
                      </div>
                      <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-line">{modalBrief.target_audience}</p>
                    </div>
                  )}
                  {modalBrief.messaging && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                        <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Main Messaging</p>
                      </div>
                      <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-line">{modalBrief.messaging}</p>
                    </div>
                  )}
                  {modalBrief.channels && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[var(--foreground-subtle)]" />
                        <p className="text-xs font-semibold text-[var(--foreground-muted)] uppercase tracking-wider">Channels</p>
                      </div>
                      <p className="text-sm text-[var(--foreground-muted)] whitespace-pre-line">{modalBrief.channels}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
