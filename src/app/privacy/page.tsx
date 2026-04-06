import Link from "next/link";
import { Rocket } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — CareerLaunch",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <header className="border-b border-border/40 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center h-14 px-6 gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary">
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-primary">CareerLaunch</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-extrabold text-primary mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: April 5, 2026</p>

        <div className="prose prose-neutral max-w-none space-y-10 text-[15px] leading-relaxed text-foreground/80">

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">1. Introduction</h2>
            <p>
              Welcome to CareerLaunch, operated by Wilson Production (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and browser extension (collectively, the &ldquo;Service&rdquo;).
            </p>
            <p className="mt-3">
              By using CareerLaunch, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">2. Information We Collect</h2>
            <h3 className="font-semibold text-foreground mb-2">Information You Provide Directly</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Account registration details (email address, password)</li>
              <li>Resume and professional profile data (name, work history, education, skills, contact information)</li>
              <li>Supplemental application answers (work authorization, salary expectations, etc.)</li>
              <li>Job listings and application tracking data you add to the platform</li>
              <li>Payment information (processed and stored by Stripe — we do not store card numbers)</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-5 mb-2">Information Collected Automatically</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Usage data (pages visited, features used, session duration)</li>
              <li>Device and browser information (browser type, operating system, IP address)</li>
              <li>Log data (access times, error logs)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="font-semibold text-foreground mt-5 mb-2">Information from the Browser Extension</h3>
            <p>
              The CareerLaunch browser extension reads job posting content from pages you visit solely to assist with auto-filling applications. This data is processed in real time and is not stored on our servers unless you explicitly save a job to your dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Provide, operate, and improve the Service</li>
              <li>Auto-fill job applications on your behalf using your profile data</li>
              <li>Generate AI-powered cover letters and application responses</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send transactional emails (account verification, billing receipts)</li>
              <li>Respond to support inquiries</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your personal information to third parties. We do not use your resume or application data to train AI models without your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">4. How We Share Your Information</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li><strong>Supabase</strong> — database and authentication infrastructure</li>
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>AI providers</strong> (Anthropic, OpenAI, Google, Groq, OpenRouter) — only the data necessary to generate AI responses; governed by their respective data processing terms</li>
              <li><strong>Vercel</strong> — hosting and deployment infrastructure</li>
              <li><strong>Law enforcement</strong> — if required by applicable law or valid legal process</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">5. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data at any time by contacting us at{" "}
              <a href="mailto:cosmispenguin2@gmail.com" className="text-primary underline">cosmispenguin2@gmail.com</a>.
              Upon deletion, we will remove your data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">6. Security</h2>
            <p>
              We implement industry-standard security measures including encrypted data transmission (TLS), hashed passwords, and row-level security on our database. However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security of your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">7. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability (receive a copy of your data)</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at{" "}
              <a href="mailto:cosmispenguin2@gmail.com" className="text-primary underline">cosmispenguin2@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">8. Cookies</h2>
            <p>
              We use essential cookies to maintain your login session and preferences. We do not use third-party advertising cookies. You may disable cookies in your browser settings, but doing so may affect the functionality of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">9. Children&apos;s Privacy</h2>
            <p>
              CareerLaunch is not directed to individuals under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware that a child has provided us with personal data, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the &ldquo;Last updated&rdquo; date. Continued use of the Service after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">11. Contact Us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy, please contact us at:
            </p>
            <div className="mt-3 p-4 bg-white rounded-xl border border-border/50">
              <p className="font-semibold text-foreground">Wilson Production</p>
              <p>CareerLaunch Support</p>
              <a href="mailto:cosmispenguin2@gmail.com" className="text-primary underline">cosmispenguin2@gmail.com</a>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground/50 mt-16">
        &copy; 2026 Wilson Production. All rights reserved.{" "}
        <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>{" · "}
        <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
      </footer>
    </div>
  );
}
