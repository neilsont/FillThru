"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import {
  LayoutDashboard,
  User,
  FileText,
  MessageCircleQuestion,
  ChevronLeft,
  ChevronRight,
  Rocket,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/applications", label: "Applications", icon: FileText },
  { href: "/questions", label: "Questions", icon: MessageCircleQuestion },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-200 shrink-0",
        sidebarCollapsed ? "w-[60px]" : "w-60"
      )}
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-4 h-14 border-b border-white/10 hover:bg-sidebar-accent/40 transition-colors"
      >
        <Rocket className="h-5 w-5 text-indigo-400 shrink-0" />
        {!sidebarCollapsed && (
          <span className="font-semibold text-[15px] tracking-tight text-white">
            CareerLaunch
          </span>
        )}
      </Link>

      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-white/10">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full rounded-md px-3 py-2 text-[13px] text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-white transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
