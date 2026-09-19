# Chrome Web Store listing — Applyr

Paste-ready copy for the Developer Dashboard. Keep in sync with `manifest.json`.

Build the upload zip with `npm run extension:package` → `build/careerlaunch-extension-v<version>.zip`.

---

## Store listing tab

**Name:** Applyr

**Summary:** taken from `description` in `manifest.json` (132 chars max) — not editable in the dashboard.

**Category:** Productivity

**Language:** English

**Description:**

Applyr is an in-page assistant that fills out forms, answers application questions, and writes cover letters using the profile and résumé you already built at Applyr. It works on any website — not just job boards.

How it works:
1. Sign in once with Google. You stay signed in on this browser.
2. On any page, click the Applyr icon or press Option+C (Alt+C on Windows). A small rocket button appears in the bottom-right corner.
3. Click the rocket to open the assistant and pick an action, or type a question.

What it can do:
• Fill out this form — fills everything it knows from your résumé and saved answers, then asks you in the chat for anything it doesn't know. Answer once and it remembers for next time.
• Write a cover letter — reads the job posting and writes a tailored letter; asks you if it needs more to go on.
• Save this job — one click to add the posting to your Applyr tracker.
• Translate this page — the whole page, on-device with Chrome's built-in translator, so nothing leaves your computer. Or select any text and ask "translate this".
• Ask Applyr — a chat that understands the page: "fill in the salary question with 120k", "do I have React experience?", "find me part-time frontend jobs in Austin", "apply to these".
• Add your résumé with the + button, right in the chat.
• Optional Autopilot from the chat: queue Indeed results and Applyr fills and submits them, pausing to ask you whenever a form needs an answer it doesn't have.
• Manual mode never submits — you review and click submit yourself.

Your data stays yours. The extension only reads a page when you use it, only talks to Applyr servers, and does not sell or share your information.

A free Applyr account is required: https://careerlaunch1.vercel.app

**Official URL / Homepage:** https://careerlaunch1.vercel.app
**Support URL:** https://careerlaunch1.vercel.app

### Graphic assets (upload as PNG or JPEG)

| Asset | Size | Required |
|---|---|---|
| Store icon | 128 × 128 | Yes — use `icons/icon128.png` |
| Screenshots (1–5) | 1280 × 800 or 640 × 400 | Yes, at least one |
| Small promo tile | 440 × 280 | Recommended |
| Marquee promo tile | 1400 × 560 | Optional |

Screenshot ideas: (1) popup signed-in state on a Greenhouse form, (2) a form mid-autofill, (3) the "missing fields" prompt, (4) job extracted into the tracker.

---

## Privacy practices tab

**Single purpose description:**
Auto-fill job application forms on any website using the user's saved Applyr profile and résumé data.

### Permission justifications

**storage**
Stores the user's sign-in session token and cached profile locally so they don't have to log in every time the popup opens.

**activeTab**
Lets the popup read the current tab's URL and form fields when the user clicks Auto-fill, so we can fill the application the user is looking at.

**scripting**
Injects the form-filling logic into the job application page (including application iframes) only when the user presses Auto-fill or starts an Autopilot run.

**webNavigation**
Job application forms are frequently embedded in iframes (Greenhouse, Lever, Indeed Apply). We use `webNavigation.getAllFrames` to locate those frames so the fill can reach fields inside them.

**notifications**
Autopilot runs in the background across several tabs. Desktop notifications tell the user when it pauses because a form needs their input, or when the queued applications are complete.

**identity**
Used for Google sign-in via `chrome.identity.launchWebAuthFlow`, so the user can authenticate with the same account they use on the Applyr website.

**clipboardWrite**
Lets the user copy an AI-generated answer to a screening question from the popup and paste it into a field the auto-fill couldn't reach.

**Host permission `<all_urls>`**
Job applications live on thousands of different domains — every company's own careers site plus ATS providers like Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters, and Indeed. A fixed domain list is not feasible. The content script is passive: it registers a message listener and does nothing until the user clicks Auto-fill in the popup or starts an Autopilot run from their dashboard. It does not read, collect, or transmit page content on its own.

**Remote code:** No, I am not using remote code. All JavaScript is bundled in the package.

### Data usage

Check these under "What user data do you plan to collect?":
- ☑ Personally identifiable information (name, email, phone, address — the user's own profile, used to fill forms)
- ☑ Authentication information (session token for the Applyr account)
- ☐ Personal communications — **leave unchecked**
- ☐ Location — **leave unchecked** (address is PII, not geolocation)
- ☐ Web history — **leave unchecked**
- ☐ User activity — **leave unchecked**
- ☐ Website content — check **only if** job-posting extraction is considered "collection" (it sends job title/company/description to Applyr when the user saves a job). Safer to check it and explain.

Certify all three:
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://careerlaunch1.vercel.app/privacy

---

## Post-upload checklist

1. **Copy the extension ID** from the dashboard once the upload finishes (it's assigned before publishing).
2. **Supabase → Authentication → URL Configuration → Redirect URLs** — add
   `https://<EXTENSION_ID>.chromiumapp.org/`
   Google sign-in from the store build will fail until this is done, because `chrome.identity.getRedirectURL()` is derived from the ID.
3. Optional: pin the ID for local dev by adding the `"key"` from the dashboard (Package → View public key) to `manifest.json`, so an unpacked load has the same ID as the store build.
4. Submit for review. Broad host permissions typically mean a few days to ~2 weeks.
