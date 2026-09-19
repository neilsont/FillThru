import { createClient } from "@/lib/supabase/server";
import { getAppUrl, getStripe, parseInterval, PRICE_IDS } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const interval = parseInterval(body?.interval);
    const priceId = PRICE_IDS[interval];

    if (!process.env.STRIPE_SECRET_KEY || !priceId) {
      return NextResponse.json(
        { error: `Stripe is not configured for the ${interval}ly plan. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_${interval === "year" ? "YEARLY" : "MONTHLY"}.` },
        { status: 500 }
      );
    }

    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (sub?.status === "active") {
      return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
    }

    const baseUrl = getAppUrl();

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      // No payment_method_types: Stripe picks card + Apple Pay / Google Pay / Link automatically.
      customer: sub?.stripe_customer_id ?? undefined,
      customer_email: sub?.stripe_customer_id ? undefined : user.email,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/profile?checkout=cancelled`,
      metadata: { user_id: user.id, plan_interval: interval },
      subscription_data: { metadata: { user_id: user.id, plan_interval: interval } },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    console.error("Stripe Checkout Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
