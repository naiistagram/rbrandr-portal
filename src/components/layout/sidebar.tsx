"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  CalendarDays,
  ImageIcon,
  FileText,
  ScrollText,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Ticket,
  MessageSquare,
  Milestone,
  BookOpen,
  Menu,
  X,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const SOCIAL_MEDIA_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Content Calendar", href: "/calendar", icon: CalendarDays },
  { label: "All Content", href: "/content", icon: ImageIcon },
  { label: "Timeline", href: "/timeline", icon: Milestone },
  { label: "Brand Assets", href: "/assets", icon: FolderOpen },
  { label: "Documents", href: "/documents", icon: BookOpen },
  { label: "Forms", href: "/forms", icon: FileText },
  { label: "Contracts & T&Cs", href: "/contracts", icon: ScrollText },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Tickets", href: "/tickets", icon: Ticket },
  { label: "Feedback", href: "/feedback", icon: MessageSquare },
];

const BRAND_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Brand Assets", href: "/assets", icon: FolderOpen },
  { label: "Timeline", href: "/timeline", icon: Milestone },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Tickets", href: "/tickets", icon: Ticket },
  { label: "Documents", href: "/documents", icon: BookOpen },
  { label: "Contracts & T&Cs", href: "/contracts", icon: ScrollText },
  { label: "Forms", href: "/forms", icon: FileText },
  { label: "Feedback", href: "/feedback", icon: MessageSquare },
];

const WEBSITE_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Brand Assets", href: "/assets", icon: FolderOpen },
  { label: "Timeline", href: "/timeline", icon: Milestone },
  { label: "Documents", href: "/documents", icon: BookOpen },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Tickets", href: "/tickets", icon: Ticket },
  { label: "Contracts & T&Cs", href: "/contracts", icon: ScrollText },
  { label: "Forms", href: "/forms", icon: FileText },
  { label: "Feedback", href: "/feedback", icon: MessageSquare },
];

const BOTH_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Content Calendar", href: "/calendar", icon: CalendarDays },
  { label: "All Content", href: "/content", icon: ImageIcon },
  { label: "Brand Assets", href: "/assets", icon: FolderOpen },
  { label: "Timeline", href: "/timeline", icon: Milestone },
  { label: "Documents", href: "/documents", icon: BookOpen },
  { label: "Forms", href: "/forms", icon: FileText },
  { label: "Contracts & T&Cs", href: "/contracts", icon: ScrollText },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Tickets", href: "/tickets", icon: Ticket },
  { label: "Feedback", href: "/feedback", icon: MessageSquare },
];

function getNav(serviceType?: string | null) {
  if (serviceType === "brand") return BRAND_NAV;
  if (serviceType === "website") return WEBSITE_NAV;
  if (serviceType === "both") return BOTH_NAV;
  return SOCIAL_MEDIA_NAV;
}

interface SidebarProps {
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    company_name: string | null;
  };
  serviceType?: string | null;
  clientRole?: "ceo" | "member";
  notificationCount?: number;
}

export function Sidebar({ user, serviceType, clientRole = "ceo", notificationCount = 0 }: SidebarProps) {
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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navItems = getNav(serviceType).filter(
    (item) => clientRole === "ceo" || item.href !== "/contracts"
  );

  void notificationCount;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const clientName = user.company_name ?? user.full_name;

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
        {/* spacer to balance hamburger */}
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
      "lg:translate-x-0",
      mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Logo + client name */}
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="RBRANDRSPHERE" width={28} height={28} className="flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-[var(--foreground)] tracking-tight truncate">{clientName}</p>
              <span className="beta-pill flex-shrink-0">Beta</span>
            </div>
            <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-widest">Client Portal</p>
          </div>
          {/* Mobile close button */}
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
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
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
              {active && (
                <ChevronRight className="w-3 h-3 ml-auto text-[var(--accent)] opacity-60" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--border)] p-3 space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            pathname === "/settings"
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
            <p className="text-[10px] text-[var(--foreground-subtle)] truncate">{user.company_name ?? user.email}</p>
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
