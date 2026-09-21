import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "There's no billing account yet — subscribe first, then you can manage it here." }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fillthru.com";

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${baseUrl}/profile`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Most likely: no Customer Portal configuration saved in the Stripe dashboard for this mode.
    console.error("Stripe portal session failed:", err);
    const message = err instanceof Error ? err.message : "Could not open the billing portal";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
