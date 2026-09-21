import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Redirect unauthenticated users away from protected routes, remembering
  // where they were headed so sign-in can drop them back there.
  const protectedRoutes = ["/dashboard", "/profile", "/applications", "/questions", "/history", "/onboarding", "/chat"];
  const isProtected = protectedRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages (to `next` if it's a safe relative path)
  const authRoutes = ["/login", "/signup"];
  if (user && authRoutes.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = safeNext(request.nextUrl.searchParams.get("next"));
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
