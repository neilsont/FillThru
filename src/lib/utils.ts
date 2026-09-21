import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Only same-site paths may be used as a post-login destination (no open redirects). */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
