"use client";

import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

export function Header({ email }: { email: string }) {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <Breadcrumbs />
      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserMenu email={email} />
      </div>
    </header>
  );
}
