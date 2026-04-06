import Link from "next/link";
import { Rocket } from "lucide-react";

export const metadata = {
  title: "Terms of Service — CareerLaunch",
};

export default function TermsOfServicePage() {
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
        <h1 className="text-4xl font-extrabold text-primary mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">Last updated: April 5, 2026</p>

        <div className="prose prose-neutral max-w-none space-y-10 text-[15px] leading-relaxed text-foreground/80">

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using CareerLaunch (the &ldquo;Service&rdquo;), operated by Wilson Production, you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Service.
            </p>
            <p className="mt-3">
              These Terms apply to all visitors, users, and others who access or use the Service. We reserve the right to update these Terms at any time. Continued use after changes are posted constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">2. Description of Service</h2>
            <p>
              CareerLaunch is a job application management platform that provides:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>A job application tracker and Kanban-style dashboard</li>
              <li>AI-powered resume parsing and cover letter generation</li>
              <li>A browser extension for auto-filling job applications</li>
              <li>Supplemental profile storage for common application questions</li>
              <li>Premium AI model access via subscription</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">3. Eligibility</h2>
            <p>
              You must be at least 16 years of age to use the Service. By using CareerLaunch, you represent and warrant that you meet this requirement and that all information you provide is accurate and truthful.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">4. User Accounts</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must notify us immediately of any unauthorized use of your account at <a href="mailto:cosmispenguin2@gmail.com" className="text-primary underline">cosmispenguin2@gmail.com</a>.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Submit false, misleading, or fraudulent information on job applications</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the intellectual property rights of others</li>
              <li>Transmit malicious code, spam, or unauthorized advertising</li>
              <li>Attempt to gain unauthorized access to other accounts or systems</li>
              <li>Reverse engineer or attempt to extract the source code of the Service</li>
              <li>Use the Service for any commercial purpose without our prior written consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">6. Subscriptions and Payments</h2>
            <h3 className="font-semibold text-foreground mb-2">Free Tier</h3>
            <p>
              CareerLaunch offers a free tier with access to basic features and free AI models (Llama 3.3 70B via Groq, Qwen via OpenRouter).
            </p>
            <h3 className="font-semibold text-foreground mt-4 mb-2">Premium Subscription</h3>
            <p>
              The Premium plan provides access to advanced AI models (GPT-4o Mini, Gemini 2.0 Flash, Claude Haiku) for $9.99/month. Subscriptions automatically renew each billing period unless cancelled.
            </p>
            <h3 className="font-semibold text-foreground mt-4 mb-2">Cancellations and Refunds</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>You may cancel your subscription at any time through the billing portal in your profile.</li>
              <li>Cancellation takes effect at the end of the current billing period. No partial refunds are issued for unused time.</li>
              <li>Refund requests for exceptional circumstances should be directed to <a href="mailto:cosmispenguin2@gmail.com" className="text-primary underline">cosmispenguin2@gmail.com</a>.</li>
            </ul>
            <p className="mt-3">
              All payments are processed securely by Stripe. Wilson Production does not store your payment card information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">7. AI-Generated Content</h2>
            <p>
              CareerLaunch uses artificial intelligence to generate cover letters, application responses, and field suggestions. You acknowledge that:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>AI-generated content is provided as a starting point and may require your review and editing.</li>
              <li>You are solely responsible for the accuracy and truthfulness of any application you submit.</li>
              <li>We do not guarantee the quality, accuracy, or effectiveness of AI-generated content.</li>
              <li>You retain full ownership of content you create or upload to the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">8. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are and will remain the exclusive property of Wilson Production. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
            </p>
            <p className="mt-3">
              You retain ownership of all content you upload (resumes, documents, etc.). By uploading content, you grant us a limited, non-exclusive license to use it solely to provide the Service to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">9. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE. WE MAKE NO GUARANTEES REGARDING JOB PLACEMENT OR APPLICATION SUCCESS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WILSON PRODUCTION SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">11. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time, with or without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties. You may delete your account at any time from your account settings or by contacting support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes arising from these Terms shall be resolved through binding arbitration or in a court of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-primary mb-3">13. Contact</h2>
            <p>For questions about these Terms, please contact:</p>
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
