"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

/** Compact light/dark switch — drop into a sidebar's bottom section. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";

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
