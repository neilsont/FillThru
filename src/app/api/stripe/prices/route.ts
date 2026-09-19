import { getStripe, PRICE_IDS, type PlanInterval } from "@/lib/stripe";
import { NextResponse } from "next/server";

interface PriceInfo {
  amount: number; // smallest currency unit
  currency: string;
  interval: PlanInterval;
}

// Prices rarely change; avoid a Stripe round-trip on every profile view.
let cache: { at: number; data: Partial<Record<PlanInterval, PriceInfo>> } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data);
  }

  const data: Partial<Record<PlanInterval, PriceInfo>> = {};
  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = getStripe();
    await Promise.all(
      (Object.keys(PRICE_IDS) as PlanInterval[]).map(async (interval) => {
        const id = PRICE_IDS[interval];
        if (!id) return;
        try {
          const price = await stripe.prices.retrieve(id);
          if (price.unit_amount != null) {
            data[interval] = { amount: price.unit_amount, currency: price.currency, interval };
          }
        } catch (err) {
          console.error(`Could not load ${interval}ly price ${id}:`, err);
        }
      })
    );
  }

  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
