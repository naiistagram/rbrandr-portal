"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function PreviewTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/admin/clients/${clientId}/preview`;
  const TABS = [
    { label: "Dashboard", href: base },
    { label: "Tickets", href: `${base}/tickets` },
    { label: "Contracts", href: `${base}/contracts` },
    { label: "Content", href: `${base}/content` },
  ];

  return (
    <div className="border-b border-[var(--border)] px-6 flex gap-1 overflow-x-auto flex-shrink-0">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              active
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
