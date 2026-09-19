import { getStripe } from "@/lib/stripe";
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
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getServiceClient();
  console.log(`[Stripe Webhook] Received event: ${event.id} type: ${event.type}`);

  // active / trialing → access. past_due → keep access while Smart Retries run
  // (Dashboard → Revenue Recovery decides when to cancel, which arrives as
  // customer.subscription.deleted). Anything else → no access.
  const getAppStatus = (stripeStatus: string) =>
    stripeStatus === "active" || stripeStatus === "trialing" || stripeStatus === "past_due" ? "active" : "inactive";

  // API 2025-03-31.basil: period end lives on the subscription item, and the
  // invoice → subscription link lives under invoice.parent.
  const periodEndOf = (sub: Stripe.Subscription) => {
    const end = sub.items?.data?.[0]?.current_period_end;
    return end ? new Date(end * 1000).toISOString() : null;
  };
  const intervalOf = (sub: Stripe.Subscription) => {
    const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
    return interval === "year" || interval === "month" ? interval : null;
  };
  const subscriptionIdOf = (invoice: Stripe.Invoice) => {
    const ref = invoice.parent?.subscription_details?.subscription;
    return typeof ref === "string" ? ref : ref?.id ?? null;
  };

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
        plan_interval: session.metadata?.plan_interval === "year" ? "year" : "month",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      let userId = sub.metadata?.user_id;

      // Fallback: If metadata is missing, look up the user by customer ID
      if (!userId) {
        const { data: userData } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", sub.customer as string)
          .single();
        userId = userData?.user_id;
      }

      if (!userId) {
        console.warn(`[Stripe Webhook] No user found for subscription: ${sub.id}`);
        break;
      }

      const status = getAppStatus(sub.status);
      console.log(`[Stripe Webhook] Updating sub: ${sub.id} user: ${userId} status: ${status}`);

      await supabase.from("user_subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: sub.customer as string,
        stripe_subscription_id: sub.id,
        status,
        current_period_end: periodEndOf(sub),
        plan_interval: intervalOf(sub),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.billing_reason === "subscription_create") break; // Handled by checkout.session.completed

      const subId = subscriptionIdOf(invoice);
      if (!subId) break;
      const { data: subData } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subId)
        .single();

      if (subData?.user_id) {
        await supabase
          .from("user_subscriptions")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subId);
      }
      break;
    }

    case "invoice.payment_failed": {
      // Don't cut access here: Stripe Smart Retries will re-attempt over the next
      // days and the subscription moves to past_due (still entitled). If every
      // retry fails, Stripe cancels it and customer.subscription.deleted fires.
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[Stripe Webhook] Payment failed for sub: ${subscriptionIdOf(invoice)} — awaiting Smart Retries.`);
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
