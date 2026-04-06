import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      const successHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"/><title>Redirecting...</title></head>
        <body>
          <script>window.location.replace("${origin}${next}");</script>
        </body>
      </html>
      `;

      if (!error) {
        return new NextResponse(successHtml, { headers: { "Content-Type": "text/html" } });
      }

      // Retry once for mobile browsers with cookie timing issues
      await new Promise((r) => setTimeout(r, 500));
      const { error: retryError } = await supabase.auth.exchangeCodeForSession(code);
      if (!retryError) {
        return new NextResponse(successHtml, { headers: { "Content-Type": "text/html" } });
      }

      console.error("Auth callback exchange error:", retryError);
    }

    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  } catch (error) {
    console.error("Auth callback error:", error);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
}
