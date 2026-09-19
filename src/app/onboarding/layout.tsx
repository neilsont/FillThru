import { Rocket } from "lucide-react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Rocket className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold tracking-tight">Fillthru</span>
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
