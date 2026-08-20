"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** "row" (icon + label, for a sidebar list) or "icon" (compact circular button, for a topbar). */
  variant?: "row" | "icon";
}

/** Light/dark switch. Defaults to a labeled row for a sidebar's bottom section. */
export function ThemeToggle({ className, variant = "row" }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";

  if (variant === "icon") {
    return (
      <button
        onClick={toggle}
        title={isLight ? "Switch to dark mode" : "Switch to light mode"}
        aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
        className={cn(
          "w-9 h-9 rounded-lg hover:bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all duration-150 cursor-pointer",
          className
        )}
      >
        {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-left transition-all duration-150 cursor-pointer text-[var(--foreground-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
        className
      )}
    >
      {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      {isLight ? "Dark mode" : "Light mode"}
    </button>
  );
}
