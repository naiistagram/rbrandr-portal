"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase fires SIGNED_IN with type=RECOVERY after the callback exchanges the code
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // Also check if already signed in (callback already ran)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2500);
    }
  }

  if (done) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 text-center space-y-4 animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
        </div>
        <h1 className="text-lg font-bold text-[var(--foreground)]">Password updated!</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Your password has been changed. Redirecting you to the portal…
        </p>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 text-center space-y-3 animate-fade-in">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-[var(--foreground-muted)]">Verifying your reset link…</p>
        <p className="text-xs text-[var(--foreground-subtle)]">
          If nothing happens,{" "}
          <a href="/forgot-password" className="text-[var(--accent)] hover:underline">
            request a new link
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 animate-fade-in">
      <h1 className="text-xl font-bold text-[var(--foreground)] mb-1">Set new password</h1>
      <p className="text-sm text-[var(--foreground-muted)] mb-6">
        Choose a strong password for your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">New password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
            <input
              type={showPw ? "text" : "password"}
              required
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] text-sm outline-none focus:border-[var(--accent)] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] cursor-pointer"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--foreground-muted)] block mb-1.5">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
            <input
              type={showPw ? "text" : "password"}
              required
              placeholder="Repeat your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] text-sm outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Update password
        </Button>
      </form>
    </div>
  );
}
