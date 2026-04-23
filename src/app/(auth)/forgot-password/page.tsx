"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 animate-fade-in">
      {sent ? (
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">Check your email</h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            We&apos;ve sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link to set a new password.
          </p>
          <p className="text-xs text-[var(--foreground-subtle)]">
            Didn&apos;t receive it? Check your spam folder or{" "}
            <button
              onClick={() => setSent(false)}
              className="text-[var(--accent)] hover:underline cursor-pointer"
            >
              try again
            </button>
            .
          </p>
          <Link href="/login" className="block text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors mb-5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>

          <h1 className="text-xl font-bold text-[var(--foreground)] mb-1">Reset your password</h1>
          <p className="text-sm text-[var(--foreground-muted)] mb-6">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-subtle)]" />
              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all"
              />
            </div>

            {error && (
              <div className="px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Send reset link
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
