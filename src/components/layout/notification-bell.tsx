"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useQuestions } from "@/hooks/use-questions";

export function NotificationBell() {
  const { data: questions } = useQuestions(false);
  const count = questions?.length ?? 0;

  return (
    <Link
      href="/questions"
      className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
    >
      <Bell className="h-5 w-5 text-muted-foreground" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
