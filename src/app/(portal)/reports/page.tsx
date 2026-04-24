"use client";

import { useState, useEffect } from "react";
import { BarChart3, Download, FileText, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Topbar } from "@/components/layout/topbar";
import { formatDate } from "@/lib/utils";
import type { Report } from "@/lib/supabase/types";

export default function ReportsPage() {
  const supabase = createClient();
  const [reports, setReports] = useState<Report[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: projects } = await supabase.from("projects").select("id").order("created_at", { ascending: true });
      const projectIds = (projects ?? []).map((p) => p.id);
      if (projectIds.length > 0) {
        const { data } = await supabase.from("reports").select("*").in("project_id", projectIds).order("created_at", { ascending: false });
        if (data) setReports(data);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Reports" subtitle="Track the work being done on your project" userId={userId} />

      <div className="flex-1 p-6 animate-fade-in">
        {reports.length === 0 ? (
          <div className="text-center py-20">
            <BarChart3 className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-muted)]">No reports yet</p>
            <p className="text-xs text-[var(--foreground-subtle)] mt-1">
              Monthly and project reports will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{report.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3 text-[var(--foreground-subtle)]" />
                          <p className="text-xs text-[var(--foreground-subtle)]">{report.period}</p>
                          <span className="text-[var(--foreground-subtle)]">·</span>
                          <p className="text-xs text-[var(--foreground-subtle)]">
                            Added {formatDate(report.created_at)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={report.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-zinc-500 transition-all flex-shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </div>

                    {report.summary && (
                      <div className="mt-3 pt-3 border-t border-[var(--border)]">
                        <p className="text-xs font-semibold text-[var(--foreground-subtle)] uppercase tracking-wider mb-1.5">
                          Summary
                        </p>
                        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed whitespace-pre-line">
                          {report.summary}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
