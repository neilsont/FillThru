import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Rocket, FileText, Brain, Send } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-full">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">CareerLaunch</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="py-24 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Rocket className="h-4 w-4" />
              AI-Powered Job Applications
            </div>
            <h1 className="text-5xl font-bold tracking-tight mb-6">
              Land your dream job with{" "}
              <span className="text-primary">AI assistance</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Upload your resume, discover matching jobs, and let AI generate
              tailored cover letters and auto-fill applications for you.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">Start for free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 mb-4">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Upload Resume</h3>
                <p className="text-muted-foreground text-sm">
                  Upload your PDF resume and our AI extracts all your details into a structured profile.
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 mb-4">
                  <Brain className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">AI-Powered Matching</h3>
                <p className="text-muted-foreground text-sm">
                  Discover jobs, get match scores, and let AI generate tailored cover letters for each application.
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-primary/10 mb-4">
                  <Send className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Apply with Confidence</h3>
                <p className="text-muted-foreground text-sm">
                  Auto-filled applications with smart field mapping. Track everything in one Kanban board.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
