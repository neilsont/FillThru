// CareerLaunch Browser Extension — Popup
// Connects to CareerLaunch website and coordinates auto-fill

const DEFAULT_BASE_URL = "https://career-launch-taylorneilson-projects.vercel.app";
const BASE_URL_CANDIDATES = [
  DEFAULT_BASE_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const SUPABASE_URL = "https://jxricnvgdaktresxfwqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iyRuOLc1Nwwk_fb0frFVIQ_gDSBadVw";
let activeBaseUrl = DEFAULT_BASE_URL;

// ── DOM refs ────────────────────────────────────────────────────────────────
const viewLogin = document.getElementById("view-login");
const viewMain  = document.getElementById("view-main");
const loginError    = document.getElementById("login-error");
const btnLogin      = document.getElementById("btn-login");
const btnLogout     = document.getElementById("btn-logout");
const btnAutofill   = document.getElementById("btn-autofill");
const statusDot     = document.getElementById("status-dot");
const autofillBadge = document.getElementById("autofill-badge");
const fillResult    = document.getElementById("fill-result");
const pageHost      = document.getElementById("page-host");
const profileName    = document.getElementById("profile-name");
const resumeStatus   = document.getElementById("resume-status");
const avatarInitials = document.getElementById("avatar-initials");
const openDashboard  = document.getElementById("open-dashboard");
const missingSection = document.getElementById("missing-section");
const missingFields  = document.getElementById("missing-fields");
const btnSaveFill    = document.getElementById("btn-save-fill");
const btnClose       = document.getElementById("btn-close");
const alertsList    = document.getElementById("alerts-list");
const alertCount    = document.getElementById("alert-count");
const btnOpenAlerts = document.getElementById("btn-open-alerts");
const coverLetterSection = document.getElementById("cover-letter-section");
const btnMagicLetter     = document.getElementById("btn-magic-letter");
const aiAssistantSection = document.getElementById("ai-assistant-section");
const questionsSummary   = document.getElementById("questions-summary");
const questionActions    = document.getElementById("question-actions");
const customQuestionsDiv = document.getElementById("custom-questions");
const btnAnswerAll       = document.getElementById("btn-answer-all");
const btnFillAnswered    = document.getElementById("btn-fill-answered");
const btnCopyAll         = document.getElementById("btn-copy-all");

function setActiveBaseUrl(baseUrl) {
  activeBaseUrl = baseUrl;
  openDashboard.href = `${baseUrl}/dashboard`;
}

function getBaseUrlCandidates() {
  return [activeBaseUrl, ...BASE_URL_CANDIDATES.filter((baseUrl) => baseUrl !== activeBaseUrl)];
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text) return { data: null, text: "" };

  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { data: null, text };
  }
}

function buildResponseError(response, payload, fallbackMessage) {
  const isHtml = payload.text?.includes("<!DOCTYPE") || payload.text?.includes("<html");
  const message =
    payload.data?.error ||
    payload.data?.message ||
    (!isHtml && payload.text) ||
    fallbackMessage;

  const error = new Error(message || fallbackMessage);
  error.status = response.status;
  return error;
}

async function fetchCareerLaunch(path, init = {}, options = {}) {
  const candidates = options.baseUrls || getBaseUrlCandidates();
  let lastError = null;
  let lastResponse = null;
  let lastPayload = null;

  for (const baseUrl of candidates) {
    try {
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") ? 1500 : 5000);
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        setActiveBaseUrl(baseUrl);
        return { response, payload: await readResponsePayload(response), baseUrl };
      }

      const payload = await readResponsePayload(response);
      lastResponse = response;
      lastPayload = payload;

      if (response.status === 404 || response.status === 405 || response.status >= 500) {
        continue;
      }

      throw buildResponseError(response, payload, options.fallbackMessage || "Request failed");
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = new Error(options.timeoutMessage || "The request timed out. Please try again.");
        continue;
      }
      lastError = error;
    }
  }

  if (lastResponse) {
    throw buildResponseError(lastResponse, lastPayload || { data: null, text: "" }, options.fallbackMessage || "Request failed");
  }

  throw lastError || new Error(options.fallbackMessage || "Could not reach CareerLaunch");
}

setActiveBaseUrl(DEFAULT_BASE_URL);

// ── Message Relay (Fix for Injected Context) ─────────────────────────────────

async function relayToContent(payload) {
  try {
    return await chrome.runtime.sendMessage({ type: "CL_RELAY_TO_CONTENT", payload });
  } catch (err) {
    console.error("Relay failed:", err);
    return null;
  }
}

async function getTabInfo() {
  return await chrome.runtime.sendMessage({ type: "CL_GET_CURRENT_TAB_INFO" });
}

// ── Automatic Job Discovery ──────────────────────────────────────────────────

async function discoverJob(token) {
  try {
    const response = await relayToContent({ type: "CL_PING" });
    if (response?.ok) {
      // Content script is active, let's try to extract job info
      const info = await relayToContent({ type: "CL_EXTRACT_JOB" });
      if (info?.title && info?.url) {
        // Auto-save discovered job as 'discovered' status
        await saveJobToCareerLaunch(token, info);
      }
    }
  } catch {
    // Silent fail for discovery
  }
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Google OAuth sign-in ──────────────────────────────────────────────────────

async function signInWithGoogle() {
  if (!chrome.identity) {
    throw new Error("Extension needs to be reloaded. Go to chrome://extensions and click the reload button on CareerLaunch.");
  }
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const redirectUrl = chrome.identity.getRedirectURL();

  const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", redirectUrl);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "s256");

  // Open Google OAuth popup
  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (url) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(url);
        }
      }
    );
  });

  // Extract the authorization code from the redirect URL
  const parsedUrl = new URL(responseUrl);
  const code = parsedUrl.searchParams.get("code");
  if (!code) throw new Error("No authorization code received from Google");

  // Exchange code + verifier for tokens
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || err.msg || "Sign in failed");
  }

  return res.json(); // { access_token, refresh_token, user, ... }
}

