"use client";

import { Bell, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/supabase/types";

interface TopbarProps {
  title: string;
  subtitle?: string;
  userId: string;
}

export function Topbar({ title, subtitle, userId }: TopbarProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function fetchNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) setNotifications(data);
  }

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-sm font-semibold text-[var(--foreground)]">{title}</h1>
        {subtitle && <p className="text-xs text-[var(--foreground-subtle)]">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative w-9 h-9 rounded-lg hover:bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-all duration-150 cursor-pointer"
          >
            <span className={unread > 0 ? "animate-bell-ring" : undefined}>
              <Bell className="w-4 h-4" />
            </span>
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--accent)] rounded-full" />
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/50 z-50 animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <p className="text-sm font-semibold">Notifications</p>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[var(--foreground-subtle)]">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 transition-colors",
                        !n.read && "bg-[var(--accent-subtle)]/40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
                        )}
                        <div className={cn(!n.read ? "" : "ml-3.5")}>
                          <p className="text-xs font-semibold text-[var(--foreground)]">{n.title}</p>
                          <p className="text-xs text-[var(--foreground-muted)] mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">
                            {formatDateTime(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
