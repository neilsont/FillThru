import Link from "next/link";
import { Rocket, Mail, RefreshCw, KeyRound, Keyboard, Bookmark, CreditCard, Trash2, MessageSquare } from "lucide-react";

export const metadata = {
  title: "Support — Fillthru",
  description: "Get help with the Fillthru Chrome extension: sign-in, shortcuts, saving jobs, billing, and deleting your data.",
};

// Keep in sync with the address on the Privacy and Terms pages.
const SUPPORT_EMAIL = "cosmispenguin2@gmail.com";

const topics: { icon: typeof Rocket; title: string; body: string[] }[] = [
  {
    icon: RefreshCw,
    title: "The extension stopped working or the button doesn't appear",
    body: [
      "Open chrome://extensions, find Fillthru, and click the reload (↻) icon on its card. Then reload the tab you're on — pages that were already open keep an old copy of the extension until they're refreshed.",
      "If Fillthru isn't listed at all, reinstall it from the Chrome Web Store. Your account, resume, and history are stored with Fillthru, not in the extension, so nothing is lost.",
    ],
  },
  {
    icon: KeyRound,
    title: "It keeps asking me to sign in",
    body: [
      "Sign out from the ⋯ menu in the panel, then sign in again with Google. That refreshes your session on this browser and it will stay signed in afterwards.",
      "If you're signed in on fillthru.com but the extension isn't, they use separate sessions — sign in once in the extension too.",
    ],
  },
  {
    icon: Keyboard,
    title: "The keyboard shortcut doesn't work",
    body: [
      "Fillthru uses Option+F to show and open the panel and Option+X to close it (Alt+Shift+F / Alt+Shift+X on Windows and Linux).",
      "Chrome sometimes doesn't bind a shortcut if another extension already uses it. Open chrome://extensions/shortcuts, find Fillthru, and set the keys there. You can always click the Fillthru icon in the toolbar instead.",
    ],
  },
  {
    icon: Bookmark,
    title: "\"I couldn't find a job posting on this page\"",
    body: [
      "Save this job works on a job's own page (the listing or the application form). Search results and careers-site home pages aren't a single job, so there's nothing to save from them.",
      "On a site's \"My Applications\" page — Workday's candidate home, for example — Save this job imports every application listed there, active and inactive, with its current status.",
      "You can also just tell the assistant the job: \"save it — Systems Engineer at RTX\".",
    ],
  },
  {
    icon: CreditCard,
    title: "Trial, subscription, and billing",
    body: [
      "Every account starts with a 7-day free trial that includes everything, no card required. When it ends, the extension shows a Subscribe button that takes you to your Profile page.",
      "To change plans, update your card, or cancel, open your Profile page and click Manage billing. Cancelling keeps your access until the end of the period you've paid for.",
      "Receipts come from Stripe and charges appear as FILLTHRU on your statement.",
    ],
  },
  {
    icon: Trash2,
    title: "Deleting conversations, my resume, or my account",
    body: [
      "Conversations: open ⋯ → Chat history in the extension, or the Chat history page on fillthru.com, to delete one or clear all.",
      "Resume and saved answers: replace or remove them from your Profile page.",
      "Whole account: email us from the address on your account and we'll delete everything within 7 days.",
    ],
  },
];

export default function SupportPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Fillthru support")}&body=${encodeURIComponent(
    "What happened:\n\nWhich page/site were you on:\n\nExtension version (⋯ menu shows it):\n"
  )}`;

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <header className="border-b border-border/40 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14 px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary">
              <Rocket className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-primary">Fillthru</span>
          </Link>
          <Link href="/faq" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            FAQ
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-primary mb-3">Support</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Most problems have a one-minute fix below. If yours doesn&rsquo;t, email us — a real person answers, usually within one business day.
          </p>
          <a
            href={mailto}
            className="inline-flex items-center gap-2 mt-6 rounded-full bg-primary text-white px-6 h-11 font-semibold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
          >
            <Mail className="h-4 w-4" /> Email support
          </a>
          <p className="text-xs text-muted-foreground mt-3">{SUPPORT_EMAIL}</p>
        </div>

        <div className="space-y-4">
          {topics.map(({ icon: Icon, title, body }) => (
            <section key={title} className="rounded-xl border border-border/60 bg-white p-6">
              <h2 className="flex items-center gap-3 text-base font-semibold text-primary mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                {title}
              </h2>
              <div className="space-y-2 text-[15px] leading-relaxed text-foreground/80 pl-11">
                {body.map((p) => <p key={p}>{p}</p>)}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-xl border border-border/60 bg-white p-6">
          <h2 className="flex items-center gap-3 text-base font-semibold text-primary mb-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <MessageSquare className="h-4 w-4" />
            </span>
            When you write in, include
          </h2>
          <ul className="list-disc list-inside space-y-1 text-[15px] text-foreground/80 pl-11">
            <li>What you were trying to do and what happened instead</li>
            <li>The website you were on (a link is ideal)</li>
            <li>The extension version — open the ⋯ menu in the panel; it&rsquo;s at the bottom</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4 pl-11">
            Never send passwords. We&rsquo;ll never ask for one.
          </p>
        </section>

        <p className="text-center text-sm text-muted-foreground mt-12">
          <Link href="/faq" className="hover:text-primary">FAQ</Link>
          {" · "}
          <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" className="hover:text-primary">Terms of Service</Link>
        </p>
      </main>
    </div>
  );
}