// ── Auth storage ──────────────────────────────────────────────────────────────

async function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["access_token", "user_email", "user_id"], resolve);
  });
}

async function storeAuth(token, email, userId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ access_token: token, user_email: email, user_id: userId }, resolve);
  });
}

async function clearAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["access_token", "user_email", "user_id"], resolve);
  });
}

// ── Profile fetch ─────────────────────────────────────────────────────────────

async function fetchProfile(token) {
  const { payload } = await fetchCareerLaunch("/api/extension/profile", {
    headers: { "Authorization": `Bearer ${token}` },
  }, { fallbackMessage: "Could not fetch profile" });
  return payload.data;
}

// ── Render helpers ─────────────────────────────────────────────────────────────

function setStatus(online) {
  statusDot.className = `status-dot ${online ? "online" : "offline"}`;
  statusDot.title = online ? "Connected" : "Not connected";
}

function renderProfile(profile, email) {
  const p = profile?.personal ?? {};
  const name = p.name || email?.split("@")[0] || "You";
  profileName.textContent = name;
  avatarInitials.textContent = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  if (p.name || p.email) {
    resumeStatus.textContent = "1 resume loaded";
    resumeStatus.className = "resume-status resume-ok";
  } else {
    resumeStatus.textContent = "No resume — upload in dashboard";
    resumeStatus.className = "resume-status resume-none";
  }
}

function showFillResult(type, msg) {
  fillResult.style.display = "block";
  fillResult.className = `fill-result ${type}`;
  fillResult.textContent = msg;
}

function openQuestionsPage() {
  const url = `${activeBaseUrl}/questions`;
  if (chrome?.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, "_blank");
  }
}

async function updatePageInfo() {
  try {
    const info = await getTabInfo();
    if (info?.url) {
      const url = new URL(info.url);
      pageHost.textContent = `Current page: ${url.hostname}`;
    } else {
      pageHost.textContent = "No active page";
    }
  } catch {
    pageHost.textContent = "Unable to detect page";
  }
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value.trim()) {
    throw new Error("Nothing to copy yet.");
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      console.warn("Clipboard API failed, falling back to execCommand:", error);
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  textArea.style.top = "-1000px";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was rejected.");
    }
  } finally {
    textArea.remove();
  }
}

function setTemporaryButtonLabel(button, temporaryText, originalText, duration = 1500) {
  button.textContent = temporaryText;
  setTimeout(() => {
    button.textContent = originalText;
  }, duration);
}

// ── Missing supplemental info ─────────────────────────────────────────────────

let _saveFillHandler = null;

