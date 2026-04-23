"use client";

import { useState } from "react";
import {
  Target,
  TrendingUp,
  Swords,
  CheckCircle2,
  Clock,
  XCircle,
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
} from "lucide-react";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
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

const statusMap: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: "Draft", icon: FileText, color: "text-zinc-400" },
  in_review: { label: "In Review", icon: Clock, color: "text-amber-400" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-emerald-400" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-400" },
  published: { label: "Published", icon: CheckCircle2, color: "text-[var(--accent)]" },
};

interface Props {
  projects: Project[];
  allContent: ContentItem[];
  pendingForms: Form[];
  pendingContracts: { id: string; title: string; status: string }[];
  openTickets: { id: string; title: string; status: string; priority: string }[];
}

export function DashboardClient({ projects, allContent, pendingForms, pendingContracts, openTickets }: Props) {
  const [modalProject, setModalProject] = useState<Project | null>(null);

  const recentContent = allContent.slice(0, 5);
  const contentInReview = allContent.filter((c) => c.status === "in_review").length;
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
          {contentInReview > 0 && <a href="/content" className="text-[10px] text-amber-400 hover:underline mt-0.5 block">Review now →</a>}
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
            <a key={c.id} href="/contracts" className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--surface)] border border-amber-400/20 hover:border-amber-400/40 transition-colors">
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

      {/* ── Recent content + Pending actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[var(--accent)]" />
              Recent Content
            </CardTitle>
            <a href="/content" className="text-xs text-[var(--accent)] hover:underline">View all</a>
          </CardHeader>
          {recentContent.length > 0 ? (
            <div className="space-y-2">
              {recentContent.map((item) => {
                const s = statusMap[item.status];
                const Icon = s?.icon ?? FileText;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${s?.color ?? "text-zinc-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</p>
                      <p className="text-xs text-[var(--foreground-subtle)]">{formatDate(item.updated_at)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={item.status} />
                      <span className="text-xs text-[var(--foreground-muted)]">{s?.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--foreground-subtle)]">No content yet.</p>
          )}
        </Card>

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
                  <a key={form.id} href="/forms" className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors group">
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
                  <a key={t.id} href="/tickets" className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
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
      </div>

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
