import Link from "next/link";
import { Rocket, ChevronDown } from "lucide-react";

export const metadata = {
  title: "FAQ — CareerLaunch",
};

const faqs: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: "Getting Started",
    items: [
      {
        q: "What is CareerLaunch?",
        a: "CareerLaunch is an AI-powered job application platform. It combines a job tracker dashboard with a browser extension that auto-fills applications using your saved resume and profile data. You can also generate tailored cover letters with AI in seconds.",
      },
      {
        q: "How do I get started?",
        a: "Create a free account at careerlaunch.app, upload your resume on the Profile page, and the AI will automatically extract your information. Install the browser extension, log in, and you're ready to start auto-filling job applications.",
      },
      {
        q: "Is CareerLaunch free to use?",
        a: "Yes. The core features — job tracking, resume parsing, cover letter generation, and browser extension auto-fill — are all free using our free-tier AI models (Llama 3.3 70B and Qwen 3.6 Plus). A Premium subscription ($9.99/month) unlocks access to advanced AI models including GPT-4o Mini, Gemini 2.0 Flash, and Claude Haiku.",
      },
      {
        q: "What browsers does the extension support?",
        a: "The CareerLaunch browser extension is available for Google Chrome and Chromium-based browsers (Edge, Brave, Arc). Firefox support is planned for a future release.",
      },
    ],
  },
  {
    category: "Account & Login",
    items: [
      {
        q: "I can't log in — what should I do?",
        a: "First, make sure you're using the correct email and password. If you signed up with Google, use the 'Continue with Google' button instead of email/password. If you've forgotten your password, contact support at cosmispenguin2@gmail.com and we'll help you reset it.",
      },
      {
        q: "How do I change my email or password?",
        a: "Email and password changes are currently managed through Supabase auth. Please contact support at cosmispenguin2@gmail.com with your request and we'll assist you.",
      },
      {
        q: "How do I delete my account?",
        a: "To delete your account and all associated data, email cosmispenguin2@gmail.com with the subject 'Account Deletion Request'. We will process your request within 30 days.",
      },
      {
        q: "Can I use the same account on multiple devices?",
        a: "Yes. Your CareerLaunch account syncs across all devices. Log in on any browser and your jobs, applications, and profile will be up to date.",
      },
    ],
  },
  {
    category: "Resume & Profile",
    items: [
      {
        q: "What file formats are accepted for resume upload?",
        a: "We accept PDF (.pdf) and Microsoft Word (.docx, .doc) files up to 10 MB. For best results, use a text-based PDF or a Word document — image-only PDFs (scanned documents) cannot be parsed.",
      },
      {
        q: "My resume wasn't parsed correctly — what can I do?",
        a: "AI parsing isn't perfect. After uploading, you can manually edit your profile fields on the Profile page. For significantly better results, try uploading a Word document (.docx) version of your resume, or try a different AI model from the AI Model section on your profile.",
      },
      {
        q: "Can I upload multiple resumes?",
        a: "Currently, CareerLaunch stores one active resume per account. Uploading a new resume replaces the previous one. Multi-resume support is on our roadmap.",
      },
      {
        q: "What is the 'Supplemental Info' section?",
        a: "Supplemental Info stores answers to common application questions that aren't on your resume — things like work authorization status, salary expectations, willingness to relocate, and demographic questions. The browser extension uses these answers to auto-fill those fields during applications.",
      },
    ],
  },
  {
    category: "Browser Extension",
    items: [
      {
        q: "How does the auto-fill work?",
        a: "When you're on a job application page, click the CareerLaunch extension icon and press 'Fill Application'. The extension reads the form fields on the page and matches them to your saved profile data, filling in your name, contact info, work history, and more automatically.",
      },
      {
        q: "The extension isn't filling some fields — why?",
        a: "Some application platforms use custom or unusual form structures that our extension may not recognize. If fields are skipped, the extension will show you a list of what it couldn't fill. You can add those answers to your Supplemental Info so they're saved for future applications.",
      },
      {
        q: "Does the extension work on all job sites?",
        a: "The extension works on most standard job application forms including Greenhouse, Lever, Workday, Indeed, and many company career pages. Highly customized portals (some government or enterprise sites) may have limited support.",
      },
      {
        q: "How do I generate a cover letter with the extension?",
        a: "On any job page, click the CareerLaunch extension icon and select 'Write with AI'. The extension reads the job description and generates a tailored cover letter based on your profile. You can copy and paste it directly into the application.",
      },
      {
        q: "Why does the extension ask for access to all websites?",
        a: "The extension needs broad site access to detect job application forms on any employer's career site. It only activates when you click the extension icon — it does not run in the background on every page you visit.",
      },
    ],
  },
  {
    category: "AI Models & Premium",
    items: [
      {
        q: "What's the difference between free and premium AI models?",
        a: "Free models (Llama 3.3 70B via Groq, Qwen 3.6 Plus via OpenRouter) are fully capable for most resume parsing and cover letter tasks. Premium models (GPT-4o Mini, Gemini 2.0 Flash, Claude Haiku) are more powerful, may produce higher-quality output, and are better for complex or nuanced writing tasks.",
      },
      {
        q: "How do I upgrade to Premium?",
        a: "Go to your Profile page and scroll to the AI Model section. Click 'Upgrade to Premium' and you'll be taken to a secure Stripe checkout page. After payment, your account is upgraded instantly.",
      },
      {
        q: "How do I cancel my Premium subscription?",
        a: "Go to your Profile page, scroll to the billing section, and click 'Manage Billing'. This opens the Stripe billing portal where you can cancel, pause, or update your subscription. Your access continues until the end of the current billing period.",
      },
      {
        q: "Will I be charged automatically each month?",
        a: "Yes, Premium subscriptions renew automatically each month. You'll receive an email receipt from Stripe before each charge. Cancel anytime to stop future renewals.",
      },
    ],
  },
  {
    category: "Privacy & Security",
    items: [
      {
        q: "Is my resume data safe?",
        a: "Yes. Your resume and profile data is stored securely in our database with encryption at rest and row-level security (only you can access your own data). We do not sell your data or share it with employers. See our Privacy Policy for full details.",
      },
      {
        q: "Does CareerLaunch share my information with employers?",
        a: "No. CareerLaunch never contacts employers on your behalf or shares your information with them. All application submissions are done by you, in your browser.",
      },
      {
        q: "Is my payment information secure?",
        a: "All payments are processed by Stripe, a PCI-DSS Level 1 certified payment processor. CareerLaunch never sees or stores your card number.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <header className="border-b border-border/40 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14 px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary">
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-primary">CareerLaunch</span>
          </Link>
          <a
            href="mailto:cosmispenguin2@gmail.com"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            Contact Support
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-extrabold text-primary mb-3">Frequently Asked Questions</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Everything you need to know about CareerLaunch. Can&apos;t find your answer?{" "}
            <a href="mailto:cosmispenguin2@gmail.com" className="text-primary hover:underline">
              Contact our support team.
            </a>
          </p>
        </div>

        <div className="space-y-12">
          {faqs.map((section) => (
            <div key={section.category}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-4 px-1">
                {section.category}
              </h2>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-2xl border border-border/50 bg-white overflow-hidden"
                  >
                    <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none font-medium text-[15px] text-primary select-none hover:bg-muted/20 transition-colors">
                      {item.q}
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-6 pb-5 pt-1 text-[14px] leading-relaxed text-foreground/70 border-t border-border/30">
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl bg-primary p-10 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Still have questions?</h2>
          <p className="text-primary-foreground/70 mb-6 max-w-md mx-auto">
            Our support team is here to help. Send us an email and we&apos;ll get back to you as soon as possible.
          </p>
          <a
            href="mailto:cosmispenguin2@gmail.com"
            className="inline-flex items-center justify-center rounded-full bg-white text-primary font-semibold px-8 py-3 hover:bg-white/90 transition-colors"
          >
            cosmispenguin2@gmail.com
          </a>
        </div>
      </main>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground/50 mt-16">
        &copy; 2026 Wilson Production. All rights reserved.{" "}
        <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>{" · "}
        <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>{" · "}
        <Link href="/faq" className="hover:text-primary transition-colors">FAQ</Link>
      </footer>
    </div>
  );
}
