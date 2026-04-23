import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    color: "text-[var(--foreground-muted)]",
    bg: "bg-zinc-800",
    dot: "bg-zinc-500",
  },
  in_review: {
    label: "In Review",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    dot: "bg-amber-400",
  },
  approved: {
    label: "Approved",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-400",
    bg: "bg-red-400/10",
    dot: "bg-red-400",
  },
  published: {
    label: "Published",
    color: "text-[var(--accent)]",
    bg: "bg-[var(--accent-subtle)]",
    dot: "bg-[var(--accent)]",
  },
} as const;

export type ContentStatus = keyof typeof STATUS_CONFIG;
