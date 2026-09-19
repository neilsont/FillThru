import type { NextConfig } from "next";

const CANONICAL_HOST = "fillthru.com";
// Hosts the app used to live on. Pages redirect to fillthru.com; /api is
// left alone so extensions still on the old base URL keep working.
const LEGACY_HOSTS = ["www.fillthru.com", "careerlaunch1.vercel.app", "career-launch-taylorneilson-projects.vercel.app"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "www.google.com" },
    ],
  },
  async redirects() {
    return LEGACY_HOSTS.map((host) => ({
      source: "/:path((?!api/).*)",
      has: [{ type: "host" as const, value: host }],
      destination: `https://${CANONICAL_HOST}/:path`,
      permanent: true,
    }));
  },
};

export default nextConfig;