function showMissingInfo(skippedFields, token) {
  if (!skippedFields?.length) { missingSection.style.display = "none"; return; }

  missingSection.style.display = "block";
  missingFields.replaceChildren();

  for (const field of skippedFields) {
    const row = document.createElement("div");
    row.className = "missing-field-row";

    const label = document.createElement("label");
    label.className = "missing-field-label";
    label.htmlFor = `miss-${field.fieldName}`;
    label.textContent = field.pageLabel;
    row.appendChild(label);

    if (field.options?.length > 0) {
      const select = document.createElement("select");
      select.className = "missing-field-input";
      select.id = `miss-${field.fieldName}`;

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Select…";
      select.appendChild(emptyOption);

      for (const option of field.options) {
        const optionElement = document.createElement("option");
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
      }

      row.appendChild(select);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "missing-field-input";
      input.id = `miss-${field.fieldName}`;
      input.placeholder = "Your answer…";
      row.appendChild(input);
    }

    missingFields.appendChild(row);
  }

  if (_saveFillHandler) btnSaveFill.removeEventListener("click", _saveFillHandler);
  _saveFillHandler = async () => {
    btnSaveFill.disabled = true;
    btnSaveFill.textContent = "Saving…";
    try {
      for (const f of skippedFields) {
        const el = document.getElementById(`miss-${f.fieldName}`);
        const val = el?.value?.trim();
        if (!val) continue;
        await fetchCareerLaunch("/api/extension/supplemental", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ question_key: f.fieldName, question_label: f.pageLabel, answer: val }),
        }, { fallbackMessage: "Could not save supplemental answer" });
      }
      // Re-fetch profile and re-fill the page
      const updated = await fetchProfile(token);
      await relayToContent({
        type: "CL_AUTOFILL",
        profile: updated.profile,
        supplemental: updated.supplemental,
      });
      missingSection.style.display = "none";
      showFillResult("success", "Answers saved and fields filled!");
    } catch (err) {
      showFillResult("error", "Failed to save: " + (err.message || "Unknown error"));
    } finally {
      btnSaveFill.disabled = false;
      btnSaveFill.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save & Fill`;
    }
  };
  btnSaveFill.addEventListener("click", _saveFillHandler);
}

// ── Autofill ──────────────────────────────────────────────────────────────────

async function runAutofill() {
  const { access_token } = await getStoredAuth();
  if (!access_token) return;

  btnAutofill.disabled = true;
  autofillBadge.textContent = "Filling…";
  autofillBadge.className = "badge badge-warn";
  fillResult.style.display = "none";
  missingSection.style.display = "none";

  try {
    const profileData = await fetchProfile(access_token);

    // Send message to content script via background relay
    async function sendAutofill() {
      return await relayToContent({
        type: "CL_AUTOFILL",
        profile: profileData.profile,
        supplemental: profileData.supplemental,
      });
    }

    let response = await sendAutofill();

    // Always save the job to CareerLaunch when Fill Application is clicked
    let savedJob = null;
    if (response?.jobInfo?.url) {
      // Collect filled fields to store in the application record
      const filledFields = response.filled_fields ?? {}; // I need to make sure autofill returns this
      const saveResult = await saveJobToCareerLaunch(access_token, response.jobInfo, filledFields);
      savedJob = saveResult;
    }

    const jobSavedMsg = savedJob?.created
      ? ` Job "${response.jobInfo?.title || "this job"}" added to your dashboard.`
      : savedJob
        ? "" // already existed, no extra message
        : "";

    if (response?.filled > 0) {
      autofillBadge.textContent = `${response.filled} filled`;
      autofillBadge.className = "badge badge-ok";
      showFillResult("success", `Filled ${response.filled} field${response.filled !== 1 ? "s" : ""}.${response.skipped > 0 ? ` ${response.skipped} skipped.` : ""}${jobSavedMsg}`);
    } else if (response?.no_fields) {
      autofillBadge.textContent = "No fields";
      autofillBadge.className = "badge badge-idle";
      showFillResult("warn", "No fillable application fields detected on this page.");
    } else {
      autofillBadge.textContent = "Done";
      autofillBadge.className = "badge badge-idle";
      showFillResult("warn", "No fields were filled. This page may require manual input.");
    }

    // Show magic cover letter button if a field was detected
    if (response?.coverLetterFound) {
      coverLetterSection.style.display = "block";
    } else {
      coverLetterSection.style.display = "none";
    }

    // Show missing supplemental fields so user can answer from the popup
    showMissingInfo(response?.skippedFields ?? [], access_token);
    
    // AI Copilot Questions Scan
    await scanAndLoadQuestions(access_token);

    if (response?.alerts?.length > 0) {
      for (const alert of response.alerts) {
        await storeLocalAlert(alert);
      }
    }

    await loadAlerts();
  } catch (err) {
    autofillBadge.textContent = "Error";
    autofillBadge.className = "badge badge-error";
    showFillResult("error", "Could not fill: " + (err.message ?? "Unknown error"));
  } finally {
    btnAutofill.disabled = false;
  }
}

async function saveJobToCareerLaunch(token, jobInfo, filledFields = null) {
  try {
    const { payload } = await fetchCareerLaunch("/api/extension/save-job", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ ...jobInfo, filled_fields: filledFields }),
    }, { fallbackMessage: "Could not save job" });
    return payload.data;
  } catch {
    // best-effort — don't block the user if this fails
  }
  return null;
}

async function storeLocalAlert(alert) {
  try {
    await chrome.runtime.sendMessage({ type: "CL_STORE_ALERT", alert });
  } catch {
    // best-effort
  }
}

function renderEmptyAlertsState() {
  alertsList.replaceChildren();
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "No pending alerts";
  alertsList.appendChild(hint);
  alertCount.style.display = "none";
  btnOpenAlerts.style.display = "none";
  btnOpenAlerts.textContent = "Open Pending Questions";
}

function updateAlertControls(count) {
  if (count > 0) {
    alertCount.style.display = "inline";
    alertCount.textContent = count > 9 ? "9+" : String(count);
    btnOpenAlerts.style.display = "flex";
    btnOpenAlerts.textContent = `Open Pending Questions (${count})`;
    return;
  }

  alertCount.style.display = "none";
  btnOpenAlerts.style.display = "none";
  btnOpenAlerts.textContent = "Open Pending Questions";
}

async function savePendingAlertAnswer(alert, answer, button) {
  const { access_token: token } = await getStoredAuth();
  if (!token) return;

  const trimmedAnswer = String(answer || "").trim();
  if (!trimmedAnswer) {
    showFillResult("warn", "Please enter an answer before saving.");
    return;
  }

  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Saving...";

  try {
    await fetchCareerLaunch("/api/extension/alert", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: alert.id,
        ids: alert.ids || [],
        answer: trimmedAnswer,
        field_key: alert.field_key,
        question_text: alert.question_text,
        saveToSupplemental: true,
      }),
    }, { fallbackMessage: "Could not save this pending question", timeoutMs: 15000 });

    showFillResult("success", "Saved to supplemental info. Fill Application will be able to reuse it.");
    await loadAlerts();
  } catch (error) {
    showFillResult("error", error.message || "Could not save this pending question.");
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function renderManualAlertQueue(alerts, count, actionableCount = alerts.length) {
  alertsList.replaceChildren();
  updateAlertControls(count);

  if (count === 0) {
    renderEmptyAlertsState();
    return;
  }

  if (!alerts.length) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent =
      count === 1
        ? "1 pending question needs attention on the website."
        : `${count} pending questions need attention on the website.`;
    alertsList.appendChild(hint);
    return;
  }

  const alert = alerts[0];
  const card = document.createElement("div");
  card.className = "alert-card";

  const heading = document.createElement("div");
  heading.className = "alert-company";
  heading.textContent = alert.job?.company
    ? `${alert.job.title} at ${alert.job.company}`
    : "Pending Question";
  card.appendChild(heading);

  const detail = document.createElement("div");
  detail.className = "alert-detail";
  detail.textContent = alert.question_text ?? "Manual action required";
  card.appendChild(detail);

  const meta = document.createElement("p");
  meta.className = "alert-meta";
  if (count > 1) {
    meta.textContent = actionableCount > 1
      ? `Showing the next pending question. ${count - 1} more remain.`
      : `${count} pending items remain. Open the website to clear the rest at once.`;
  } else {
    meta.textContent = alert.actionable
      ? "Save an answer here to add it to your supplemental info."
      : "This item requires manual action on the website.";
  }
  card.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "alert-actions";

  if (alert.actionable) {
    const input = document.createElement("textarea");
    input.className = "alert-response-input";
    input.rows = 3;
    input.placeholder = "Type your answer here...";
    input.value = alert.existing_answer || "";
    card.appendChild(input);

    const saveButton = document.createElement("button");
    saveButton.className = "btn btn-primary";
    saveButton.type = "button";
    saveButton.textContent = "Save to Supplemental";
    saveButton.addEventListener("click", async () => {
      await savePendingAlertAnswer(alert, input.value, saveButton);
    });
    actions.appendChild(saveButton);
  }

  const openButton = document.createElement("button");
  openButton.className = "btn btn-secondary";
  openButton.type = "button";
  openButton.textContent = "Open Website Queue";
  openButton.addEventListener("click", openQuestionsPage);
  actions.appendChild(openButton);

  card.appendChild(actions);
  alertsList.appendChild(card);
}

// ── Load alerts ───────────────────────────────────────────────────────────────

async function loadAlerts() {
  const { access_token: token } = await getStoredAuth();

  if (token) {
    try {
      const { payload } = await fetchCareerLaunch("/api/extension/alert", {
        headers: { "Authorization": `Bearer ${token}` },
      }, { fallbackMessage: "Could not fetch alerts", timeoutMs: 10000 });

      const alerts = payload.data?.alerts || [];
      const count = payload.data?.count ?? alerts.length;
      const actionableCount = payload.data?.actionableCount ?? alerts.length;
      renderManualAlertQueue(alerts, count, actionableCount);
      return;
    } catch (error) {
      console.warn("Falling back to local alerts:", error);
    }
  }

  const { alerts = [] } = await new Promise((r) => chrome.storage.local.get("alerts", r));
  if (alerts.length === 0) {
    renderEmptyAlertsState();
    return;
  }
  updateAlertControls(alerts.length);
  alertsList.replaceChildren();

  for (const alert of alerts) {
    const item = document.createElement("button");
    item.className = "alert-item";
    item.type = "button";
    item.addEventListener("click", openQuestionsPage);

    const company = document.createElement("div");
    company.className = "alert-company";
    company.textContent = alert.company ?? alert.job_url ?? "Unknown site";

    const detail = document.createElement("div");
    detail.className = "alert-detail";
    detail.textContent = alert.blocker_detail ?? "Manual action required";

    item.appendChild(company);
    item.appendChild(detail);
    alertsList.appendChild(item);
  }
}

// ── Main init ─────────────────────────────────────────────────────────────────

async function init() {
  const { access_token, user_email } = await getStoredAuth();

  if (access_token && user_email) {
    try {
      const data = await fetchProfile(access_token);
      showMainView(data, user_email);
      setStatus(true);
      // Run automatic job discovery
      discoverJob(access_token);
    } catch {
      await clearAuth();
      showLoginView();
    }
  } else {
    showLoginView();
  }
}

function showLoginView() {
  viewLogin.style.display = "block";
  viewMain.style.display = "none";
  setStatus(false);
}

function showMainView(profileData, email) {
  viewLogin.style.display = "none";
  viewMain.style.display = "block";
  renderProfile(profileData?.profile, email);
  updatePageInfo();
  loadAlerts();
}

// ── Event listeners ────────────────────────────────────────────────────────────

btnClose.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  try {
    const response = await relayToContent({ type: "CL_TOGGLE_OVERLAY" });
    if (response?.ok) return;
  } catch (error) {
    console.warn("Direct close relay failed:", error);
  }

  try {
    await chrome.runtime.sendMessage({ type: "CL_TOGGLE_SELF" });
  } catch (error) {
    console.error("Close overlay failed:", error);
  }
});

btnOpenAlerts?.addEventListener("click", openQuestionsPage);

btnLogin.addEventListener("click", async () => {
  loginError.style.display = "none";
  btnLogin.disabled = true;
  btnLogin.textContent = "Opening Google…";

  try {
    const auth = await signInWithGoogle();
    const email = auth.user?.email ?? "";
    await storeAuth(auth.access_token, email, auth.user?.id);
    const profileData = await fetchProfile(auth.access_token);
    showMainView(profileData, email);
    setStatus(true);
  } catch (err) {
    loginError.textContent = err.message ?? "Sign in failed";
    loginError.style.display = "block";
  } finally {
    btnLogin.disabled = false;
    btnLogin.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="flex-shrink:0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Sign in with Google`;
  }
});

