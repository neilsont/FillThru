import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/onboarding";

    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      console.error("Auth callback exchange error:", error);
    }

    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  } catch (error) {
    console.error("Auth callback error:", error);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }
}
