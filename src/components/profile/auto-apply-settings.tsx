"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Zap } from "lucide-react";

const LIMIT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export function AutoApplySettings() {
  const supabase = createClient();
  const { toast } = useToast();
  const [limit, setLimit] = useState<number>(10);
  const [totalApplied, setTotalApplied] = useState<number>(0);
  const [isPremium, setIsPremium] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("auto_apply_limit, auto_apply_count")
        .eq("id", user.id)
        .single();

      if (profile) {
        setLimit(profile.auto_apply_limit ?? 10);
        setTotalApplied(profile.auto_apply_count ?? 0);
      }

      // Admin email bypasses all paywalls
      const ADMIN_EMAIL = "taylorneilson0@gmail.com";
      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setIsPremium(true);
        setLoading(false);
        return;
      }

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .single();

      setIsPremium(
        sub?.status === "active" &&
        (!sub.current_period_end || new Date(sub.current_period_end) > new Date())
      );

      setLoading(false);
    }
    load();
  }, [supabase]);

  async function save() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ auto_apply_limit: limit })
        .eq("id", user.id);
      if (error) throw error;
      toast({ title: "Saved", description: `Auto-apply limit set to ${limit} applications.` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Could not save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Auto-Apply Settings
        </CardTitle>
        <CardDescription>
          Set how many jobs the extension autopilot applies to in one session.
          The first 10 are free — upgrade to unlock higher limits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            Total auto-applied so far: <strong>{totalApplied}</strong>
          </p>
          {!isPremium && totalApplied >= 10 && (
            <p className="text-sm text-destructive font-medium">
              Free limit reached. Upgrade to continue using Auto-Apply.
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Applications per session</label>
          <div className="flex flex-wrap gap-2">
            {LIMIT_OPTIONS.map((opt) => {
              const locked = !isPremium && opt > 10;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={locked}
                  onClick={() => !locked && setLimit(opt)}
                  className={[
                    "px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                    limit === opt
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted",
                    locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  {opt}
                  {locked && " 🔒"}
                </button>
              );
            })}
          </div>
          {!isPremium && (
            <p className="text-xs text-muted-foreground mt-2">
              Limits above 10 require a premium subscription.
            </p>
          )}
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
