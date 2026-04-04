import { Rocket } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-slate-50 px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Rocket className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold tracking-tight">CareerLaunch</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