btnLogout.addEventListener("click", async () => {
  await clearAuth();
  showLoginView();
  setStatus(false);
});

btnAutofill.addEventListener("click", runAutofill);

// ── Boot ───────────────────────────────────────────────────────────────────────
init();
// ── Magic Cover Letter ──────────────────────────────────────────────────────

btnMagicLetter.addEventListener("click", async () => {
  const { access_token: token } = await getStoredAuth();
  if (!token) return;

  btnMagicLetter.disabled = true;
  const originalText = btnMagicLetter.innerHTML;
  btnMagicLetter.innerHTML = `<span class="spinner"></span> Writing...`;

  try {
    // 1. Get job info from page
    const info = await relayToContent({ type: "CL_EXTRACT_JOB" });
    if (!info) throw new Error("Could not extract job info");

    // 2. Call API to generate
    const { payload } = await fetchCareerLaunch("/api/extension/generate-cover-letter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        jobTitle: info.title,
        companyName: info.company,
        jobDescription: info.description
      })
    }, {
      fallbackMessage: "Generation failed",
      timeoutMs: 60000,
      timeoutMessage: "Cover letter generation took too long. Please try again.",
    });

    const { coverLetter } = payload.data;

    // 3. Fill the field
    const fillRes = await relayToContent({ type: "CL_FILL_COVER_LETTER", text: coverLetter });
    if (fillRes?.error) throw new Error(fillRes.error);

    btnMagicLetter.innerHTML = `✨ Letter Generated!`;
    setTimeout(() => { btnMagicLetter.innerHTML = originalText; btnMagicLetter.disabled = false; }, 3000);

  } catch (err) {
    console.error("Magic letter error:", err);
    alert(err.message);
    btnMagicLetter.innerHTML = originalText;
    btnMagicLetter.disabled = false;
  }
});

