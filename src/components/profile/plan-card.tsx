"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Sparkles } from "lucide-react";
import { useSubscription, type PlanInterval } from "@/hooks/use-subscription";
import { useToast } from "@/components/ui/toast";

interface PriceInfo { amount: number; currency: string; interval: PlanInterval }

function formatPrice(p: PriceInfo | undefined) {
  if (!p) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency.toUpperCase(), minimumFractionDigits: p.amount % 100 ? 2 : 0 }).format(p.amount / 100);
}

export function PlanCard() {
  const { status, isLoading, upgrading, handleUpgrade } = useSubscription();
  const [prices, setPrices] = useState<Partial<Record<PlanInterval, PriceInfo>>>({});
  const [portalLoading, setPortalLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/stripe/prices").then((r) => r.json()).then(setPrices).catch(() => {});
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast({ title: "Billing portal unavailable", description: data.error, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }

  const monthly = formatPrice(prices.month);
  const yearly = formatPrice(prices.year);
  const yearlyPerMonth = prices.year ? formatPrice({ ...prices.year, amount: Math.round(prices.year.amount / 12) }) : null;

  const subscribed = status?.reason === "subscription" || status?.reason === "admin";
  const trialing = status?.reason === "trial";
  const expired = status?.reason === "trial_expired" || status?.reason === "inactive";

  return (
    <Card id="plan" className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Plan
          </CardTitle>
          {!isLoading && subscribed && (
            <Badge className="bg-accent text-[10px]">Active{status?.planInterval ? ` · ${status.planInterval === "year" ? "Yearly" : "Monthly"}` : ""}</Badge>
          )}
          {!isLoading && trialing && (
            <Badge variant="outline" className="text-[10px] border-accent/40 text-accent">
              Free trial · {status?.trialDaysLeft} day{status?.trialDaysLeft === 1 ? "" : "s"} left
            </Badge>
          )}
          {!isLoading && expired && (
            <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Trial ended</Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          {subscribed
            ? `Everything is included. ${status?.currentPeriodEnd ? `Renews ${new Date(status.currentPeriodEnd).toLocaleDateString()}.` : ""}`
            : trialing
              ? "You have full access during your trial. Subscribe any time to keep it — you won't be charged until the trial ends."
              : "Subscribe to keep using the Fillthru extension: form filling, answers, cover letters, and Autopilot."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {subscribed ? (
          <Button variant="outline" size="sm" onClick={openPortal} disabled={portalLoading}>
            {portalLoading ? "Opening…" : "Manage billing"}
          </Button>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="h-auto flex-col items-start gap-0.5 py-3 rounded-lg"
              variant="outline"
              onClick={() => handleUpgrade("month")}
              disabled={upgrading || isLoading}
            >
              <span className="font-semibold">Monthly{monthly ? ` · ${monthly}/mo` : ""}</span>
              <span className="text-[11px] font-normal text-muted-foreground">Cancel any time</span>
            </Button>
            <Button
              className="h-auto flex-col items-start gap-0.5 py-3 rounded-lg bg-accent hover:bg-accent/90 text-white"
              onClick={() => handleUpgrade("year")}
              disabled={upgrading || isLoading}
            >
              <span className="font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Yearly{yearly ? ` · ${yearly}/yr` : ""}
              </span>
              <span className="text-[11px] font-normal text-white/80">{yearlyPerMonth ? `${yearlyPerMonth}/mo, billed yearly` : "Best value"}</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
