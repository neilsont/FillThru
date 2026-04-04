import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Rocket, FileText, Brain, Send, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-full bg-white">
      <header className="border-b border-border/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary">
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-[15px]">CareerLaunch</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="py-24 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
              <Rocket className="h-3.5 w-3.5" />
              AI-Powered Job Applications
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-[1.1] mb-5">
              Land your dream job with{" "}
              <span className="text-primary">AI assistance</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl mx-auto">
              Upload your resume, discover matching jobs, and let AI generate
              tailored cover letters and auto-fill applications for you.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Start for free <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-muted/40 border-t border-b border-border/40">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  icon: FileText,
                  title: "Upload Resume",
                  description: "Upload your PDF resume and our AI extracts all your details into a structured profile.",
                },
                {
                  icon: Brain,
                  title: "AI-Powered Matching",
                  description: "Discover jobs, get match scores, and let AI generate tailored cover letters for each application.",
                },
                {
                  icon: Send,
                  title: "Apply with Confidence",
                  description: "Auto-filled applications with smart field mapping. Track everything in one Kanban board.",
                },
              ].map((feature) => (
                <div key={feature.title} className="text-center">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4 text-center">
          <p className="text-muted-foreground text-sm">
            Built with Next.js, Supabase & Claude AI
          </p>
        </section>
      </main>
    </div>
  );
}
