import { SignupForm } from "@/components/auth/signup-form";
import { safeNext } from "@/lib/utils";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <SignupForm next={safeNext(next)} />;
}
