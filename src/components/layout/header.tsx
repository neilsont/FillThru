"use client";

import { Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { UserMenu } from "./user-menu";

export function Header({ email }: { email: string }) {
  const { setMobileMenuOpen } = useUIStore();

  return (
    <header className="h-14 border-b bg-white flex items-center gap-3 px-4 md:px-6 shrink-0">
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Breadcrumbs />
      <div className="flex items-center gap-1 ml-auto">
        <UserMenu email={email} />
      </div>
    </header>
  );
}
