import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "error" | "purple";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        {
          "bg-zinc-800 text-zinc-300": variant === "default",
          "bg-[var(--accent-subtle)] text-[var(--accent)]": variant === "accent",
          "bg-emerald-400/10 text-emerald-400": variant === "success",
          "bg-amber-400/10 text-amber-400": variant === "warning",
          "bg-red-400/10 text-red-400": variant === "error",
          "bg-purple-400/10 text-purple-400": variant === "purple",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-zinc-500",
    in_review: "bg-amber-400",
    approved: "bg-emerald-400",
    rejected: "bg-red-400",
    published: "bg-[var(--accent)]",
    active: "bg-emerald-400",
    paused: "bg-amber-400",
    completed: "bg-zinc-500",
    pending: "bg-amber-400",
    signed: "bg-emerald-400",
    submitted: "bg-emerald-400",
  };

  return (
    <span
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full",
        colors[status] ?? "bg-zinc-500"
      )}
    />
  );
}
