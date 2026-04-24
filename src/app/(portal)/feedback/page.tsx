"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Star, Send, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/topbar";
import { cn, formatDate } from "@/lib/utils";
import type { Feedback } from "@/lib/supabase/types";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "service", label: "Service Quality" },
  { value: "platform", label: "Portal Experience" },
  { value: "other", label: "Other" },
];

export default function FeedbackPage() {
  const supabase = createClient();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Feedback["category"]>("general");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: projects } = await supabase.from("projects").select("id").eq("client_id", user.id).order("created_at", { ascending: true });
      const projectIds = (projects ?? []).map((p) => p.id);
      if (projectIds.length > 0) setProjectId(projectIds[0]);
      const { data } = await supabase.from("feedback").select("*").eq("submitted_by", user.id).order("created_at", { ascending: false });
      if (data) setFeedbacks(data);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message) return;
    setSubmitting(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, rating: rating || null, message, category }),
    });
    const json = await res.json();
    if (res.ok && json.feedback) setFeedbacks((prev) => [json.feedback, ...prev]);
    setRating(0);
    setMessage("");
    setCategory("general");
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] transition-all";

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Feedback" subtitle="Share your thoughts and help us improve" userId={userId} />

      <div className="flex-1 p-6 space-y-6 animate-fade-in">
        {/* Submit form */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 max-w-2xl space-y-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Leave Feedback</h3>

          {submitted ? (
            <div className="flex items-center gap-3 py-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-[var(--foreground-muted)]">Thank you for your feedback!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star rating */}
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-2">Overall Rating (optional)</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "w-7 h-7 transition-colors",
                          (hoverRating || rating) >= star ? "fill-amber-400 text-amber-400" : "text-[var(--border)]"
                        )}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <button type="button" onClick={() => setRating(0)} className="ml-2 text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] cursor-pointer">
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value as Feedback["category"])}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                        category === cat.value
                          ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                          : "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Your Message *</label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your thoughts, suggestions, or concerns..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              <Button type="submit" loading={submitting} className="w-full gap-2">
                <Send className="w-4 h-4" /> Submit Feedback
              </Button>
            </form>
          )}
        </div>

        {/* Past feedback */}
        {feedbacks.length > 0 && (
          <div className="max-w-2xl space-y-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Your Previous Feedback</h3>
            {feedbacks.map((fb) => (
              <div key={fb.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {fb.rating && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={cn("w-3.5 h-3.5", fb.rating! >= s ? "fill-amber-400 text-amber-400" : "text-[var(--border)]")} />
                      ))}
                    </div>
                  )}
                  <span className="text-xs text-[var(--foreground-subtle)] capitalize">{fb.category}</span>
                  <span className="text-xs text-[var(--foreground-subtle)] ml-auto">{formatDate(fb.created_at)}</span>
                </div>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{fb.message}</p>
                {fb.admin_reply && (
                  <div className="p-3 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
                    <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider mb-1">Reply from RBRANDR</p>
                    <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{fb.admin_reply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
