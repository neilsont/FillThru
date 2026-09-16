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

  const QUESTION_DATA_ATTR = "data-cl-question-id";
  let questionCounter = 0;

  function normalizeText(text) {
    return (text ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function addUniqueText(list, text) {
    const normalized = normalizeText(text);
    if (normalized && !list.includes(normalized)) {
      list.push(normalized);
    }
  }

  function getNumericAttribute(element, name) {
    const value = parseInt(element.getAttribute(name) || "", 10);
    return Number.isFinite(value) ? value : null;
  }

  function isRequiredField(element) {
    return element.required || element.getAttribute("aria-required") === "true";
  }

  function nextQuestionId(prefix) {
    questionCounter += 1;
    return `cl-${prefix}-${questionCounter}`;
  }

  function tagQuestionElements(elements, prefix) {
    const targets = Array.isArray(elements) ? elements.filter(Boolean) : [elements].filter(Boolean);
    const existing = targets.find((element) => element.getAttribute(QUESTION_DATA_ATTR))?.getAttribute(QUESTION_DATA_ATTR);
    const questionId = existing || nextQuestionId(prefix);

    for (const element of targets) {
      element.setAttribute(QUESTION_DATA_ATTR, questionId);
    }

    return questionId;
  }

  function dispatchTextEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setElementTextValue(element, text) {
    const tag = element.tagName.toLowerCase();
    if (tag === "textarea") {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(element, text);
      else element.value = text;
      dispatchTextEvents(element);
      return true;
    }

    if (tag === "input") {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(element, text);
      else element.value = text;
      dispatchTextEvents(element);
      return true;
    }

    if (element.isContentEditable) {
      element.textContent = text;
      dispatchTextEvents(element);
      return true;
    }

    return false;
  }

  async function simulateTyping(element, text) {
    element.focus();
    setElementTextValue(element, text);
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

    return normalizeText(texts.filter(Boolean).join(" "));
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

  function getDescribedByText(element) {
    const ids = (element.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .map((id) => id.trim())
      .filter(Boolean);

    return normalizeText(
      ids
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ")
    );
  }

  function getSanitizedContainerText(element) {
    const container = element.closest("fieldset, [role='group'], [role='radiogroup'], section, li, form, div");
    if (!container) return "";

    const clone = container.cloneNode(true);
    clone.querySelectorAll("input, textarea, select, button, svg, path, img, iframe").forEach((child) => child.remove());
    const text = normalizeText(clone.textContent || "");
    return text.length > 320 ? text.slice(0, 320) : text;
  }

  function isMachineLikeToken(token) {
    const value = normalizeText(token);
    if (!value) return false;

    if (/^q_[a-f0-9]{8,}$/i.test(value)) return true;
    if (/^:[a-z0-9-]+:$/i.test(value)) return true;
    if (/^(?:rich|text|question|input|textarea|editor|field|select|option|radio|checkbox)(?:[-_:][a-z0-9]+){1,}$/i.test(value)) {
      return true;
    }
    if (/^[a-z0-9_:-]{16,}$/i.test(value) && /\d/.test(value) && /[_:-]/.test(value)) {
      return true;
    }

    return false;
  }

  function stripMachineTokens(text) {
    const normalized = normalizeText(text);
    if (!normalized) return "";

    return normalizeText(
      normalized
        .split(" ")
        .filter((token) => !isMachineLikeToken(token))
        .join(" ")
    );
  }

  function stripCounterNoise(text) {
    return normalizeText(text)
      .replace(/\bword count\b[:\s-]*/gi, "")
      .replace(/\bcharacter count\b[:\s-]*/gi, "")
      .replace(/\b\d+\s*\/\s*\d+(?:\s*\/\s*\d+)*\b/g, " ")
      .replace(/\b(?:min(?:imum)?|max(?:imum)?)\s*:?\s*\d+\s*(?:words?|characters?)\b/gi, " ")
      .replace(/\b\d+\s*(?:words?|characters?)\b/gi, " ")
      .replace(/\(\s*\d+\s*\/\s*\d+(?:\s*\/\s*\d+)*\s*\)/g, " ")
      .replace(/\[\s*\d+\s*\/\s*\d+(?:\s*\/\s*\d+)*\s*\]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isCounterOnlyText(text) {
    const normalized = normalizeText(text);
    if (!normalized) return false;

    const withoutCounters = stripCounterNoise(normalized);
    if (!withoutCounters) return true;
    if (/^\d+\s*(?:words?|characters?)$/i.test(withoutCounters)) return true;

    return false;
  }

  function sanitizeQuestionText(text) {
    return stripCounterNoise(stripMachineTokens(text));
  }

  function isGenericPromptText(text) {
    const normalized = normalizeText(text).toLowerCase();
    if (!normalized) return true;

    if (/^(select|choose)(?:\s+(?:one|an?|your))?$/.test(normalized)) return true;
    if (/^(yes|no|n\/a|na|none|other|required|optional)$/.test(normalized)) return true;
    if (/^(yes\s*\/?\s*no|no\s*\/?\s*yes)$/.test(normalized)) return true;
    if (/^(true|false)\s*\/?\s*(true|false)$/.test(normalized)) return true;
    if (/^(male|female|other)$/.test(normalized)) return true;
    if (/^(agree|disagree)$/.test(normalized)) return true;

    return false;
  }

  function stripChoiceNoise(text, options = []) {
    let cleaned = sanitizeQuestionText(text);
    if (!cleaned) return "";

    const normalizedOptions = Array.from(
      new Set(
        options
          .map((option) => rewriteQuestionLabel(option))
          .map((option) => normalizeText(option))
          .filter(Boolean)
      )
    );

    if (normalizedOptions.length >= 2) {
      const optionPattern = normalizedOptions
        .map((option) => escapeRegExp(option))
        .join("|");

      cleaned = normalizeText(
        cleaned
          .replace(new RegExp(`(?:\\s*(?:${optionPattern})){2,}\\s*$`, "i"), "")
          .replace(new RegExp(`(?:^|\\s)(?:${optionPattern})(?:\\s+(?:${optionPattern}))+`, "gi"), " ")
      );
    }

    return cleaned;
  }

  function isMeaningfulPromptText(text, options = []) {
    const cleaned = stripChoiceNoise(text, options);
    if (!cleaned || cleaned.length < 6 || isCounterOnlyText(cleaned) || isGenericPromptText(cleaned)) {
      return false;
    }

    const normalizedOptions = Array.from(
      new Set(
        options
          .map((option) => normalizeText(rewriteQuestionLabel(option)).toLowerCase())
          .filter(Boolean)
      )
    );

    const normalized = cleaned.toLowerCase();
    if (normalizedOptions.length && normalizedOptions.includes(normalized)) {
      return false;
    }

    const compactOptions = normalizedOptions.join(" ").replace(/\s+/g, "");
    const compactPrompt = normalized.replace(/\s+/g, "");
    if (compactOptions && compactPrompt === compactOptions) {
      return false;
    }

    return true;
  }

  function getNearbyPromptText(element) {
    const candidates = [];
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < 5) {
      // Also check aria-labelledby on each ancestor — common pattern for radiogroup/group labels
      addUniqueText(candidates, getReferencedText(current, "aria-labelledby"));
      addUniqueText(candidates, current.getAttribute("aria-label"));

      let sibling = current.previousElementSibling;
      let siblingCount = 0;

      while (sibling && siblingCount < 3) {
        const tagName = sibling.tagName?.toLowerCase();
        if (!["script", "style"].includes(tagName)) {
          addUniqueText(candidates, sibling.textContent);
        }
        sibling = sibling.previousElementSibling;
        siblingCount += 1;
      }

      current = current.parentElement;
      depth += 1;
    }

    return candidates
      .map((candidate) => sanitizeQuestionText(candidate))
      .find((candidate) => candidate && !isCounterOnlyText(candidate) && candidate.length >= 10) || "";
  }

  function getVisibleQuestionLabel(element) {
    const candidates = [];

    if (element.id) {
      const explicitLabel = document.querySelector(`label[for="${element.id}"]`);
      if (explicitLabel) addUniqueText(candidates, explicitLabel.textContent);
    }

    const parentLabel = element.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input, textarea, select, button").forEach((child) => child.remove());
      addUniqueText(candidates, clone.textContent);
    }

    addUniqueText(candidates, element.closest("fieldset")?.querySelector("legend")?.textContent);
    addUniqueText(candidates, element.getAttribute("aria-label"));
    addUniqueText(candidates, element.getAttribute("placeholder"));
    addUniqueText(candidates, getDescribedByText(element));
    addUniqueText(candidates, getSanitizedContainerText(element));
    addUniqueText(candidates, getNearbyPromptText(element));

    for (const candidate of candidates) {
      const cleaned = sanitizeQuestionText(candidate);
      if (isMeaningfulPromptText(cleaned)) {
        return cleaned;
      }
    }

    const fallback = sanitizeQuestionText(getFieldLabel(element));
    return isMeaningfulPromptText(fallback) ? fallback : "";
  }

  function rewriteQuestionLabel(label) {
    return sanitizeQuestionText(label)
      .replace(/\s*[:*]+\s*$/, "")
      .replace(/^required\s+/i, "")
      .slice(0, 220);
  }

  function getFieldContext(element) {
    const label = rewriteQuestionLabel(getVisibleQuestionLabel(element));
    const placeholder = normalizeText(element.getAttribute("placeholder"));
    const describedBy = getDescribedByText(element);
    const containerText = getSanitizedContainerText(element);

    let helpText = containerText;
    if (helpText && label) {
      helpText = normalizeText(helpText.replace(label, ""));
    }
    if (helpText && describedBy) {
      helpText = normalizeText([describedBy, helpText].join(" "));
    } else {
      helpText = describedBy || helpText;
    }

    helpText = sanitizeQuestionText(helpText);
    if (helpText === label || isCounterOnlyText(helpText)) {
      helpText = "";
    }

    return {
      label,
      helpText: helpText.slice(0, 220),
      placeholder,
    };
  }

  function getChoiceLabel(input) {
    const texts = [
      input.getAttribute("aria-label"),
    ];

    if (input.id) {
      const explicitLabel = document.querySelector(`label[for="${input.id}"]`);
      if (explicitLabel) {
        addUniqueText(texts, explicitLabel.textContent);
      }
    }

    const parentLabel = input.closest("label");
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll("input, textarea, select").forEach((child) => child.remove());
      addUniqueText(texts, clone.textContent);
    }

    const wrapperText = getSanitizedContainerText(input);
    // Only use if it's short enough to plausibly be just the option label, not
    // the whole question block (which would pollute the options list).
    if (wrapperText && wrapperText.length <= 80) {
      addUniqueText(texts, wrapperText);
    }

    addUniqueText(texts, input.value);
    return rewriteQuestionLabel(texts.find(Boolean) || "");
  }

  function getReferencedText(element, attrName) {
    const ids = (element.getAttribute(attrName) || "")
      .split(/\s+/)
      .map((id) => id.trim())
      .filter(Boolean);

    return normalizeText(
      ids
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ")
    );
  }

  function getChoiceGroupPrompt(inputs, options = []) {
    const first = inputs[0];
    if (!first) return "";

    const candidates = [];
    const groupContainers = [];

    addUniqueText(candidates, first.closest("fieldset")?.querySelector("legend")?.textContent);
    addUniqueText(candidates, getReferencedText(first, "aria-labelledby"));
    addUniqueText(candidates, getDescribedByText(first));
    addUniqueText(candidates, getNearbyPromptText(first));

    let current = first.parentElement;
    let depth = 0;
    while (current && depth < 8) {
      if (inputs.every((input) => current.contains(input))) {
        groupContainers.push(current);
      }
      current = current.parentElement;
      depth += 1;
    }

    for (const container of groupContainers) {
      // Check aria-labelledby / aria-label on the container itself — this is the
      // standard ARIA pattern for radio groups (role="radiogroup" aria-labelledby="...")
      addUniqueText(candidates, getReferencedText(container, "aria-labelledby"));
      addUniqueText(candidates, container.getAttribute("aria-label"));

      const clone = container.cloneNode(true);
      clone.querySelectorAll("input, textarea, select, button, svg, path, img, iframe").forEach((child) => child.remove());
      addUniqueText(candidates, clone.textContent);

      let sibling = container.previousElementSibling;
      let siblingCount = 0;
      while (sibling && siblingCount < 3) {
        addUniqueText(candidates, sibling.textContent);
        sibling = sibling.previousElementSibling;
        siblingCount += 1;
      }
    }

    for (const candidate of candidates) {
      const cleaned = stripChoiceNoise(candidate, options);
      if (isMeaningfulPromptText(cleaned, options)) {
        return cleaned;
      }
    }

    const fallback = stripChoiceNoise(getFieldLabel(first), options);
    return isMeaningfulPromptText(fallback, options) ? fallback : "";
  }

  function getCurrentFieldValue(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === "select") {
      if (element.multiple) {
        return Array.from(element.selectedOptions).map((option) => normalizeText(option.textContent || option.value)).join(", ");
      }
      const selected = element.selectedOptions?.[0];
      return normalizeText(selected?.textContent || element.value);
    }

    if (element.isContentEditable) {
      return normalizeText(element.textContent);
    }

    return normalizeText(element.value);
  }

  function isEssayLikeField(element, label) {
    const tag = element.tagName.toLowerCase();
    const maxLength = getNumericAttribute(element, "maxlength");
    return (
      tag === "textarea" ||
      element.isContentEditable ||
      /cover.?letter|essay|motivation|tell us|describe|share|explain|summary|additional information|why do you/i.test(label) ||
      maxLength > 280
    );
  }

  function normalizeChoiceValue(text) {
    return normalizeText(text).toLowerCase().replace(/[^\w\s/-]/g, "");
  }

  function splitAnswerValues(value) {
    return normalizeText(value)
      .split(/\s*(?:\n|;|,|•)\s*/g)
      .map((part) => normalizeChoiceValue(part))
      .filter(Boolean);
  }

  function scoreChoiceMatch(choice, desired) {
    if (!choice || !desired) return 0;
    if (choice === desired) return 4;
    if (choice.includes(desired)) return 3;
    if (desired.includes(choice)) return 2;
    return 0;
  }

  function updateCheckedState(input, checked) {
    if (input.checked === checked) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
    if (setter) setter.call(input, checked);
    else input.checked = checked;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // ── Fill a single input ───────────────────────────────────────────────────

  function fillInput(input, value) {
    if (!value) return false;
    const tag = input.tagName.toLowerCase();

    if (tag === "select") {
      return fillSelect(input, value);
    }

    if (input.isContentEditable) {
      if (normalizeText(input.textContent) === normalizeText(value)) return false;
      return setElementTextValue(input, value);
    }

    if (tag === "textarea" || (tag === "input" && !["checkbox", "radio", "file", "submit", "button", "hidden"].includes(input.type))) {
      if (normalizeText(input.value) === normalizeText(value)) return false;
      return setElementTextValue(input, value);
    }

    return false;
  }

  function fillSelect(select, value) {
    const desiredValues = splitAnswerValues(value);
    if (!desiredValues.length) return false;

    if (select.multiple) {
      let changed = false;
      for (const option of select.options) {
        const normalizedOption = normalizeChoiceValue(option.text || option.value);
        const shouldSelect = desiredValues.some((desired) => scoreChoiceMatch(normalizedOption, desired) >= 2);
        if (option.selected !== shouldSelect) {
          option.selected = shouldSelect;
          changed = true;
        }
      }
      if (changed) {
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return changed;
    }

    let bestOption = null;
    let bestScore = 0;

    for (const option of select.options) {
      const normalizedOption = normalizeChoiceValue(option.text || option.value);
      for (const desired of desiredValues) {
        const score = scoreChoiceMatch(normalizedOption, desired);
        if (score > bestScore) {
          bestScore = score;
          bestOption = option;
        }
      }
    }

    if (bestOption && select.value !== bestOption.value) {
      select.value = bestOption.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  function fillRadioGroup(inputs, value) {
    const desired = splitAnswerValues(value)[0];
    if (!desired) return false;

    let bestInput = null;
    let bestScore = 0;
    for (const input of inputs) {
      const choice = normalizeChoiceValue(getChoiceLabel(input) || input.value);
      const score = scoreChoiceMatch(choice, desired);
      if (score > bestScore) {
        bestScore = score;
        bestInput = input;
      }
    }

    if (!bestInput || bestInput.checked) return false;
    bestInput.click();
    if (!bestInput.checked) {
      updateCheckedState(bestInput, true);
    }
    return true;
  }

  function fillCheckboxGroup(inputs, value) {
    const desiredValues = splitAnswerValues(value);
    if (!desiredValues.length) return false;

    let changed = false;
    for (const input of inputs) {
      const choice = normalizeChoiceValue(getChoiceLabel(input) || input.value);
      const shouldCheck = desiredValues.some((desired) => scoreChoiceMatch(choice, desired) >= 2);
      const didChange = updateCheckedState(input, shouldCheck);
      changed = changed || didChange;
    }
    return changed;
  }

  function fillQuestionById(questionId, value) {
    const targets = Array.from(document.querySelectorAll(`[${QUESTION_DATA_ATTR}="${questionId}"]`));
    if (!targets.length) {
      return { ok: false, error: "Input not found on page" };
    }

    const first = targets[0];
    let filled = false;

    if (first.type === "radio") {
      filled = fillRadioGroup(targets, value);
    } else if (first.type === "checkbox") {
      filled = fillCheckboxGroup(targets, value);
    } else if (first.tagName.toLowerCase() === "select") {
      filled = fillSelect(first, value);
    } else {
      filled = fillInput(first, value);
    }

    return { ok: true, changed: filled };
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

  function detectUnknownFields() {
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
      // ── Indeed job search results OR Indeed Apply ─────────────────────────
      const panel =
        document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
        document.querySelector(".jobsearch-JobInfoHeader-title") ||
        document.querySelector('[data-testid="job-title"]') ||
        document.querySelector(".ia-JobInfoHeader-title") ||
        document.querySelector('[class*="jobTitle"] h1') ||
        document.querySelector('[class*="JobInfoHeader"] h1') ||
        document.querySelector("h1.icl-u-xs-mb--xs");

      title = panel?.textContent?.trim() || "";

      // Company name
      const companyEl =
        document.querySelector('[data-testid="inlineHeader-companyName"] a') ||
        document.querySelector('[data-testid="inlineHeader-companyName"]') ||
        document.querySelector('[data-testid="company-name"]') ||
        document.querySelector(".ia-JobInfoHeader-company") ||
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
      const el = document.querySelector('[class*="company"], [class*="employer"], [class*="Employer"], [data-testid="company-name"]');
      company = el?.textContent?.trim() || "";
      
      // Fallback: Try to get company from title if it's "Job Title - Company Name"
      if (!company && document.title.includes(" - ")) {
        const parts = document.title.split(" - ");
        if (parts.length > 1) company = parts[parts.length - 1].trim();
      }
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

    if (!title || !company) return null;
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
  const OVERLAY_ROOT_ID = "cl-overlay-root";
  let overlayContainer = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  function getOverlayRoots() {
    return Array.from(document.querySelectorAll(`#${OVERLAY_ROOT_ID}`));
  }

  function syncOverlayReference() {
    const roots = getOverlayRoots();
    overlayContainer = roots[0] || null;

    if (roots.length > 1) {
      roots.slice(1).forEach((root) => root.remove());
    }

    return overlayContainer;
  }

  async function toggleOverlay() {
    const existingOverlay = syncOverlayReference();
    if (existingOverlay) {
      removeOverlay();
    } else {
      await injectOverlay();
    }
  }

  async function injectOverlay() {
    if (syncOverlayReference()) return;

    // Create the host element for Shadow DOM
    overlayContainer = document.createElement("div");
    overlayContainer.id = OVERLAY_ROOT_ID;
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
        right: 56px;
        height: 48px;
        cursor: grab;
        z-index: 10;
        background: transparent;
      }
      .drag-handle:active { cursor: grabbing; }
    `;
    shadow.appendChild(style);

    // Drag Handle
    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.addEventListener("mousedown", startDrag);
    shadow.appendChild(handle);

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
    getOverlayRoots().forEach((root) => root.remove());
    overlayContainer = null;
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

  // ── Advanced Question Scanner ──────────────────────────────────────────────
  // Scans the page for custom prompts, essays, selects, radios, and checkboxes
  // that are not already handled by the standard autofill field matcher.

  function buildQuestionRecord(elements, config = {}) {
    const targets = Array.isArray(elements) ? elements.filter(Boolean) : [elements].filter(Boolean);
    const primary = targets[0];
    if (!primary || !isVisible(primary)) return null;

    const context = getFieldContext(primary);
    const label = rewriteQuestionLabel(config.label || context.label || context.placeholder);
    if (!label || label.length < 6 || label.length > 500) return null;

    const mappedField = matchField(label);
    const isCoverLetter = Boolean(config.isCoverLetter || mappedField === "cover_letter" || mappedField === "summary");
    if (mappedField && !isCoverLetter) return null;

    const currentValue = Array.isArray(config.currentValue)
      ? normalizeText(config.currentValue.join(", "))
      : normalizeText(config.currentValue ?? (targets.length === 1 ? getCurrentFieldValue(primary) : ""));

    return {
      id: tagQuestionElements(targets, config.prefix || "question"),
      label,
      rewrittenLabel: rewriteQuestionLabel(config.rewrittenLabel || label),
      helpText: normalizeText(config.helpText || context.helpText).slice(0, 220),
      type: config.type || (isEssayLikeField(primary, label) ? "essay" : "short_answer"),
      fillMode: config.fillMode || (primary.isContentEditable ? "contenteditable" : primary.tagName.toLowerCase()),
      options: (config.options || []).map((option) => rewriteQuestionLabel(option)).filter(Boolean),
      required: typeof config.required === "boolean" ? config.required : isRequiredField(primary),
      maxLength: typeof config.maxLength === "number" ? config.maxLength : getNumericAttribute(primary, "maxlength"),
      minLength: typeof config.minLength === "number" ? config.minLength : getNumericAttribute(primary, "minlength"),
      placeholder: context.placeholder || "",
      isCoverLetter,
      isFilled: typeof config.isFilled === "boolean" ? config.isFilled : Boolean(currentValue),
      currentValue,
    };
  }

  function dedupeQuestions(questions) {
    const unique = [];
    const seen = new Set();

    for (const question of questions) {
      const key = [
        normalizeText(question.label).toLowerCase(),
        question.type,
        question.options.join("|").toLowerCase(),
      ].join("::");

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(question);
      }
    }

    return unique;
  }

  function scanTextQuestions() {
    const questions = [];
    const selector = [
      "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=radio]):not([type=checkbox])",
      "textarea",
      "[contenteditable='true']",
    ].join(", ");

    const allInputs = document.querySelectorAll(selector);
    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i];
      if (!isVisible(input)) continue;
      if (input.isContentEditable && input.parentElement?.isContentEditable) continue;

      const context = getFieldContext(input);
      const label = context.label || context.placeholder;
      if (!label) continue;

      const question = buildQuestionRecord(input, {
        prefix: "text",
        type: isEssayLikeField(input, label) ? "essay" : "short_answer",
        fillMode: input.isContentEditable ? "contenteditable" : input.tagName.toLowerCase() === "textarea" ? "textarea" : "text",
      });

      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }

  function scanSelectQuestions() {
    const questions = [];
    const selects = document.querySelectorAll("select");

    for (const select of selects) {
      if (!isVisible(select)) continue;
      const options = Array.from(select.options)
        .map((option) => normalizeText(option.textContent || option.value))
        .filter((text) => text && !/^(select|choose|--|-)/i.test(text));

      if (!options.length) continue;

      const label = getVisibleQuestionLabel(select);
      if (!isMeaningfulPromptText(label, options)) continue;

      const question = buildQuestionRecord(select, {
        prefix: "select",
        label,
        type: select.multiple ? "multi_select" : "multiple_choice",
        fillMode: "select",
        options,
        currentValue: getCurrentFieldValue(select),
        isFilled: Boolean(getCurrentFieldValue(select)),
      });

      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }

  function scanChoiceGroups(inputType) {
    const groups = new Map();
    const inputs = document.querySelectorAll(`input[type="${inputType}"]`);

    inputs.forEach((input, index) => {
      if (!isVisible(input)) return;

      const groupLabel = normalizeText(
        input.closest("fieldset")?.querySelector("legend")?.textContent || getFieldLabel(input)
      );
      const key = [
        inputType,
        input.form?.id || input.form?.getAttribute("name") || "page",
        input.name || groupLabel || `standalone-${index}`,
      ].join("::");

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(input);
    });

    const questions = [];
    for (const groupInputs of groups.values()) {
      const options = Array.from(new Set(groupInputs.map((input) => getChoiceLabel(input)).filter(Boolean)));
      if (!options.length) continue;
      if (inputType === "checkbox" && options.length < 2) continue;

      const checkedLabels = groupInputs
        .filter((input) => input.checked)
        .map((input) => getChoiceLabel(input))
        .filter(Boolean);

      const label = getChoiceGroupPrompt(groupInputs, options);
      if (!isMeaningfulPromptText(label, options)) continue;

      const question = buildQuestionRecord(groupInputs, {
        prefix: inputType,
        label,
        type: inputType === "radio" ? "multiple_choice" : "multi_select",
        fillMode: inputType,
        options,
        currentValue: checkedLabels,
        isFilled: checkedLabels.length > 0,
        required: groupInputs.some((input) => isRequiredField(input)),
      });

      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }

  function scanForQuestions() {
    return dedupeQuestions([
      ...scanTextQuestions(),
      ...scanSelectQuestions(),
      ...scanChoiceGroups("radio"),
      ...scanChoiceGroups("checkbox"),
    ]);
  }

  // ── Message listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "CL_SCAN_QUESTIONS") {
      try {
        const qs = scanForQuestions();
        sendResponse({ questions: qs });
      } catch (err) {
        sendResponse({ error: err.message });
      }
      return true;
    }

    if (message.type === "CL_FILL_QUESTION") {
      const questionId = message.questionId || message.inputId;
      sendResponse(fillQuestionById(questionId, message.text || ""));
      return true;
    }
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
      } catch {
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

    if (message.type === "CL_DETECT_PAGE_STATE") {
      sendResponse(detectPageState());
      return true;
    }

    if (message.type === "CL_ADVANCE_PAGE") {
      sendResponse(advancePage());
      return true;
    }

    if (message.type === "CL_FIND_INDEED_JOBS") {
      sendResponse(findIndeedJobs(message.jobTypes || []));
      return true;
    }

    if (message.type === "CL_CLICK_INDEED_APPLY") {
      sendResponse(clickIndeedApply());
      return true;
    }
  });

  // ── Page state detection ───────────────────────────────────────────────────

  function detectPageState() {
    const bodyText = normalizeText(document.body?.innerText || "").toLowerCase();
    const url = window.location.href.toLowerCase();
    const title = normalizeText(document.title).toLowerCase();

    // Completion: application was submitted
    const completionPhrases = [
      "application submitted", "successfully applied", "application complete",
      "thank you for applying", "thanks for applying", "you've applied",
      "your application has been submitted", "application received",
      "application was sent", "we received your application",
    ];
    const isCompletionPage = completionPhrases.some((phrase) => bodyText.includes(phrase));

    // Detect blockers
    const blockers = detectBlockers();
    const hasBlocker = blockers.length > 0;
    const blockerType = hasBlocker ? blockers[0].blocker_type : null;

    // Application page: has visible form inputs, or URL/title hints at apply flow
    const visibleInputs = Array.from(
      document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select")
    ).filter((el) => isVisible(el));
    const hasForm = visibleInputs.length > 0;
    const urlHint = /apply|application|resume|questionnaire/i.test(url);
    const titleHint = /apply|application/i.test(title);
    const isApplicationPage = (hasForm || urlHint || titleHint) && !isCompletionPage;

    const jobInfo = (() => {
      try { return extractJobInfo(); } catch { return null; }
    })();

    return { isApplicationPage, isCompletionPage, hasBlocker, blockerType, jobInfo };
  }

  // ── Page advance (click Next / Continue / Submit) ─────────────────────────

  function advancePage() {
    const ADVANCE_PATTERN = /\b(next|continue|apply|submit|proceed|save and continue|review application)\b/i;
    const SKIP_PATTERN = /\b(back|cancel|close|decline|skip|exit|previous|no thanks)\b/i;

    // Priority 1: visible submit buttons whose text matches
    const buttons = Array.from(document.querySelectorAll(
      "button:not([disabled]), input[type='submit']:not([disabled]), a[role='button']"
    ));

    // Score candidates — prefer type=submit and exact label matches
    const candidates = buttons
      .filter((el) => isVisible(el))
      .map((el) => {
        const text = normalizeText(el.textContent || el.value || el.getAttribute("aria-label") || "");
        const isSubmit = el.tagName === "INPUT" || el.getAttribute("type") === "submit";
        const matchesAdvance = ADVANCE_PATTERN.test(text);
        const matchesSkip = SKIP_PATTERN.test(text);
        if (!matchesAdvance || matchesSkip) return null;
        return { el, text, score: isSubmit ? 2 : 1 };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      // Last resort: any visible submit button in a form
      const formSubmit = document.querySelector("form button[type='submit']:not([disabled]), form input[type='submit']:not([disabled])");
      if (formSubmit && isVisible(formSubmit)) {
        formSubmit.click();
        return { ok: true, method: "form-submit" };
      }
      return { ok: false, error: "No advance button found" };
    }

    candidates[0].el.click();
    return { ok: true, method: "button-click", label: candidates[0].text };
  }

  // ── Indeed job card scraping ───────────────────────────────────────────────

  const JOB_TYPE_MAP = {
    fulltime:   /full.?time/i,
    parttime:   /part.?time/i,
    contract:   /contract/i,
    temporary:  /temp(orary)?/i,
    internship: /intern(ship)?/i,
  };

  function findIndeedJobs(requestedTypes) {
    if (!window.location.hostname.includes("indeed.com")) {
      return { jobs: [], error: "Not on Indeed" };
    }

    // Indeed job cards use data-jk attribute as the unique job key
    const cards = Array.from(document.querySelectorAll("[data-jk], .job_seen_beacon, .jobsearch-SerpJobCard"));

    const jobs = [];
    for (const card of cards) {
      const jk = card.getAttribute("data-jk") || card.querySelector("[data-jk]")?.getAttribute("data-jk");
      const titleEl = card.querySelector("[data-testid='jobTitle'] a, .jobTitle a, h2 a, .title a");
      const companyEl = card.querySelector("[data-testid='company-name'], .companyName, .company");
      const locationEl = card.querySelector("[data-testid='text-location'], .companyLocation");
      const jobTypeEl = card.querySelector(".attribute_snippet, [data-testid='attribute_snippet_testid']");

      const title = normalizeText(titleEl?.textContent || "");
      const company = normalizeText(companyEl?.textContent || "");
      const location = normalizeText(locationEl?.textContent || "");
      const jobTypeText = normalizeText(card.textContent || "");
      const jobTypeBadge = normalizeText(jobTypeEl?.textContent || "");

      if (!title) continue;

      // Detect job type from badge or full card text
      let detectedType = "fulltime";
      for (const [key, pattern] of Object.entries(JOB_TYPE_MAP)) {
        if (pattern.test(jobTypeBadge) || pattern.test(jobTypeText)) {
          detectedType = key;
          break;
        }
      }

      // Filter by requested types if provided
      if (requestedTypes.length > 0 && !requestedTypes.includes(detectedType)) {
        continue;
      }

      const applyUrl = jk
        ? `https://www.indeed.com/viewjob?jk=${jk}`
        : (titleEl?.href || "");

      if (!applyUrl) continue;

      jobs.push({ title, company, location, jobType: detectedType, applyUrl, jk: jk || "" });
    }

    return { jobs };
  }

  // ── Click Indeed Apply / Easy Apply button ────────────────────────────────

  function clickIndeedApply() {
    // Try Easy Apply button first (stays on Indeed, no new tab)
    const easyApply = Array.from(document.querySelectorAll("button, a"))
      .filter((el) => isVisible(el))
      .find((el) => /easy\s*apply|apply\s*now|apply\s*on\s*indeed/i.test(normalizeText(el.textContent || "")));

    if (easyApply) {
      easyApply.click();
      return { ok: true, type: "easy_apply" };
    }

    // External apply link
    const externalApply = Array.from(document.querySelectorAll("a[href], button"))
      .filter((el) => isVisible(el))
      .find((el) => /apply/i.test(normalizeText(el.textContent || "")));

    if (externalApply) {
      externalApply.click();
      return { ok: true, type: "external" };
    }

    return { ok: false, error: "No apply button found on this page" };
  }

})();
