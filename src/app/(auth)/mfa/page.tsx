"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export default function MfaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMfa() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        setError("We couldn't load your two-factor authentication settings. Please try again.");
      } else {
        const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance?.currentLevel === "aal2") {
          router.replace("/dashboard");
          return;
        }
        setFactorId(data.totp[0]?.id ?? null);
      }
      setLoading(false);
    }

    void loadMfa();
  }, [router, supabase]);

  async function startEnrollment() {
    setSubmitting(true);
    setError("");

    const { data: factors } = await supabase.auth.mfa.listFactors();
    if (factors) {
      await Promise.all(
        factors.all
          .filter((factor) => factor.factor_type === "totp" && factor.status === "unverified")
          .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id }))
      );
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "RBRANDR Portal",
    });

    if (enrollError || !data.totp) {
      setError(enrollError?.message ?? "We couldn't start two-factor authentication. Please try again.");
      setSubmitting(false);
      return;
    }

    setFactorId(data.id);
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setSubmitting(false);
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }

    setSubmitting(true);
    setError("");

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (verifyError) {
      setError("That code didn't work. Check the time on your device and try again.");
      setSubmitting(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const isEnrolling = Boolean(enrollment);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 animate-fade-in">
      <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center mb-5">
        <ShieldCheck className="w-5 h-5 text-[var(--accent)]" />
      </div>

      <h1 className="text-xl font-bold text-[var(--foreground)] mb-1">
        {isEnrolling ? "Set up two-factor authentication" : "Verify it’s you"}
      </h1>
      <p className="text-sm text-[var(--foreground-muted)] mb-6">
        {isEnrolling
          ? "Use an authenticator app such as 1Password, Google Authenticator, or Microsoft Authenticator."
          : "Enter the code from your authenticator app to continue to the portal."}
      </p>

      {loading ? (
        <p className="text-sm text-[var(--foreground-subtle)]">Loading security settings…</p>
      ) : enrollment ? (
        <div className="space-y-5">
          <div className="rounded-xl bg-white p-3 mx-auto w-fit">
            <img src={enrollment.qrCode} alt="Scan this QR code with your authenticator app" className="w-44 h-44" />
          </div>
          <div className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2.5">
            <p className="text-xs text-[var(--foreground-subtle)] mb-1">Can’t scan the code? Enter this setup key instead.</p>
            <p className="font-mono text-xs text-[var(--foreground)] break-all select-all">{enrollment.secret}</p>
          </div>
          <CodeForm code={code} setCode={setCode} submitting={submitting} onSubmit={verifyCode} />
        </div>
      ) : factorId ? (
        <CodeForm code={code} setCode={setCode} submitting={submitting} onSubmit={verifyCode} />
      ) : (
        <Button onClick={startEnrollment} loading={submitting} className="w-full" size="lg">
          <KeyRound className="w-4 h-4" /> Set up authenticator app
        </Button>
      )}

      {error && <p className="mt-4 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2.5">{error}</p>}

      <button
        type="button"
        onClick={signOut}
        className="mt-5 w-full text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" /> Sign out
      </button>
    </div>
  );
}

function CodeForm({
  code,
  setCode,
  submitting,
  onSubmit,
}: {
  code: string;
  setCode: (code: string) => void;
  submitting: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        pattern="[0-9]{6}"
        placeholder="Six-digit code"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full px-4 py-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-center tracking-[0.35em] font-mono text-lg text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] placeholder:tracking-normal placeholder:font-sans placeholder:text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all"
      />
      <Button type="submit" loading={submitting} className="w-full" size="lg">
        Verify and continue
      </Button>
    </form>
  );
}
