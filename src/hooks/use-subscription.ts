"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";

export function useSubscription() {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const { toast } = useToast();

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/stripe/status");
      const data = await res.json();
      setIsPremium(data.isPremium ?? false);
    } catch (err) {
      console.error("Failed to fetch subscription status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
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
    isLoading,
    upgrading,
    handleUpgrade,
    refreshStatus: checkStatus,
  };
}
