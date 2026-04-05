// CareerLaunch — Content Script
// Runs on every page. Listens for CL_AUTOFILL message from popup.
// Intelligently maps profile fields to form inputs and fills them.

(function () {
  "use strict";

  // ── Field mapping dictionary ──────────────────────────────────────────────
  // Maps canonical field names → arrays of label/name/placeholder patterns to match

  const FIELD_PATTERNS = {
    // Personal
    first_name:  [/first.?name/i, /given.?name/i, /fname/i],
    last_name:   [/last.?name/i, /surname/i, /family.?name/i, /lname/i],
    full_name:   [/full.?name/i, /your.?name/i, /applicant.?name/i, /^name$/i],
    email:       [/e.?mail/i, /email.?address/i],
    phone:       [/phone/i, /mobile/i, /cell/i, /telephone/i, /contact.?number/i],
    street_address: [/street.?address/i, /address.?line.?1/i, /address.?1/i, /^address$/i, /mailing.?address/i],
    location:    [/\bcity\b/i, /^location$/i, /current.?location/i, /where.?do.?you.?live/i],
    zip_code:    [/zip/i, /postal.?code/i, /zip.?code/i, /post.?code/i],
    linkedin:    [/linkedin/i, /linked.?in/i, /linkedin.?url/i, /linkedin.?profile/i],
    website:     [/website/i, /portfolio/i, /personal.?site/i, /web.?url/i, /github/i],

    // Work details
    current_title:      [/current.?title/i, /job.?title/i, /position/i, /role/i, /designation/i],
    years_experience:   [/years.?of.?exp/i, /how.?many.?years/i, /experience.?years/i, /total.?experience/i],
    salary_expectation: [/salary/i, /compensation/i, /expected.?pay/i, /desired.?salary/i, /pay.?expectations/i],

    // EEO / supplemental
    work_authorization: [/authorized.?to.?work/i, /work.?authorization/i, /eligible.?to.?work/i, /legally.?authorized/i, /visa.?status/i],
    sponsorship_needed: [/sponsor/i, /require.?sponsorship/i, /visa.?sponsor/i],
    willing_to_relocate:[/reloc/i, /willing.?to.?move/i, /open.?to.?reloc/i],
    gender:             [/^gender$/i, /sex/i],
    veteran_status:     [/veteran/i, /military/i],
    disability_status:  [/disability/i, /disabled/i],
    ethnicity:          [/ethnicity/i, /race/i],

    // Cover letter / free text
    cover_letter:       [/cover.?letter/i, /motivation/i, /why.?do.?you.?want/i, /tell.?us.?about.?yourself/i, /summary/i],
    summary:            [/professional.?summary/i, /brief.?bio/i, /about.?me/i, /bio/i],
  };

  async function simulateTyping(element, text) {
    element.focus();
    element.value = "";
    
    // Some sites need a value set directly AND an input event
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.blur();
  }

  // ── Extract value from profile for a given field ──────────────────────────

  function getValue(fieldName, profile, supplemental) {
    const p = profile?.personal ?? {};
    const exp = profile?.experience?.[0] ?? {};
    const supp = supplemental ?? {};

    const map = {
      first_name:          p.name?.split(" ")[0] ?? "",
      last_name:           p.name?.split(" ").slice(1).join(" ") ?? "",
      full_name:           p.name ?? "",
      email:               p.email ?? "",
      phone:               p.phone ?? "",
      street_address:      supp.street_address ?? "",
      location:            p.location ?? "",
      zip_code:            supp.zip_code ?? "",
      linkedin:            p.linkedin ?? "",
      website:             p.website ?? "",
      current_title:       exp.title ?? "",
      years_experience:    deriveYearsExp(profile?.experience),
      salary_expectation:  supp.salary_expectation ?? "",
      work_authorization:  supp.work_authorization ?? "",
      sponsorship_needed:  supp.sponsorship_needed ?? "",
      willing_to_relocate: supp.willing_to_relocate ?? "",
      gender:              supp.gender ?? "",
      veteran_status:      supp.veteran_status ?? "",
      disability_status:   supp.disability_status ?? "",
      ethnicity:           supp.ethnicity ?? "",
      cover_letter:        "",  // generated separately if needed
      summary:             profile?.summary ?? "",
    };

    return map[fieldName] ?? "";
  }

  function deriveYearsExp(experience) {
    if (!experience?.length) return "";
    const earliest = experience.reduce((min, e) => {
      const year = parseInt(e.start_date);
      return year && year < min ? year : min;
    }, 9999);
    if (earliest === 9999) return "";
    return String(new Date().getFullYear() - earliest);
  }

  // ── Field detection ───────────────────────────────────────────────────────

  function getFieldLabel(input) {
    // Try aria-label / placeholder / name / id
    const texts = [
      input.getAttribute("aria-label"),
      input.getAttribute("placeholder"),
      input.getAttribute("name"),
      input.getAttribute("id"),
      input.getAttribute("autocomplete"),
    ];

    // Try associated <label>
    if (input.id) {
      const lbl = document.querySelector(`label[for="${input.id}"]`);
      if (lbl) texts.push(lbl.textContent);
    }

    // Try parent label or nearest preceding text
    const parentLabel = input.closest("label");
    if (parentLabel) texts.push(parentLabel.textContent);

    // Nearest sibling / parent text
    const wrapper = input.closest("div, li, p, span");
    if (wrapper) {
      const clone = wrapper.cloneNode(true);
      clone.querySelectorAll("input, textarea, select, button").forEach((el) => el.remove());
      texts.push(clone.textContent);
    }

    return texts.filter(Boolean).join(" ");
  }

  function matchField(label) {
    for (const [fieldName, patterns] of Object.entries(FIELD_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(label)) return fieldName;
      }
    }
    return null;
  }

  function isVisible(el) {
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      el.offsetParent !== null
    );
  }

  // ── Fill a single input ───────────────────────────────────────────────────

  function fillInput(input, value) {
    if (!value) return false;
    const tag = input.tagName.toLowerCase();

    if (tag === "select") {
      return fillSelect(input, value);
    }

    if (tag === "textarea" || (tag === "input" && !["checkbox", "radio", "file", "submit", "button", "hidden"].includes(input.type))) {
      if (input.value === value) return false; // already filled
      // Native input value setter (works with React controlled inputs)
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
        || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
      } else {
        input.value = value;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }

    return false;
  }

  function fillSelect(select, value) {
    const val = value.toLowerCase();
    for (const option of select.options) {
      if (
        option.value.toLowerCase() === val ||
        option.text.toLowerCase() === val ||
        option.text.toLowerCase().includes(val) ||
        val.includes(option.text.toLowerCase())
      ) {
        if (select.value === option.value) return false;
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // ── Detect CAPTCHAs and blockers ───────────────────────────────────────────

  function detectBlockers() {
    const alerts = [];

    // CAPTCHA detection
    if (
      document.querySelector("iframe[src*='recaptcha']") ||
      document.querySelector("[class*='recaptcha']") ||
      document.querySelector("[data-sitekey]") ||
      document.querySelector("iframe[src*='hcaptcha']") ||
      document.querySelector("[class*='cf-challenge']")
    ) {
      alerts.push({
        blocker_type: "captcha",
        blocker_detail: "CAPTCHA detected — manual completion required",
        job_url: window.location.href,
        company: document.title,
      });
    }

    // File upload for resume
    const fileInputs = document.querySelectorAll('input[type="file"]');
    for (const fi of fileInputs) {
      const label = getFieldLabel(fi).toLowerCase();
      if (label.includes("resume") || label.includes("cv") || fi.accept?.includes("pdf")) {
        alerts.push({
          blocker_type: "file_upload",
          blocker_detail: "Resume file upload required — please upload your PDF manually",
          job_url: window.location.href,
          company: document.title,
        });
        break;
      }
    }

    // Identity verification
    if (
      document.body.textContent.match(/verify your identity|id verification|driver.?s license|passport/i)
    ) {
      alerts.push({
        blocker_type: "identity_verification",
        blocker_detail: "Identity verification required — manual action needed",
        job_url: window.location.href,
        company: document.title,
      });
    }

    return alerts;
  }

  // ── Unknown high-value fields ──────────────────────────────────────────────

  function detectUnknownFields(filledCount) {
    const alerts = [];
    const allInputs = document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]), textarea, select");
    const unknownLabels = [];
    for (const input of allInputs) {
      if (!isVisible(input)) continue;
      if (input.value?.trim()) continue; // already has value
      const label = getFieldLabel(input).trim();
      if (!label) continue;
      if (!matchField(label)) {
        // Deduplicate and keep short label
        const shortLabel = label.split(/[\n\r]/)[0].trim().slice(0, 60);
        if (shortLabel && !unknownLabels.includes(shortLabel)) {
          unknownLabels.push(shortLabel);
        }
      }
    }
    if (unknownLabels.length > 2) {
      alerts.push({
        blocker_type: "unknown_fields",
        blocker_detail: `Fields needing manual input: ${unknownLabels.slice(0, 5).join(" · ")}`,
        job_url: window.location.href,
        company: document.title,
      });
    }
    return alerts;
  }

  // ── Extract job info from the current page ────────────────────────────────
  // Handles Indeed's split-panel layout, Indeed Apply modal, and generic pages

  function extractJobInfo() {
    const host = window.location.hostname;
    const isIndeed = host.includes("indeed.com");

    let title = "", company = "", location = "", description = "", jobUrl = window.location.href;

    if (isIndeed) {
      // ── Indeed job search results (split panel) ────────────────────────────
      const panel =
        document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
        document.querySelector(".jobsearch-JobInfoHeader-title") ||
        document.querySelector('[class*="jobTitle"] h1') ||
        document.querySelector('[class*="JobInfoHeader"] h1') ||
        document.querySelector("h1.icl-u-xs-mb--xs");

      title = panel?.textContent?.trim() || "";

      // Company name
      const companyEl =
        document.querySelector('[data-testid="inlineHeader-companyName"] a') ||
        document.querySelector('[data-testid="inlineHeader-companyName"]') ||
        document.querySelector('[class*="companyName"]') ||
        document.querySelector(".jobsearch-CompanyInfoWithoutHeaderImage");
      company = companyEl?.textContent?.trim() || "";

      // Location
      const locationEl =
        document.querySelector('[data-testid="job-location"]') ||
        document.querySelector('[data-testid="inlineHeader-companyLocation"]') ||
        document.querySelector(".jobsearch-JobInfoHeader-subtitle [class*='location']");
      location = locationEl?.textContent?.trim() || "";

      // Job description text
      const descEl =
        document.querySelector('[id="jobDescriptionText"]') ||
        document.querySelector('[class*="jobsearch-jobDescriptionText"]') ||
        document.querySelector('[data-testid="jobDescriptionText"]');
      description = descEl?.innerText?.trim().slice(0, 2000) || "";

      // Try to get the canonical job URL from the selected job card
      const selectedCard = document.querySelector('[class*="job_seen_beacon"][class*="selected"] a[href*="clk"]') ||
        document.querySelector('a[data-jk][href*="/viewjob"]');
      if (selectedCard?.href) {
        try {
          const u = new URL(selectedCard.href, window.location.href);
          jobUrl = u.origin + u.pathname + (u.searchParams.get("jk") ? `?jk=${u.searchParams.get("jk")}` : "");
        } catch {}
      } else if (window.location.search.includes("jk=")) {
        const jk = new URLSearchParams(window.location.search).get("jk");
        if (jk) jobUrl = `https://www.indeed.com/viewjob?jk=${jk}`;
      }
    } else {
      // ── Generic / Greenhouse / Skillsoft ──────────────────────────────────
      title =
        document.querySelector("h1.app-title")?.innerText?.trim() ||
        document.querySelector("h1.neo--jobheading__title")?.innerText?.trim() ||
        document.querySelector("h1")?.innerText?.trim() ||
        document.querySelector(".job-title")?.innerText?.trim() ||
        document.querySelector('[class*="title" i]')?.innerText?.trim() || 
        "";

      company =
        document.querySelector('meta[property="og:site_name"]')?.content ||
        document.querySelector(".company-name")?.innerText?.trim() ||
        document.querySelector(".company")?.innerText?.trim() ||
        document.querySelector(".siteHeader__brand img")?.alt ||
        document.querySelector('[class*="company" i]')?.innerText?.trim() ||
        "";

      description =
        document.querySelector("#job-overview")?.innerText?.trim() ||
        document.querySelector(".description")?.innerText?.trim() ||
        document.querySelector("#job-description")?.innerText?.trim() ||
        document.querySelector('[class*="description" i]')?.innerText?.trim() ||
        "";
    }

    // ── Generic fallback for any site if specific ones failed ─────────────────
    if (!title) {
      const h1 = document.querySelector("h1");
      title = h1?.textContent?.trim() || document.title.replace(/\s*[-|–]\s*.*$/, "").trim();
    }
    if (!company) {
      const el = document.querySelector('[class*="company"], [class*="employer"], [class*="Employer"]');
      company = el?.textContent?.trim() || "";
    }
    if (!location) {
      const el = document.querySelector('[class*="location"], [class*="Location"]');
      location = el?.textContent?.trim() || "";
    }

    // Clean up title if it contains company info (e.g. "Software Engineer - Skillsoft")
    if (title && company && title.toLowerCase().includes(company.toLowerCase())) {
      title = title.split(/\s*[-|–]\s*/)[0].split(/\s+at\s+/i)[0].trim();
    }

    // Clean up titles that say "Apply for X" or have site branding appended
    title = title
      .replace(/^apply\s+(for\s+)?/i, "")
      .replace(/\s*[-|–]\s*(indeed|linkedin|glassdoor|google jobs?)$/i, "")
      .trim();

    // Fallback for description: get any large text block if id failed
    if (!description || description.length < 100) {
      const main = document.querySelector("main") || document.body;
      const paragraphs = Array.from(main.querySelectorAll("p, li")).map(p => p.textContent.trim());
      description = paragraphs.join("\n").slice(0, 3000);
    }

    return { title, company, location, description, url: jobUrl };
  }

  // ── Standard HTML autocomplete → field name map ───────────────────────────
  // Checked BEFORE label text so sites that use correct autocomplete attrs
  // are matched reliably (e.g. Indeed's zip field uses autocomplete="postal-code")

  const AUTOCOMPLETE_FIELD_MAP = {
    "given-name":    "first_name",
    "additional-name": "first_name",
    "family-name":   "last_name",
    "name":          "full_name",
    "email":         "email",
    "tel":           "phone",
    "tel-national":  "phone",
    "street-address":"street_address",
    "address-line1": "street_address",
    "address-level2":"location",  // city
    "postal-code":   "zip_code",
    "url":           "website",
  };

  // ── Main fill routine ──────────────────────────────────────────────────────

  // Supplemental-sourced fields — these can be answered from the popup
  const SUPPLEMENTAL_KEYS = new Set([
    "street_address", "zip_code", "salary_expectation", "work_authorization", "sponsorship_needed",
    "willing_to_relocate", "gender", "veteran_status", "disability_status", "ethnicity",
  ]);

  function autofill(profile, supplemental) {
    const inputs = document.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]), textarea, select"
    );

    let filled = 0;
    let skipped = 0;
    let coverLetterFound = false;
    const skippedFields = [];   // supplemental fields found on page but missing a saved answer
    const filledFields = {};    // track what we actually filled
    const seenKeys = new Set();

    for (const input of inputs) {
      if (!isVisible(input)) continue;

      // 1. Prefer explicit autocomplete attribute — more reliable than label text
      const autoComplete = input.getAttribute("autocomplete");
      const label = getFieldLabel(input);
      const fieldName = (autoComplete && AUTOCOMPLETE_FIELD_MAP[autoComplete])
        || matchField(label);

      if (fieldName === "cover_letter") coverLetterFound = true;
      if (!fieldName) continue;

      const value = getValue(fieldName, profile, supplemental);
      if (!value) {
        skipped++;
        // Capture supplemental fields so the popup can ask the user to fill them in
        if (SUPPLEMENTAL_KEYS.has(fieldName) && !seenKeys.has(fieldName)) {
          seenKeys.add(fieldName);
          const rawLabel = (label || "").split(/[\n\r]/)[0].trim().slice(0, 100);
          const pageLabel = rawLabel || fieldName.replace(/_/g, " ");
          const isSelect = input.tagName.toLowerCase() === "select";
          const options = isSelect
            ? Array.from(input.options)
                .map((o) => o.text.trim())
                .filter((t) => t && !/^(select|choose|--|-)/i.test(t))
            : [];
          skippedFields.push({ fieldName, pageLabel, options });
        }
        continue;
      }

      const didFill = fillInput(input, value);
      if (didFill) {
        filled++;
        filledFields[fieldName] = value;
      }
    }

    const blockerAlerts = detectBlockers();
    const unknownAlerts = filled === 0 ? [] : detectUnknownFields(filled);
    const jobInfo = extractJobInfo();

    return { filled, skipped, skippedFields, filled_fields: filledFields, alerts: [...blockerAlerts, ...unknownAlerts], no_fields: inputs.length === 0, jobInfo, coverLetterFound };
  }

  // ── Overlay Injection & State ─────────────────────────────────────────────
  let overlayContainer = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  async function toggleOverlay() {
    if (overlayContainer) {
      removeOverlay();
    } else {
      await injectOverlay();
    }
  }

  async function injectOverlay() {
    if (overlayContainer) return;

    // Create the host element for Shadow DOM
    overlayContainer = document.createElement("div");
    overlayContainer.id = "cl-overlay-root";
    // Basic styles for the container (will be overridden by position storage if exists)
    Object.assign(overlayContainer.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      width: "360px",
      height: "560px",
      zIndex: "2147483647",
      backgroundColor: "transparent",
      borderRadius: "12px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      overflow: "hidden",
      transition: "opacity 0.2s ease, transform 0.2s ease",
      userSelect: "none",
    });

    const shadow = overlayContainer.attachShadow({ mode: "open" });

    // Overlay styles
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .overlay-frame {
        width: 100%;
        height: 100%;
        border: none;
        background: #fff;
        border-radius: 12px;
      }
      .drag-handle {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 48px;
        cursor: grab;
        z-index: 10;
        background: transparent;
      }
      .drag-handle:active { cursor: grabbing; }
      .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 24px;
        height: 24px;
        background: rgba(0,0,0,0.05);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 20;
        font-family: system-ui;
        font-size: 14px;
        color: #666;
        transition: background 0.2s;
      }
      .close-btn:hover { background: rgba(0,0,0,0.1); }
    `;
    shadow.appendChild(style);

    // Drag Handle
    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.addEventListener("mousedown", startDrag);
    shadow.appendChild(handle);

    // Close button (redundant but nice if they want to close it)
    const closeBtn = document.createElement("div");
    closeBtn.className = "close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close CareerLaunch";
    closeBtn.onclick = removeOverlay;
    shadow.appendChild(closeBtn);

    // The Iframe
    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("popup.html");
    iframe.className = "overlay-frame";
    shadow.appendChild(iframe);

    document.body.appendChild(overlayContainer);
    
    // Restore position if saved
    const { overlayPos } = await chrome.storage.local.get("overlayPos");
    if (overlayPos) {
      overlayContainer.style.top = overlayPos.top;
      overlayContainer.style.right = "auto";
      overlayContainer.style.left = overlayPos.left;
    }
  }

  function removeOverlay() {
    if (overlayContainer) {
      overlayContainer.remove();
      overlayContainer = null;
    }
  }

  function startDrag(e) {
    isDragging = true;
    const rect = overlayContainer.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    overlayContainer.style.transition = "none";
    
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  }

  function onDrag(e) {
    if (!isDragging) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    overlayContainer.style.left = `${x}px`;
    overlayContainer.style.top = `${y}px`;
    overlayContainer.style.right = "auto";
  }

  async function stopDrag() {
    isDragging = false;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
    overlayContainer.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    
    // Save position
    await chrome.storage.local.set({
      overlayPos: {
        left: overlayContainer.style.left,
        top: overlayContainer.style.top
      }
    });
  }

  // ── Message listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "CL_AUTOFILL") {
      try {
        const result = autofill(message.profile, message.supplemental);
        sendResponse(result);
      } catch (err) {
        sendResponse({ filled: 0, skipped: 0, alerts: [], error: err.message });
      }
      return true; // async
    }

    if (message.type === "CL_TOGGLE_OVERLAY") {
      toggleOverlay().then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type === "CL_EXTRACT_JOB") {
      try {
        const info = extractJobInfo();
        sendResponse(info);
      } catch (err) {
        sendResponse(null);
      }
      return true;
    }

    if (message.type === "CL_FILL_COVER_LETTER") {
      const inputs = document.querySelectorAll("textarea, input:not([type=hidden])");
      for (const input of inputs) {
        const label = getFieldLabel(input);
        if (matchField(label) === "cover_letter") {
          simulateTyping(input, message.text);
          sendResponse({ ok: true });
          return true;
        }
      }
      sendResponse({ error: "No cover letter field found" });
      return true;
    }

    if (message.type === "CL_PING") {
      sendResponse({ ok: true, url: window.location.href });
      return true;
    }
  });

})();

