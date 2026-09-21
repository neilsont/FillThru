import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat",
  description: "Chat with Fillthru — a job-search copilot that already knows your résumé, your saved answers, and the jobs you're tracking.",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
