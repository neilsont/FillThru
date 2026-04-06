import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

// Use service role key so webhook can bypass RLS
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (!userId || !session.customer || !session.subscription) break;

      await supabase.from("user_subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) break;

      await supabase.from("user_subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: sub.customer as string,
        stripe_subscription_id: sub.id,
        status: sub.status === "active" ? "active" : "inactive",
        current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("user_subscriptions")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
