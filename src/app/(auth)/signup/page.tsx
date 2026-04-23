"use client";

import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 animate-fade-in text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-4">
        <ShieldCheck className="w-7 h-7 text-[var(--accent)]" />
      </div>
      <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Invite-only access</h1>
      <p className="text-sm text-[var(--foreground-muted)] mb-1 leading-relaxed">
        RBRANDRSPHERE is a private client portal.
      </p>
      <p className="text-sm text-[var(--foreground-muted)] mb-6 leading-relaxed">
        Accounts are created by your account manager. If you believe you should have access, get in touch.
      </p>
      <a
        href="mailto:hello@rbrandr.com"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Contact RBRANDR
      </a>
      <div className="mt-6 pt-6 border-t border-[var(--border)]">
        <Link href="/login" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--accent)] transition-colors">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
