import type { MetadataRoute } from "next";

const BASE = "https://fillthru.com";

// Public pages only — everything behind sign-in (dashboard, profile,
// applications, chat history) and /api is intentionally left out.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: new Date("2026-09-19"), changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, lastModified: new Date("2026-09-19"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