// ── AI Copilot ─────────────────────────────────────────────────────────────

let currentQuestions = [];
const questionAnswerState = new Map();

function getQuestionState(questionId) {
  return questionAnswerState.get(questionId) || {};
}

function setQuestionState(questionId, nextState) {
  questionAnswerState.set(questionId, { ...getQuestionState(questionId), ...nextState });
}

function getQuestionTypeLabel(question) {
  if (question.type === "essay" || question.isCoverLetter) return "Essay";
  if (question.type === "multi_select") return "Multi";
  if (question.type === "multiple_choice") return "Select";
  return "Short";
}

function getAnsweredQuestions() {
  return currentQuestions.filter((question) => getQuestionState(question.id).answer);
}

function syncQuestionActions() {
  const hasQuestions = currentQuestions.length > 0;
  const answeredCount = getAnsweredQuestions().length;
  questionActions.style.display = hasQuestions ? "grid" : "none";
  btnFillAnswered.disabled = answeredCount === 0;
  btnCopyAll.disabled = answeredCount === 0;
}

function renderQuestions() {
  customQuestionsDiv.replaceChildren();
  syncQuestionActions();

  for (const question of currentQuestions) {
    const state = getQuestionState(question.id);
    const item = document.createElement("div");
    item.className = "qa-item";

    const head = document.createElement("div");
    head.className = "qa-head";

    const title = document.createElement("div");
    title.className = "qa-title";
    title.textContent = state.rewrittenQuestion || question.rewrittenLabel || question.label;
    head.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "qa-meta";

    const typePill = document.createElement("span");
    typePill.className = "qa-pill";
    typePill.textContent = getQuestionTypeLabel(question);
    meta.appendChild(typePill);

    if (question.required) {
      const requiredPill = document.createElement("span");
      requiredPill.className = "qa-pill warn";
      requiredPill.textContent = "Required";
      meta.appendChild(requiredPill);
    }

    if (state.confidence) {
      const confidencePill = document.createElement("span");
      confidencePill.className = `qa-pill ${state.confidence === "high" ? "ok" : state.confidence === "low" ? "warn" : ""}`;
      confidencePill.textContent = `${state.confidence} confidence`;
      meta.appendChild(confidencePill);
    }

    item.appendChild(head);
    item.appendChild(meta);

    if (question.helpText) {
      const help = document.createElement("div");
      help.className = "qa-help";
      help.textContent = question.helpText;
      item.appendChild(help);
    }

    if (state.error) {
      const error = document.createElement("div");
      error.className = "qa-help";
      error.textContent = state.error;
      item.appendChild(error);
    }

    const answerBox = document.createElement("div");
    answerBox.className = "qa-answer";
    if (state.answer) {
      answerBox.style.display = "block";
      answerBox.textContent = state.answer;
    }
    item.appendChild(answerBox);

    const actions = document.createElement("div");
    actions.className = "qa-actions";

    const answerButton = document.createElement("button");
    answerButton.className = "btn btn-secondary";
    answerButton.type = "button";
    answerButton.textContent = state.loading ? "Thinking..." : state.answer ? "Regenerate" : "Answer";
    answerButton.disabled = Boolean(state.loading);
    answerButton.addEventListener("click", async () => {
      await handleAnswerQuestion(question.id);
    });
    actions.appendChild(answerButton);

    const copyButton = document.createElement("button");
    copyButton.className = "btn btn-secondary";
    copyButton.type = "button";
    copyButton.textContent = "Copy";
    copyButton.disabled = !state.answer;
    copyButton.addEventListener("click", async () => {
      if (!state.answer) return;
      try {
        await copyTextToClipboard(state.answer);
        setTemporaryButtonLabel(copyButton, "Copied", "Copy");
      } catch (error) {
        showFillResult("error", error.message || "Could not copy that answer.");
      }
    });
    actions.appendChild(copyButton);

    const fillButton = document.createElement("button");
    fillButton.className = "btn btn-primary";
    fillButton.type = "button";
    fillButton.textContent = "Fill Page";
    fillButton.disabled = !state.answer;
    fillButton.addEventListener("click", async () => {
      const result = await relayToContent({
        type: "CL_FILL_QUESTION",
        questionId: question.id,
        text: state.answer,
      });

      if (!result || result.error) {
        showFillResult("error", result?.error || "Failed to fill that field on the page.");
        return;
      }

      showFillResult("success", `Filled "${state.rewrittenQuestion || question.rewrittenLabel || question.label}".`);
    });
    actions.appendChild(fillButton);

    item.appendChild(actions);
    customQuestionsDiv.appendChild(item);
  }
}

function buildQuestionPayload(question) {
  return {
    id: question.id,
    label: question.label,
    type: question.type,
    options: question.options || [],
    helpText: question.helpText || "",
    placeholder: question.placeholder || "",
    required: Boolean(question.required),
    maxLength: question.maxLength,
    minLength: question.minLength,
    isCoverLetter: Boolean(question.isCoverLetter),
  };
}

