"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useQuestions } from "@/hooks/use-questions";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { data: questions } = useQuestions(false);
  const count = questions?.length ?? 0;

  return (
    <Link
      href="/questions"
      className={cn(
        "relative p-2 rounded-md hover:bg-secondary transition-colors",
        count > 0 && "animate-bell"
      )}
    >
      <Bell className="h-[18px] w-[18px] text-muted-foreground" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white animate-badge-pulse px-1">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
