"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, Users, Settings, LogOut, ChevronRight, Shield, Menu, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/admin/clients", icon: Users },
];

interface AdminSidebarProps {
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("avatar_url").eq("id", user.id).single().then(({ data }) => {
      if (data?.avatar_url !== undefined) setAvatarUrl(data.avatar_url);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[var(--surface)] border-b border-[var(--border)] flex items-center px-4 z-50">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <Image src="/logo.svg" alt="RBRANDR" width={24} height={24} />
        </div>
        <div className="w-9" />
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

    <aside className={cn(
      "fixed left-0 top-0 h-full w-60 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col z-50 transition-transform duration-300 ease-in-out",
      mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="RBRANDRSPHERE" width={28} height={28} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-[var(--foreground)] tracking-tight truncate">RBRANDRSPHERE</p>
              <span className="beta-pill flex-shrink-0">Beta</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Shield className="w-2.5 h-2.5 text-[var(--accent)]" />
              <p className="text-[10px] text-[var(--accent)] uppercase tracking-widest font-semibold">Admin</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden ml-auto p-1 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                active
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                  : "text-[var(--foreground-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  active ? "text-[var(--accent)]" : "text-[var(--foreground-subtle)] group-hover:text-[var(--foreground-muted)]"
                )}
              />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto text-[var(--accent)] opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--border)] p-3 space-y-1">
        <Link
          href="/admin/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            pathname === "/admin/settings"
              ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
              : "text-[var(--foreground-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>

        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-[var(--accent)]">
                {getInitials(user.full_name)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--foreground)] truncate">{user.full_name}</p>
            <p className="text-[10px] text-[var(--accent)] truncate font-medium">Super Admin</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-[var(--foreground-subtle)] hover:text-red-400 transition-colors duration-150 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
