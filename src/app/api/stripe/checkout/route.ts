import { createClient } from "@/lib/supabase/server";
import { getStripe, PREMIUM_PRICE_ID } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY || !PREMIUM_PRICE_ID) {
      return NextResponse.json({ error: "Stripe configuration is missing. Please add STRIPE_SECRET_KEY and STRIPE_PRICE_ID to your environment variables." }, { status: 500 });
    }

    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: sub?.stripe_customer_id ?? undefined,
      customer_email: sub?.stripe_customer_id ? undefined : user.email,
      line_items: [{ price: PREMIUM_PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?upgraded=1`,
      cancel_url: `${baseUrl}/profile`,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create checkout session" }, { status: 500 });
  }
}