async function getJobContext() {
  const info = await relayToContent({ type: "CL_EXTRACT_JOB" }) || {};
  return {
    jobTitle: info.title || "",
    companyName: info.company || "",
    jobDescription: info.description || "",
  };
}

async function requestSingleAnswer(token, question) {
  const jobContext = await getJobContext();
  const { payload } = await fetchCareerLaunch("/api/extension/answer-question", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...buildQuestionPayload(question),
      question: question.label,
      ...jobContext,
    }),
  }, {
    fallbackMessage: "Generation failed",
    timeoutMs: 60000,
    timeoutMessage: "Answer generation timed out. Please try again.",
  });

  return payload.data;
}

async function requestBatchAnswers(token, questions) {
  const jobContext = await getJobContext();
  const { payload } = await fetchCareerLaunch("/api/extension/answer-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      questions: questions.map(buildQuestionPayload),
      ...jobContext,
    }),
  }, {
    fallbackMessage: "Batch generation failed",
    timeoutMs: 90000,
    timeoutMessage: "Batch answer generation timed out. Please try again.",
  });

  return payload.data?.answers || [];
}

async function scanAndLoadQuestions() {
  try {
    const res = await relayToContent({ type: "CL_SCAN_QUESTIONS" });
    if (!res || !res.questions || res.questions.length === 0) {
      aiAssistantSection.style.display = "none";
      currentQuestions = [];
      questionAnswerState.clear();
      customQuestionsDiv.replaceChildren();
      return;
    }

    currentQuestions = res.questions;
    questionAnswerState.clear();
    aiAssistantSection.style.display = "block";
    questionsSummary.textContent = `Found ${currentQuestions.length} custom application question${currentQuestions.length === 1 ? "" : "s"}. Answer one or fill them all at once.`;
    renderQuestions();
  } catch (err) {
    console.error("Scan questions error:", err);
    aiAssistantSection.style.display = "none";
  }
}

async function handleAnswerQuestion(questionId) {
  const question = currentQuestions.find((entry) => entry.id === questionId);
  if (!question) return;

  const { access_token: token } = await getStoredAuth();
  if (!token) return;

  setQuestionState(questionId, { loading: true, error: "" });
  renderQuestions();

  try {
    const result = await requestSingleAnswer(token, question);
    if (!result?.answer?.trim()) {
      throw new Error("The AI returned an empty answer for this question.");
    }
    setQuestionState(questionId, {
      loading: false,
      error: "",
      answer: result.answer || "",
      rewrittenQuestion: result.rewrittenQuestion || question.rewrittenLabel || question.label,
      confidence: result.confidence || "medium",
    });
  } catch (err) {
    console.error("Copilot error:", err);
    setQuestionState(questionId, {
      loading: false,
      error: err.message || "Could not generate an answer for this question.",
    });
    showFillResult("error", err.message || "Could not generate an answer.");
  }

  renderQuestions();
}

async function fillAnsweredQuestions() {
  const answeredQuestions = getAnsweredQuestions();
  if (!answeredQuestions.length) return;

  let filledCount = 0;
  for (const question of answeredQuestions) {
    const state = getQuestionState(question.id);
    const result = await relayToContent({
      type: "CL_FILL_QUESTION",
      questionId: question.id,
      text: state.answer,
    });

    if (result && !result.error) {
      filledCount += 1;
    }
  }

  if (filledCount > 0) {
    showFillResult("success", `Filled ${filledCount} AI answer${filledCount === 1 ? "" : "s"} on the page.`);
  } else {
    showFillResult("warn", "No AI answers were filled. The page may need manual paste.");
  }
}

async function copyAllAnswers() {
  const answeredQuestions = getAnsweredQuestions();
  if (!answeredQuestions.length) return;

  const text = answeredQuestions
    .map((question) => {
      const state = getQuestionState(question.id);
      const heading = state.rewrittenQuestion || question.rewrittenLabel || question.label;
      return `${heading}\n${state.answer}`;
    })
    .join("\n\n");

  try {
    await copyTextToClipboard(text);
    setTemporaryButtonLabel(btnCopyAll, "Copied All", "Copy All");
  } catch (error) {
    showFillResult("error", error.message || "Could not copy the generated answers.");
  }
}

