"use client";

import { useState, useEffect } from "react";
import { Milestone, CheckCircle2, Circle, Calendar, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Topbar } from "@/components/layout/topbar";
import { cn, formatDate } from "@/lib/utils";
import type { Milestone as MilestoneType } from "@/lib/supabase/types";
import { format, parseISO, isPast, isFuture, isToday } from "date-fns";

export default function TimelinePage() {
  const supabase = createClient();
  const [milestones, setMilestones] = useState<MilestoneType[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("milestones").select("*").eq("client_id", user.id).order("due_date", { ascending: true });
      if (data) setMilestones(data);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completed = milestones.filter((m) => m.completed);
  const upcoming = milestones.filter((m) => !m.completed);
  const progress = milestones.length > 0 ? Math.round((completed.length / milestones.length) * 100) : 0;

  function getMilestoneState(m: MilestoneType) {
    if (m.completed) return "completed";
    const date = parseISO(m.due_date);
    if (isToday(date)) return "today";
    if (isPast(date)) return "overdue";
    return "upcoming";
  }

  const stateConfig = {
    completed: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Completed", border: "border-emerald-400/20" },
    today: { icon: Clock, color: "text-[var(--accent)]", bg: "bg-[var(--accent-subtle)]", label: "Due Today", border: "border-[var(--accent)]/30" },
    overdue: { icon: Clock, color: "text-red-400", bg: "bg-red-400/10", label: "Overdue", border: "border-red-400/20" },
    upcoming: { icon: Circle, color: "text-[var(--foreground-muted)]", bg: "bg-[var(--surface-2)]", label: "Upcoming", border: "border-[var(--border)]" },
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Project Timeline" subtitle="Track your project milestones and progress" userId={userId} />

      <div className="flex-1 p-6 space-y-6 animate-fade-in">
        {milestones.length === 0 ? (
          <div className="text-center py-20">
            <Milestone className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-muted)]">No milestones yet</p>
            <p className="text-xs text-[var(--foreground-subtle)] mt-1">
              Your account manager will add milestones to track project progress
            </p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">Overall Progress</p>
                <p className="text-sm font-bold text-[var(--accent)]">{progress}%</p>
              </div>
              <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[var(--foreground-subtle)] mt-2">
                {completed.length} of {milestones.length} milestones complete
              </p>
            </div>

            {/* Timeline */}
            <div className="relative max-w-2xl">
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-[var(--border)]" />

              <div className="space-y-4">
                {milestones.map((m, i) => {
                  const state = getMilestoneState(m);
                  const cfg = stateConfig[state];
                  const Icon = cfg.icon;

                  return (
                    <div key={m.id} className="flex items-start gap-4 pl-1">
                      {/* Icon on line */}
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2", cfg.bg, cfg.border)}>
                        <Icon className={cn("w-4 h-4", cfg.color)} />
                      </div>

                      {/* Card */}
                      <div className={cn("flex-1 bg-[var(--surface)] border rounded-xl p-4 mb-1", cfg.border)}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <p className={cn("text-sm font-semibold", m.completed ? "text-[var(--foreground-muted)] line-through" : "text-[var(--foreground)]")}>
                            {m.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-subtle)]">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(m.due_date), "d MMM yyyy")}
                          </div>
                        </div>
                        {m.description && (
                          <p className="text-sm text-[var(--foreground-muted)] mt-1.5 leading-relaxed">{m.description}</p>
                        )}
                        <p className={cn("text-xs font-medium mt-2", cfg.color)}>{cfg.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
