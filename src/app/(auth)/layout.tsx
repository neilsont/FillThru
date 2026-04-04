import { Rocket } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary">
          <Rocket className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">CareerLaunch</span>
      </Link>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
