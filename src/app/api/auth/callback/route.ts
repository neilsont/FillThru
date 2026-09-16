import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { type CookieOptions } from "@supabase/ssr";

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");

    // Sanitize `next` — only allow relative paths to prevent open redirect
    const rawNext = searchParams.get("next") ?? "/dashboard";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

    if (!code) {
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }

    // Collect all cookies Supabase wants to set so we can attach them
    // explicitly to the redirect response. This is the only approach that
    // works reliably across all mobile browsers (iOS Safari, Android Chrome)
    // because `new NextResponse(html)` does NOT carry cookies from next/headers.
    const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.headers
              .get("cookie")
              ?.split(";")
              .map((c) => {
                const [name, ...rest] = c.trim().split("=");
                return { name: name.trim(), value: rest.join("=").trim() };
              }) ?? [];
          },
          setAll(toSet) {
            for (const cookie of toSet) {
              cookiesToSet.push(cookie);
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback exchange error:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }

    // Build a real redirect response and attach every Set-Cookie header
    // that Supabase produced. This is the only approach guaranteed to work
    // on mobile browsers where cookie propagation from Route Handlers is
    // unreliable with bare NextResponse instances.
    const response = NextResponse.redirect(`${origin}${next}`);
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options);
    }

    return response;
  } catch (error) {
    console.error("Auth callback error:", error);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
}
