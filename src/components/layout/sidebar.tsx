"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  notificationCount?: number;
}

export function Sidebar({ user, serviceType, notificationCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const navItems = getNav(serviceType);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const clientName = user.company_name ?? user.full_name;

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col z-40">
      {/* Logo + client name */}
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="RBRANDRSPHERE" width={28} height={28} className="flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[var(--foreground)] tracking-tight truncate">{clientName}</p>
            <p className="text-[10px] text-[var(--foreground-subtle)] uppercase tracking-widest">Client Portal</p>
          </div>
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
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
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
  );
}
