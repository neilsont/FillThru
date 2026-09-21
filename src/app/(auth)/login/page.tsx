import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/utils";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm next={safeNext(next)} />;
}
