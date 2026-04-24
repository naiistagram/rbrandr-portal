"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, CheckCircle2, Clock, ChevronRight, X, Send, Upload, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Topbar } from "@/components/layout/topbar";
import { formatDate } from "@/lib/utils";
import type { Form } from "@/lib/supabase/types";
type FormField = { id: string; label: string; type: "text" | "textarea" | "select" | "multiselect" | "checkbox" | "file"; options?: string[]; required?: boolean };

export default function FormsPage() {
  const supabase = createClient();
  const [forms, setForms] = useState<Form[]>([]);
  const [active, setActive] = useState<Form | null>(null);
  const [responses, setResponses] = useState<Record<string, string | boolean | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: projects } = await supabase.from("projects").select("id").order("created_at", { ascending: true });
      const projectIds = (projects ?? []).map((p) => p.id);
      if (projectIds.length > 0) setProjectId(projectIds[0]);
      if (projectIds.length > 0) {
        const { data } = await supabase.from("forms").select("*").in("project_id", projectIds).order("created_at", { ascending: false });
        if (data) setForms(data);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openForm(form: Form) {
    setActive(form);
    const existing = form.responses as Record<string, string | boolean> | null;
    setResponses(existing ?? {});
  }

  async function submitForm() {
    if (!active) return;
    setSubmitting(true);

    await supabase.from("forms").update({
      status: "submitted",
      responses,
      submitted_at: new Date().toISOString(),
    }).eq("id", active.id);

    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Form Submitted",
      message: `You submitted "${active.title}"`,
      type: "form",
      read: false,
      link: "/forms",
    });

    setForms((prev) =>
      prev.map((f) => (f.id === active.id ? { ...f, status: "submitted", responses } : f))
    );
    setActive(null);
    setSubmitting(false);
  }

  async function handleFileUpload(fieldId: string, file: File) {
    if (!projectId) return;
    setUploadingField(fieldId);
    const path = `${projectId}/form-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("assets").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("assets").getPublicUrl(path);
      setResponses((r) => ({ ...r, [fieldId]: publicUrl }));
    }
    setUploadingField(null);
  }

  const fields = active ? (active.fields as FormField[]) : [];

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Forms & Templates" subtitle="Complete forms and questionnaires from RBRANDR" userId={userId} />

      <div className="flex-1 p-6 animate-fade-in">
        {forms.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-10 h-10 text-[var(--foreground-subtle)] mx-auto mb-3" />
            <p className="text-sm text-[var(--foreground-muted)]">No forms yet</p>
            <p className="text-xs text-[var(--foreground-subtle)] mt-1">
              Forms and questionnaires from RBRANDR will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {forms.map((form) => (
              <div
                key={form.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex items-center gap-4 hover:border-zinc-600 transition-all cursor-pointer"
                onClick={() => openForm(form)}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    form.status === "submitted"
                      ? "bg-emerald-400/10"
                      : "bg-amber-400/10"
                  }`}
                >
                  {form.status === "submitted" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{form.title}</p>
                  {form.description && (
                    <p className="text-xs text-[var(--foreground-muted)] mt-0.5 truncate">
                      {form.description}
                    </p>
                  )}
                  <p className="text-xs text-[var(--foreground-subtle)] mt-0.5">
                    {form.submitted_at
                      ? `Submitted ${formatDate(form.submitted_at)}`
                      : `Added ${formatDate(form.created_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={form.status === "submitted" ? "success" : "warning"}>
                    {form.status === "submitted" ? "Completed" : "Pending"}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-[var(--foreground-subtle)]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {active && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground)]">{active.title}</h3>
                {active.description && (
                  <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{active.description}</p>
                )}
              </div>
              <button
                onClick={() => setActive(null)}
                className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground-muted)] flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-[var(--accent)]">*</span>}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      value={(responses[field.id] as string) ?? ""}
                      onChange={(e) => setResponses((r) => ({ ...r, [field.id]: e.target.value }))}
                      disabled={active.status === "submitted"}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] resize-none transition-all disabled:opacity-60"
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={(responses[field.id] as string) ?? ""}
                      onChange={(e) => setResponses((r) => ({ ...r, [field.id]: e.target.value }))}
                      disabled={active.status === "submitted"}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-all disabled:opacity-60"
                    >
                      <option value="">Select an option...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === "multiselect" ? (
                    <div className="flex flex-wrap gap-2">
                      {field.options?.map((opt) => {
                        const selected = ((responses[field.id] as string[]) ?? []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            disabled={active.status === "submitted"}
                            onClick={() => {
                              const current = (responses[field.id] as string[]) ?? [];
                              setResponses((r) => ({
                                ...r,
                                [field.id]: selected ? current.filter((v) => v !== opt) : [...current, opt],
                              }));
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all cursor-pointer disabled:opacity-60 ${
                              selected
                                ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]"
                                : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground-muted)] hover:border-zinc-500"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  ) : field.type === "checkbox" && field.options && field.options.length > 0 ? (
                    <div className="space-y-2">
                      {field.options.map((opt) => {
                        const checked = ((responses[field.id] as string[]) ?? []).includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={active.status === "submitted"}
                              onChange={() => {
                                const current = (responses[field.id] as string[]) ?? [];
                                setResponses((r) => ({
                                  ...r,
                                  [field.id]: checked ? current.filter((v) => v !== opt) : [...current, opt],
                                }));
                              }}
                              className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
                            />
                            <span className="text-sm text-[var(--foreground-muted)] group-hover:text-[var(--foreground)] transition-colors">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : field.type === "checkbox" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(responses[field.id] as boolean) ?? false}
                        onChange={(e) => setResponses((r) => ({ ...r, [field.id]: e.target.checked }))}
                        disabled={active.status === "submitted"}
                        className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
                      />
                      <span className="text-sm text-[var(--foreground-muted)]">Yes</span>
                    </label>
                  ) : field.type === "file" ? (
                    <div>
                      <input
                        ref={(el) => { fileInputRefs.current[field.id] = el; }}
                        type="file"
                        accept="image/*,video/*,.pdf,.zip,.doc,.docx"
                        className="hidden"
                        disabled={active.status === "submitted"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(field.id, file);
                        }}
                      />
                      {responses[field.id] ? (
                        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground-muted)]">
                          <Paperclip className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
                          <a href={responses[field.id] as string} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:text-[var(--accent)] transition-colors">{(responses[field.id] as string).split("/").pop()}</a>
                          {active.status !== "submitted" && (
                            <button type="button" onClick={() => setResponses((r) => { const n = { ...r }; delete n[field.id]; return n; })} className="text-[var(--foreground-subtle)] hover:text-red-400 cursor-pointer">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[field.id]?.click()}
                          disabled={active.status === "submitted" || uploadingField === field.id}
                          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--foreground-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer disabled:opacity-50 justify-center"
                        >
                          {uploadingField === field.id ? (
                            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          {uploadingField === field.id ? "Uploading…" : "Upload file or image"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={(responses[field.id] as string) ?? ""}
                      onChange={(e) => setResponses((r) => ({ ...r, [field.id]: e.target.value }))}
                      disabled={active.status === "submitted"}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-all disabled:opacity-60"
                    />
                  )}
                </div>
              ))}

              {active.status === "submitted" && (
                <div className="p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  This form has been submitted. Thank you!
                </div>
              )}
            </div>

            {active.status !== "submitted" && (
              <div className="px-6 py-4 border-t border-[var(--border)] flex-shrink-0 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setActive(null)}>
                  Cancel
                </Button>
                <Button className="flex-1" loading={submitting} onClick={submitForm}>
                  <Send className="w-4 h-4" />
                  Submit
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
