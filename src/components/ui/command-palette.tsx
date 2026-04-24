"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, CalendarDays, ImageIcon, FolderOpen,
  FileText, ScrollText, BarChart3, Ticket, MessageSquare, Milestone,
  BookOpen, Upload, Plus, UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GOTO_ITEMS = [
  { label: "Dashboard", route: "/dashboard", icon: LayoutDashboard },
  { label: "Content Calendar", route: "/calendar", icon: CalendarDays },
  { label: "All Content", route: "/content", icon: ImageIcon },
  { label: "Timeline", route: "/timeline", icon: Milestone },
  { label: "Brand Assets", route: "/assets", icon: FolderOpen },
  { label: "Documents", route: "/documents", icon: BookOpen },
  { label: "Forms", route: "/forms", icon: FileText },
  { label: "Contracts & T&Cs", route: "/contracts", icon: ScrollText },
  { label: "Reports", route: "/reports", icon: BarChart3 },
  { label: "Tickets", route: "/tickets", icon: Ticket },
  { label: "Feedback", route: "/feedback", icon: MessageSquare },
];

const ACTION_ITEMS = [
  { label: "Upload new brand asset", icon: Upload, hint: "⇧ U" },
  { label: "Submit new ticket", icon: Plus, hint: "N T" },
  { label: "Invite teammate", icon: UserPlus, hint: "" },
  { label: "Request new content", icon: MessageSquare, hint: "" },
];

// Stub — replace with real Supabase query
async function searchItems(_query: string) {
  return [];
}

type FlatItem = {
  group: string;
  label: string;
  icon: React.ElementType;
  hint?: string;
  onActivate: () => void;
};

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent text-[var(--accent)] font-bold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isMac, setIsMac] = useState(true);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setTimeout(() => triggerRef.current?.focus(), 10);
  }, []);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        const active = document.activeElement;
        const isExternalInput =
          active instanceof HTMLElement &&
          (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable) &&
          active !== inputRef.current;
        if (isExternalInput) return;
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) setQuery("");
          return !prev;
        });
      }
      if (e.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Scroll lock + autofocus
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Reset selection when query changes
  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Build flat item list filtered by query
  const q = query.toLowerCase();
  const gotoItems: FlatItem[] = GOTO_ITEMS
    .filter(item => !q || item.label.toLowerCase().includes(q) || "go to".includes(q))
    .map(item => ({
      group: "Go to",
      label: item.label,
      icon: item.icon,
      hint: item.route,
      onActivate: () => { router.push(item.route); close(); },
    }));

  const actionItems: FlatItem[] = ACTION_ITEMS
    .filter(item => !q || item.label.toLowerCase().includes(q) || "actions".includes(q))
    .map(item => ({
      group: "Actions",
      label: item.label,
      icon: item.icon,
      hint: item.hint,
      onActivate: () => close(),
    }));

  const allItems = [...gotoItems, ...actionItems];

  // Group for rendering with flat indices
  const groups: Record<string, { item: FlatItem; idx: number }[]> = {};
  allItems.forEach((item, idx) => {
    (groups[item.group] ??= []).push({ item, idx });
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      allItems[selectedIdx]?.onActivate();
    }
  }

  const modal = open ? (
    <div
      className="fixed inset-0 z-[200] flex justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", paddingTop: 100 }}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-[620px] max-w-[calc(100vw-32px)] h-fit bg-[var(--surface)] border border-[var(--border)] rounded-[14px] overflow-hidden animate-fade-in"
        style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(237,1,148,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search row */}
        <div className="flex items-center gap-3 px-[18px] py-4 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--foreground-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]"
          />
          <kbd className="text-[10px] px-[6px] py-0.5 border border-[var(--border)] rounded-[4px] bg-[var(--surface-2)] text-[var(--foreground-muted)] font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto py-2">
          {allItems.length === 0 ? (
            <p className="px-[18px] py-8 text-center text-sm text-[var(--foreground-subtle)]">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            Object.entries(groups).map(([group, entries]) => (
              <div key={group} className="py-1">
                <p className="px-[18px] py-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--foreground-subtle)]">
                  {group}
                </p>
                {entries.map(({ item, idx }) => {
                  const Icon = item.icon;
                  const isSelected = idx === selectedIdx;
                  return (
                    <button
                      key={idx}
                      onClick={item.onActivate}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-[18px] py-2.5 text-[13px] text-left transition-colors cursor-pointer",
                        isSelected ? "bg-[var(--accent-subtle)]" : "hover:bg-[var(--accent-subtle)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "flex-shrink-0",
                          isSelected ? "text-[var(--accent)]" : "text-[var(--foreground-muted)]"
                        )}
                        style={{ width: 15, height: 15 }}
                      />
                      <span className="flex-1 text-[var(--foreground)]">
                        <Highlight text={item.label} query={query} />
                      </span>
                      {item.hint && (
                        <span className="text-[11px] font-mono text-[var(--foreground-subtle)]">
                          {item.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-[18px] py-2.5 border-t border-[var(--border)] bg-[var(--surface-2)] text-[10px] text-[var(--foreground-subtle)]">
          <span>
            <kbd className="text-[9px] px-[5px] py-0.5 border border-[var(--border)] rounded-[3px] font-mono text-[var(--foreground-muted)] mr-1">↵</kbd>
            open
          </span>
          <span>
            <kbd className="text-[9px] px-[5px] py-0.5 border border-[var(--border)] rounded-[3px] font-mono text-[var(--foreground-muted)] mr-1">↑↓</kbd>
            navigate
          </span>
          <span className="ml-auto">
            <kbd className="text-[9px] px-[5px] py-0.5 border border-[var(--border)] rounded-[3px] font-mono text-[var(--foreground-muted)] mr-0.5">
              {isMac ? "⌘" : "Ctrl"}
            </kbd>
            <kbd className="text-[9px] px-[5px] py-0.5 border border-[var(--border)] rounded-[3px] font-mono text-[var(--foreground-muted)]">K</kbd>
            {" "}anywhere
          </span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => { setOpen(true); setQuery(""); }}
        aria-label="Open search (Command+K)"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2.5 h-9 px-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-muted)] text-xs min-w-[220px] max-w-[320px] hover:bg-[var(--surface-2)] hover:border-[var(--foreground-subtle)]/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]/30 transition-all duration-150 cursor-pointer"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left">Search everything…</span>
        <span className="flex items-center gap-0.5">
          <kbd className="text-[9px] px-[5px] py-0.5 border border-[var(--border)] rounded-[3px] font-mono">
            {isMac ? "⌘" : "Ctrl"}
          </kbd>
          <kbd className="text-[9px] px-[5px] py-0.5 border border-[var(--border)] rounded-[3px] font-mono">K</kbd>
        </span>
      </button>

      {/* Portal */}
      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
