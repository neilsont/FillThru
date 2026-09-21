"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";

export type PlanInterval = "month" | "year";

export interface SubscriptionStatus {
  isPremium: boolean;
  reason: "admin" | "subscription" | "trial" | "trial_expired" | "inactive" | "signed_out";
  status: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  planInterval: PlanInterval | null;
  /** A Stripe customer exists, so "Manage billing" can open the portal. */
  hasBilling?: boolean;
}

export function useSubscription() {
  const [isPremium, setIsPremium] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const { toast } = useToast();

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/stripe/status");
      const data = (await res.json()) as SubscriptionStatus;
      setIsPremium(data.isPremium ?? false);
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch subscription status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  async function handleUpgrade(interval: PlanInterval = "month") {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        toast({
          title: "Checkout Error",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to connect to checkout.",
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  }

  return {
    isPremium,
    status,
    isTrialing: status?.reason === "trial",
    trialDaysLeft: status?.trialDaysLeft ?? null,
    isLoading,
    upgrading,
    handleUpgrade,
    refreshStatus: checkStatus,
  };
}
