import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      loading = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          {
            "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-lg shadow-[var(--accent)]/20":
              variant === "primary",
            "bg-[var(--surface-2)] hover:bg-zinc-700 text-[var(--foreground)] border border-[var(--border)]":
              variant === "secondary",
            "hover:bg-[var(--surface-2)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]":
              variant === "ghost",
            "border border-[var(--border)] hover:border-[var(--accent)] text-[var(--foreground-muted)] hover:text-[var(--accent)]":
              variant === "outline",
            "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20":
              variant === "danger",
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2 text-sm": size === "md",
            "px-5 py-2.5 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
