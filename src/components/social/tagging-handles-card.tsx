"use client";

import { useEffect, useState } from "react";
import { AtSign, CheckCircle2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Me = { instagram_username: string | null; linkedin_name: string | null; linkedin_connected_at: string | null } | null;

/**
 * Lets a portal user save the handles RBRANDR uses to tag them: their
 * Instagram username, and a LinkedIn connection (LinkedIn only lets apps
 * mention people who have connected their own account).
 */
export function TaggingHandlesCard({ returnTo }: { returnTo: "/settings" | "/admin/settings" }) {
  const [me, setMe] = useState<Me>(null);
  const [instagram, setInstagram] = useState("");
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    fetch("/api/social/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        // Result of returning from LinkedIn's consent screen.
        if (params.get("social") === "connected") setNotice("LinkedIn connected. You can now be mentioned in LinkedIn posts.");
        if (params.get("social") === "error") setError(params.get("socialMessage") ?? "LinkedIn could not be connected.");
        setUnavailable(Boolean(json.unavailable));
        setMe(json.person ?? null);
        setInstagram(json.person?.instagram_username ?? "");
      })
      .catch(() => setError("Could not load your social handles."))
      .finally(() => setLoading(false));
  }, []);

  async function saveInstagram() {
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/social/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instagram_username: instagram }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "Could not save your Instagram username.");
    else {
      setMe(json.person ?? null);
      setInstagram(json.person?.instagram_username ?? "");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  async function disconnectLinkedIn() {
    setError("");
    const res = await fetch("/api/social/me", { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "Could not disconnect LinkedIn.");
    else { setMe(json.person ?? null); setNotice(""); }
  }

  if (unavailable) return null;

  const inputClass = "w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all";

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Tagging on social media</h3>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">So RBRANDR can tag you in Instagram photos and mention you in LinkedIn posts.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--foreground-muted)] block">Instagram username</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <AtSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]" />
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="yourhandle" disabled={loading} className={inputClass} />
          </div>
          <Button variant="secondary" onClick={saveInstagram} loading={saving} disabled={loading || instagram.trim() === (me?.instagram_username ?? "")}>
            {saved ? <CheckCircle2 className="w-4 h-4" /> : "Save"}
          </Button>
        </div>
        <p className="text-[11px] text-[var(--foreground-subtle)]">Instagram only allows tags for public accounts.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--foreground-muted)] block">LinkedIn</label>
        {me?.linkedin_connected_at ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5">
            <span className="text-sm text-[var(--foreground)] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Connected{me.linkedin_name ? ` as ${me.linkedin_name}` : ""}
            </span>
            <button type="button" onClick={disconnectLinkedIn} className="text-xs text-[var(--foreground-subtle)] hover:text-red-400 cursor-pointer">Disconnect</button>
          </div>
        ) : (
          <a href={`/api/social/linkedin-member?returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] transition-all">
            <Link2 className="w-4 h-4" /> Connect LinkedIn
          </a>
        )}
        <p className="text-[11px] text-[var(--foreground-subtle)]">We only read your name and LinkedIn member ID. We never post as you.</p>
      </div>

      {notice && <p className="text-xs text-emerald-400">{notice}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
