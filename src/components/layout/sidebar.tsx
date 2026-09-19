"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import {
  LayoutDashboard,
  User,
  FileText,
  History,
  ChevronLeft,
  ChevronRight,
  Rocket,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/applications", label: "Applications", icon: FileText },
  { href: "/history", label: "Chat history", icon: History },
];

function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 py-3 space-y-0.5 px-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-white"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, setMobileMenuOpen } = useUIStore();

  return (
    <>
      {/* ── Mobile: overlay backdrop ───────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Mobile: slide-in drawer ────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <Rocket className="h-5 w-5 text-indigo-400 shrink-0" />
            <span className="font-semibold text-[15px] tracking-tight text-white">Fillthru</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
      </aside>

      {/* ── Desktop: persistent sidebar ────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-200 shrink-0",
          sidebarCollapsed ? "w-[60px]" : "w-60"
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 px-4 h-14 border-b border-white/10 hover:bg-sidebar-accent/40 transition-colors"
        >
          <Rocket className="h-5 w-5 text-indigo-400 shrink-0" />
          {!sidebarCollapsed && (
            <span className="font-semibold text-[15px] tracking-tight text-white">
              Fillthru
            </span>
          )}
        </Link>

        <NavLinks collapsed={sidebarCollapsed} />

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
    </>
  );
}
