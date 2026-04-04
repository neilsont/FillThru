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
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center gap-2 px-4 h-16 border-b border-white/10">
        <Rocket className="h-6 w-6 text-primary shrink-0" />
        {!sidebarCollapsed && (
          <span className="font-bold text-lg tracking-tight">CareerLaunch</span>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-white/10">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
