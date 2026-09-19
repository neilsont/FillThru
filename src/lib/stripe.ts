import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-03-31.basil",
    });
  }
  return _stripe;
}

export type PlanInterval = "month" | "year";

// STRIPE_PRICE_ID is the legacy single (monthly) price; keep honoring it.
export const PRICE_IDS: Record<PlanInterval, string> = {
  month: process.env.STRIPE_PRICE_ID_MONTHLY ?? process.env.STRIPE_PRICE_ID ?? "",
  year: process.env.STRIPE_PRICE_ID_YEARLY ?? "",
};

/** @deprecated use PRICE_IDS.month */
export const PREMIUM_PRICE_ID = PRICE_IDS.month;

export function parseInterval(value: unknown): PlanInterval {
  return value === "year" ? "year" : "month";
}

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_APP_URL is not set");
    return "http://localhost:3000";
  }
  return url.replace(/\/$/, "");
}
