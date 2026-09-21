"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { OAuthButtons } from "./oauth-buttons";

interface SignupFormProps {
  /** Where to land after onboarding (e.g. /chat when they typed into the landing-page chat bar). */
  next?: string;
}

export function SignupForm({ next = "/dashboard" }: SignupFormProps) {
  const router = useRouter();
  const onboarding = next === "/dashboard" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agreed) {
      setError("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({ email, password });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push(onboarding);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>Get started with Fillthru in seconds</CardDescription>
      </CardHeader>
      <CardContent className="pb-0 space-y-4">
        <OAuthButtons next={onboarding} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
          </div>
        </div>
      </CardContent>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="agree"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
              required
            />
            <label htmlFor="agree" className="text-xs text-muted-foreground leading-snug cursor-pointer">
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="text-primary font-medium hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="text-primary font-medium hover:underline">
                Privacy Policy
              </Link>
              . I understand that Fillthru will store and process my resume and application data to provide its services.
            </label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className="w-full" disabled={loading || !agreed}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" /> Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={next === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(next)}`} className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
