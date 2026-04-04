"use client";

import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

export function Header({ email }: { email: string }) {
  return (
    <header className="h-16 border-b bg-white flex items-center justify-end gap-2 px-6">
      <NotificationBell />
      <UserMenu email={email} />
    </header>
  );
}
