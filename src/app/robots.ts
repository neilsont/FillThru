import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/profile", "/applications", "/history", "/onboarding"],
    },
    sitemap: "https://fillthru.com/sitemap.xml",
  };
}