btnAnswerAll?.addEventListener("click", async () => {
  const { access_token: token } = await getStoredAuth();
  if (!token || !currentQuestions.length) return;

  const unansweredQuestions = currentQuestions.filter((question) => !getQuestionState(question.id).answer);
  if (!unansweredQuestions.length) {
    showFillResult("success", "All detected questions already have AI answers.");
    return;
  }

  btnAnswerAll.disabled = true;
  btnAnswerAll.textContent = "Thinking...";
  unansweredQuestions.forEach((question) => {
    setQuestionState(question.id, { loading: true, error: "" });
  });
  renderQuestions();

  try {
    let answers = [];
    try {
      answers = await requestBatchAnswers(token, unansweredQuestions);
    } catch (batchError) {
      console.warn("Batch answer failed, falling back to single requests:", batchError);
      for (const question of unansweredQuestions) {
        try {
          const result = await requestSingleAnswer(token, question);
          if (!result?.answer?.trim()) {
            throw new Error("The AI returned an empty answer for this question.");
          }
          answers.push({ id: question.id, ...result });
        } catch (singleError) {
          answers.push({
            id: question.id,
            rewrittenQuestion: question.rewrittenLabel || question.label,
            answer: "",
            confidence: "low",
            error: singleError.message || "Generation failed",
          });
        }
      }
    }

    let successCount = 0;
    let failureCount = 0;
    for (const answer of answers) {
      const hasAnswer = Boolean(answer.answer && answer.answer.trim());
      if (hasAnswer) {
        successCount += 1;
      } else {
        failureCount += 1;
      }
      setQuestionState(answer.id, {
        loading: false,
        error: hasAnswer ? "" : (answer.error || "The AI returned an empty answer."),
        answer: answer.answer || "",
        rewrittenQuestion: answer.rewrittenQuestion || currentQuestions.find((question) => question.id === answer.id)?.rewrittenLabel || "",
        confidence: answer.confidence || "medium",
      });
    }

    unansweredQuestions
      .filter((question) => !answers.some((answer) => answer.id === question.id))
      .forEach((question) => {
        failureCount += 1;
        setQuestionState(question.id, {
          loading: false,
          error: "Generation failed",
        });
      });

    if (successCount > 0 && failureCount === 0) {
      showFillResult("success", `Generated ${successCount} answer${successCount === 1 ? "" : "s"}.`);
    } else if (successCount > 0) {
      showFillResult("warn", `Generated ${successCount} answer${successCount === 1 ? "" : "s"}, but ${failureCount} question${failureCount === 1 ? "" : "s"} still need attention.`);
    } else {
      showFillResult("error", "Could not generate answers for these questions.");
    }
  } catch (err) {
    console.error("Answer all error:", err);
    unansweredQuestions.forEach((question) => {
      setQuestionState(question.id, { loading: false, error: err.message || "Could not generate an answer." });
    });
    showFillResult("error", err.message || "Could not answer all questions.");
  } finally {
    btnAnswerAll.disabled = false;
    btnAnswerAll.textContent = "Answer All";
    renderQuestions();
  }
});

btnFillAnswered?.addEventListener("click", async () => {
  await fillAnsweredQuestions();
});

btnCopyAll?.addEventListener("click", async () => {
  await copyAllAnswers();
});

// ── Find Jobs / Autopilot ──────────────────────────────────────────────────────

const fjKeywords       = document.getElementById("fj-keywords");
const fjLocation       = document.getElementById("fj-location");
const fjTypeChecks     = () => Array.from(document.querySelectorAll(".fj-type-check"));
const btnSearchIndeed  = document.getElementById("btn-search-indeed");
const btnAutoApply     = document.getElementById("btn-auto-apply");
const autopilotStatus  = document.getElementById("autopilot-status");
const autopilotLabel   = document.getElementById("autopilot-label");
const btnAutopilotPause  = document.getElementById("btn-autopilot-pause");
const btnAutopilotStop   = document.getElementById("btn-autopilot-stop");
const autopilotPaywall   = document.getElementById("autopilot-paywall");
const btnUpgrade         = document.getElementById("btn-upgrade");
const autopilotSupplemental = document.getElementById("autopilot-supplemental");
const autopilotSuppFields   = document.getElementById("autopilot-supp-fields");
const btnAutopilotResume    = document.getElementById("btn-autopilot-resume-supp");

// Persist/restore job prefs from storage
async function loadJobPrefs() {
  const { jobPrefs } = await new Promise((r) => chrome.storage.local.get("jobPrefs", r));
  if (!jobPrefs) return;
  if (jobPrefs.keywords) fjKeywords.value = jobPrefs.keywords;
  if (jobPrefs.location) fjLocation.value = jobPrefs.location;
  if (jobPrefs.jobTypes?.length) {
    fjTypeChecks().forEach((cb) => { cb.checked = jobPrefs.jobTypes.includes(cb.value); });
  }
}

async function saveJobPrefs() {
  const jobPrefs = {
    keywords: fjKeywords.value.trim(),
    location: fjLocation.value.trim(),
    jobTypes: fjTypeChecks().filter((cb) => cb.checked).map((cb) => cb.value),
  };
  await new Promise((r) => chrome.storage.local.set({ jobPrefs }, r));
  return jobPrefs;
}

// Map our type keys to Indeed's jt= param values
const INDEED_JT_MAP = { fulltime: "fulltime", parttime: "parttime", contract: "contract", temporary: "temporary", internship: "internship" };

btnSearchIndeed?.addEventListener("click", async () => {
  const prefs = await saveJobPrefs();
  const params = new URLSearchParams();
  if (prefs.keywords) params.set("q", prefs.keywords);
  if (prefs.location) params.set("l", prefs.location);
  if (prefs.jobTypes.length === 1) params.set("jt", INDEED_JT_MAP[prefs.jobTypes[0]] || "");
  chrome.tabs.create({ url: `https://www.indeed.com/jobs?${params}` });
});

function showAutopilotStatus(label) {
  autopilotStatus.style.display = "block";
  autopilotPaywall.style.display = "none";
  autopilotSupplemental.style.display = "none";
  autopilotLabel.textContent = label;
}

function hideAutopilotStatus() {
  autopilotStatus.style.display = "none";
}

function showAutopilotPaywall(baseUrl) {
  hideAutopilotStatus();
  autopilotPaywall.style.display = "block";
  btnUpgrade.href = `${baseUrl}/pricing`;
}

