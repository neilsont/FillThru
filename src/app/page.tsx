import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { 
  Rocket, 
  FileText, 
  Brain, 
  Send, 
  ArrowRight, 
  LayoutDashboard, 
  Zap, 
  ShieldCheck, 
  Sparkles,
  MousePointer2
} from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#faf9f6] selection:bg-accent/30">
      {/* ── Navigation ────────────────────────────────────────────────────────── */}
      <header className="border-b border-border/40 glass-panel sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary shadow-lg shadow-primary/20">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-primary">CareerLaunch</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link href="#features" className="hover:text-primary transition-colors">Features</Link>
            <Link href="#extension" className="hover:text-primary transition-colors">Extension</Link>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Button size="sm" className="rounded-full shadow-md" asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="rounded-full" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button size="sm" className="rounded-full bg-accent hover:bg-accent/90 shadow-md" asChild>
                  <Link href="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero Section ────────────────────────────────────────────────────── */}
        <section className="relative pt-32 pb-20 px-6 overflow-hidden">
          {/* Ambient Background Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-primary/5 to-transparent blur-3xl -z-10 opacity-50" />
          
          <div className="max-w-4xl mx-auto text-center fade-in">
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-border/50 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm mb-8">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span>Next-Gen Job Application Assistant</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-primary leading-[1.05] mb-8">
              Land your dream job <br />
              <span className="text-gradient animate-pulse">with AI precision</span>
            </h1>
            
            <p className="text-xl text-muted-foreground/90 mb-10 leading-relaxed max-w-2xl mx-auto stagger-1">
              The only platform that combines a professional job tracker with a 
              powerful AI browser extension to auto-fill applications and 
              write tailored cover letters in seconds.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 stagger-2">
              <Button size="lg" className="rounded-full px-8 h-12 text-base font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-105" asChild>
                <Link href={user ? "/dashboard" : "/signup"}>
                  {user ? "Go to Dashboard" : "Start Applying Free"}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 h-12 text-base font-semibold glass-panel" asChild>
                <Link href="#extension">See how it works</Link>
              </Button>
            </div>
            
            {/* Social Proof Placeholder */}
            <div className="mt-16 pt-8 border-t border-border/20 stagger-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-6">Optimized for top job boards</p>
              <div className="flex flex-wrap justify-center items-center gap-10 opacity-40 grayscale contrast-125">
                <span className="font-bold text-xl">Indeed</span>
                <span className="font-bold text-xl">LinkedIn</span>
                <span className="font-bold text-xl">Greenhouse</span>
                <span className="font-bold text-xl">Lever</span>
                <span className="font-bold text-xl">Workday</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Grid ───────────────────────────────────────────────────── */}
        <section id="features" className="py-24 px-6 bg-white border-y border-border/40">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-primary mb-4">A complete toolkit for your career launch</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">Everything you need to manage the chaos of a job search in one elegant dashboard.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: FileText,
                  title: "Smart Profile Extraction",
                  description: "Upload your resume once. Our AI correctly maps every detail to a structured profile that's ready for any application.",
                  color: "bg-blue-500/10 text-blue-600"
                },
                {
                  icon: LayoutDashboard,
                  title: "Kanban Job Tracker",
                  description: "Keep track of every application status visually. No more messy spreadsheets or missed follow-ups.",
                  color: "bg-purple-500/10 text-purple-600"
                },
                {
                  icon: ShieldCheck,
                  title: "Centralized Vault",
                  description: "Store all your diverse application documents, certifications, and portfolio links in one secure, accessible location.",
                  color: "bg-green-500/10 text-green-600"
                },
              ].map((feature) => (
                <div key={feature.title} className="p-8 rounded-3xl border border-border/40 hover:border-accent/40 transition-all hover:shadow-lg group">
                  <div className={`inline-flex items-center justify-center h-12 w-12 rounded-2xl ${feature.color} mb-6 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Extension Showcase ──────────────────────────────────────────────── */}
        <section id="extension" className="py-24 px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/20 px-4 py-1 text-sm font-bold text-accent">
                  <Zap className="h-4 w-4" />
                  <span>The Magic Extension</span>
                </div>
                
                <h2 className="text-4xl md:text-5xl font-bold text-primary leading-tight">
                  Fill applications without <br />
                  <span className="text-accent underline decoration-accent/30 underline-offset-8">lifting a finger</span>
                </h2>
                
                <ul className="space-y-4">
                  {[
                    "One-click form auto-filling on top sites",
                    "AI-generated cover letters tailored to the job",
                    "Directly syncs with your CareerLaunch profile",
                    "Handles complex questions with smart logic"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-lg text-muted-foreground/80">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>

                <Button size="lg" className="rounded-full bg-primary shadow-xl stagger-2" asChild>
                  <Link href="/dashboard">Install Browser Extension</Link>
                </Button>
              </div>

              <div className="relative">
                {/* Mockup UI representation */}
                <div className="rounded-3xl border border-border/40 shadow-2xl p-8 bg-white relative z-10 overflow-hidden group">
                  <div className="flex items-center gap-2 mb-6 border-b border-border/40 pb-4">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                    <div className="ml-4 h-4 w-48 rounded bg-muted/60" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="h-4 w-1/3 bg-muted/40 rounded" />
                    <div className="h-10 w-full bg-muted/20 border border-border/40 rounded-lg flex items-center px-4">
                      <div className="h-3 w-32 bg-primary/40 rounded" />
                    </div>
                    
                    <div className="h-4 w-1/4 bg-muted/40 rounded pt-4" />
                    <div className="h-32 w-full bg-muted/20 border border-border/40 rounded-lg p-4">
                      <div className="h-3 w-full bg-muted/30 rounded mb-2" />
                      <div className="h-3 w-5/6 bg-muted/30 rounded mb-2" />
                      <div className="h-3 w-4/6 bg-muted/30 rounded" />
                    </div>
                  </div>

                  {/* Magic Cursor Animation Overlay */}
                  <div className="absolute top-1/2 left-1/2 w-48 h-12 bg-accent rounded-full shadow-2xl flex items-center justify-center text-white font-bold text-sm -translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform cursor-pointer">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Write with AI
                    <MousePointer2 className="h-4 w-4 ml-6 animate-pulse" />
                  </div>
                </div>
                
                {/* Decorative blobs */}
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-accent/10 rounded-full blur-3xl -z-10" />
                <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Final Call to Action ────────────────────────────────────────────── */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto rounded-[3rem] bg-primary p-12 md:p-20 text-center relative overflow-hidden shadow-2xl shadow-primary/40">
            <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.05)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.05)_75%,transparent_75%,transparent)] bg-[length:60px_60px] opacity-10" />
            
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 relative z-10">Ready to launch your career?</h2>
            <p className="text-primary-foreground/70 text-lg mb-10 max-w-xl mx-auto relative z-10">
              Join thousands of job seekers who are getting more interviews with less 
              manual work. Start today, for free.
            </p>
            
            <div className="relative z-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="rounded-full bg-accent hover:bg-accent/90 text-white px-10 h-14 text-lg font-bold shadow-2xl" asChild>
                <Link href={user ? "/dashboard" : "/signup"}>Get Started Now</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <footer className="py-16 px-6 border-t border-border/40 text-center">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                <Rocket className="h-3 w-3 text-white" />
              </div>
              <span className="font-bold text-primary">CareerLaunch</span>
            </div>
            
            <nav className="flex justify-center gap-8 mb-8 text-sm font-medium text-muted-foreground/60">
              <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-primary transition-colors">Contact Support</Link>
            </nav>

            <p className="text-muted-foreground/40 text-xs font-medium">
              Site Content &copy; 2026 Wilson Labs
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
