import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, static assets
     * - /api/auth/callback (handles its own Supabase session — running
     *   updateSession here would call getUser() before cookies are set)
     * - /api/cron (machine-to-machine, authenticated by CRON_SECRET)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/auth/callback|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