function showAutopilotSupplemental(skippedFields, token) {
  autopilotSupplemental.style.display = "block";
  autopilotSuppFields.replaceChildren();

  for (const field of skippedFields) {
    const row = document.createElement("div");
    row.className = "missing-field-row";
    const label = document.createElement("label");
    label.className = "missing-field-label";
    label.htmlFor = `ap-miss-${field.fieldName}`;
    label.textContent = field.pageLabel;
    row.appendChild(label);

    if (field.options?.length > 0) {
      const sel = document.createElement("select");
      sel.className = "missing-field-input";
      sel.id = `ap-miss-${field.fieldName}`;
      sel.innerHTML = `<option value="">Select…</option>` +
        field.options.map((o) => `<option value="${o}">${o}</option>`).join("");
      row.appendChild(sel);
    } else {
      const inp = document.createElement("input");
      inp.type = "text"; inp.className = "missing-field-input";
      inp.id = `ap-miss-${field.fieldName}`; inp.placeholder = "Your answer…";
      row.appendChild(inp);
    }
    autopilotSuppFields.appendChild(row);
  }

  // Wire save & resume
  btnAutopilotResume.onclick = async () => {
    btnAutopilotResume.disabled = true;
    btnAutopilotResume.textContent = "Saving…";
    try {
      for (const f of skippedFields) {
        const el = document.getElementById(`ap-miss-${f.fieldName}`);
        const val = el?.value?.trim();
        if (!val) continue;
        await fetchCareerLaunch("/api/extension/supplemental", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ question_key: f.fieldName, question_label: f.pageLabel, answer: val }),
        }, { fallbackMessage: "Could not save" });
      }
      // Refresh profile and resume autopilot
      const updated = await fetchProfile(token);
      autopilotSupplemental.style.display = "none";
      await chrome.runtime.sendMessage({
        type: "CL_AUTOPILOT_RESUME",
        profile: updated.profile,
        supplemental: updated.supplemental,
      });
      showAutopilotStatus("Resuming…");
    } catch (err) {
      showFillResult("error", err.message || "Could not save answers");
    } finally {
      btnAutopilotResume.disabled = false;
      btnAutopilotResume.textContent = "Save & Resume";
    }
  };
}

// Poll autopilot state to keep the popup UI in sync
let autopilotPollInterval = null;

async function pollAutopilotStatus() {
  const { state } = await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_STATUS" });
  if (!state?.active) {
    clearInterval(autopilotPollInterval);
    autopilotPollInterval = null;
    hideAutopilotStatus();
    btnAutoApply.disabled = false;
    return;
  }

  const { access_token: token } = await getStoredAuth();
  const total = state.jobQueue?.length || 0;
  const applied = state.appliedCount || 0;
  const current = state.jobQueue?.[state.currentIndex];
  const currentLabel = current ? `${current.title} at ${current.company}` : "…";

  if (state.paused && state.pauseReason === "missing_supplemental" && state.pendingSupplemental?.length) {
    showAutopilotSupplemental(state.pendingSupplemental, token);
    showAutopilotStatus(`Paused — need info (${applied}/${total} done)`);
  } else if (state.paused) {
    showAutopilotStatus(`Paused (${applied}/${total} done)`);
  } else {
    showAutopilotStatus(`Applying: ${currentLabel} (${applied}/${total})`);
  }
}

btnAutoApply?.addEventListener("click", async () => {
  const prefs = await saveJobPrefs();
  const { access_token: token } = await getStoredAuth();
  if (!token) return;

  btnAutoApply.disabled = true;

  try {
    // Scan the current Indeed page for matching jobs
    const scanResult = await relayToContent({ type: "CL_FIND_INDEED_JOBS", jobTypes: prefs.jobTypes });

    if (!scanResult?.jobs?.length) {
      showFillResult("warn", "No matching jobs found on this page. Search on Indeed first, then click Auto Apply.");
      btnAutoApply.disabled = false;
      return;
    }

    // Check paywall status before starting
    let paywallCheck;
    try {
      const resp = await fetchCareerLaunch("/api/extension/autopilot/complete", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      }, { fallbackMessage: "Could not check status" });
      paywallCheck = resp.payload.data;
    } catch { paywallCheck = null; }

    if (paywallCheck?.paywalled) {
      showAutopilotPaywall(activeBaseUrl);
      btnAutoApply.disabled = false;
      return;
    }

    const profileData = await fetchProfile(token);
    const maxApplications = paywallCheck?.limit ?? 10;

    await chrome.runtime.sendMessage({
      type: "CL_AUTOPILOT_START",
      jobQueue: scanResult.jobs,
      maxApplications,
      token,
      baseUrl: activeBaseUrl,
      profile: profileData.profile,
      supplemental: profileData.supplemental,
    });

    showAutopilotStatus(`Starting — ${scanResult.jobs.length} jobs found`);

    // Start polling
    if (autopilotPollInterval) clearInterval(autopilotPollInterval);
    autopilotPollInterval = setInterval(pollAutopilotStatus, 3000);

  } catch (err) {
    showFillResult("error", err.message || "Could not start autopilot");
    btnAutoApply.disabled = false;
  }
});

btnAutopilotPause?.addEventListener("click", async () => {
  const { state } = await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_STATUS" });
  if (state?.paused) {
    const { access_token: token } = await getStoredAuth();
    const updated = await fetchProfile(token);
    await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_RESUME", profile: updated.profile, supplemental: updated.supplemental });
    btnAutopilotPause.textContent = "Pause";
  } else {
    await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_PAUSE" });
    btnAutopilotPause.textContent = "Resume";
  }
});

btnAutopilotStop?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_STOP" });
  clearInterval(autopilotPollInterval);
  autopilotPollInterval = null;
  hideAutopilotStatus();
  btnAutoApply.disabled = false;
  btnAutopilotPause.textContent = "Pause";
});

// Load prefs and restore autopilot state on popup open
(async () => {
  await loadJobPrefs();
  const { state } = await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_STATUS" });
  if (state?.active) {
    showAutopilotStatus("Autopilot running…");
    btnAutoApply.disabled = true;
    if (autopilotPollInterval) clearInterval(autopilotPollInterval);
    autopilotPollInterval = setInterval(pollAutopilotStatus, 3000);
  }
})();
