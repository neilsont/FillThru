// Fillthru Browser Extension — assistant panel
// Runs inside the iframe that content.js injects. Talks to the Fillthru API with a
// Supabase bearer token and to the page through the background relay.

const DEFAULT_BASE_URL = "https://fillthru.com";
const BASE_URL_CANDIDATES = [
  DEFAULT_BASE_URL,
  "https://careerlaunch1.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const SUPABASE_URL = "https://jxricnvgdaktresxfwqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iyRuOLc1Nwwk_fb0frFVIQ_gDSBadVw";
let activeBaseUrl = DEFAULT_BASE_URL;

// ── DOM refs ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const viewLogin = $("view-login");
const viewMain = $("view-main");
const viewPaywall = $("view-paywall");
const loginError = $("login-error");
const btnLogin = $("btn-login");
const btnLogout = $("btn-logout");
const btnClose = $("btn-close");
const btnHide = $("btn-hide");
const btnMenu = $("btn-menu");
const menu = $("menu");
const menuPlan = $("menu-plan");
const menuUpload = $("menu-upload");
const menuClear = $("menu-clear");
const openDashboard = $("open-dashboard");
const btnSubscribe = $("btn-subscribe");
const btnPaywallRefresh = $("btn-paywall-refresh");
const btnAutofill = $("btn-autofill");
const btnCoverLetter = $("btn-cover-letter");
const btnSaveJob = $("btn-save-job");
const btnTranslate = $("btn-translate");
const askThread = $("ask-thread");
const askInput = $("ask-input");
const askSend = $("ask-send");
const askAttach = $("ask-attach");
const resumeFile = $("resume-file");
const composerFiles = $("composer-files");
const moveHere = $("move-here");
$("menu-version").textContent = `Fillthru v${chrome.runtime?.getManifest?.().version ?? "dev"}`;
const btnMoveHere = $("btn-move-here");
const btnMoveDismiss = $("btn-move-dismiss");
const scrollArea = $("scroll");

// ── Networking ──────────────────────────────────────────────────────────────

function setActiveBaseUrl(baseUrl) {
  activeBaseUrl = baseUrl;
  openDashboard.href = `${baseUrl}/dashboard`;
  btnSubscribe.href = `${baseUrl}/profile#plan`;
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
  const message = payload.data?.error || payload.data?.message || (!isHtml && payload.text) || fallbackMessage;
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
      const response = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        setActiveBaseUrl(baseUrl);
        return { response, payload: await readResponsePayload(response), baseUrl };
      }

      const payload = await readResponsePayload(response);
      lastResponse = response;
      lastPayload = payload;

      if (response.status === 404 || response.status === 405 || response.status >= 500) continue;

      if (response.status === 402 && payload.data?.error === "subscription_required") {
        showPaywallView();
        const err = new Error("Your free trial has ended — subscribe to continue.");
        err.status = 402;
        throw err;
      }

      throw buildResponseError(response, payload, options.fallbackMessage || "Request failed");
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = new Error(options.timeoutMessage || "The request timed out. Please try again.");
        continue;
      }
      lastError = error;
      if (error?.status && error.status < 500 && error.status !== 404 && error.status !== 405) break;
    }
  }

  if (lastResponse && lastPayload) {
    throw buildResponseError(lastResponse, lastPayload, options.fallbackMessage || "Request failed");
  }
  throw lastError || new Error(options.fallbackMessage || "Could not reach Fillthru");
}

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

// ── Auth (Google via Supabase PKCE) ─────────────────────────────────────────

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signInWithGoogle() {
  if (!chrome.identity) {
    throw new Error("Extension needs to be reloaded. Go to chrome://extensions and click the reload button on Fillthru.");
  }
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const redirectUrl = chrome.identity.getRedirectURL();

  const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  authUrl.searchParams.set("provider", "google");
  authUrl.searchParams.set("redirect_to", redirectUrl);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "s256");

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true }, (url) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(url);
    });
  });

  const code = new URL(responseUrl).searchParams.get("code");
  if (!code) throw new Error("No authorization code received from Google");

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || err.msg || "Sign in failed");
  }
  return res.json(); // { access_token, refresh_token, expires_in, user }
}

const AUTH_KEYS = ["access_token", "refresh_token", "expires_at", "user_email", "user_id"];

function getStoredAuth() {
  return new Promise((resolve) => chrome.storage.local.get(AUTH_KEYS, resolve));
}

function storeSession(session, fallbackEmail = "") {
  const expiresAt = session.expires_at
    ?? (session.expires_in ? Math.floor(Date.now() / 1000) + Number(session.expires_in) : null);
  return new Promise((resolve) => {
    chrome.storage.local.set({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: expiresAt,
      user_email: session.user?.email ?? fallbackEmail,
      user_id: session.user?.id,
    }, resolve);
  });
}

function clearAuth() {
  return new Promise((resolve) => chrome.storage.local.remove(AUTH_KEYS, resolve));
}

async function refreshSession(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    const err = new Error("Session expired — please sign in again.");
    err.code = "session_expired";
    throw err;
  }
  const session = await res.json();
  await storeSession(session);
  return session.access_token;
}

let refreshInFlight = null;

// Usable access token, silently refreshed when it's about to expire.
// null → never signed in; throws → refresh failed.
async function getValidToken({ force = false } = {}) {
  const auth = await getStoredAuth();
  if (!auth.access_token) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const stale = force || (auth.expires_at && nowSec >= Number(auth.expires_at) - 60);
  if (!stale) return auth.access_token;
  if (!auth.refresh_token) return auth.access_token;
  if (!refreshInFlight) {
    refreshInFlight = refreshSession(auth.refresh_token).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function fetchProfile(token) {
  const { payload } = await fetchCareerLaunch("/api/extension/profile", {
    headers: { "Authorization": `Bearer ${token}` },
  }, { fallbackMessage: "Could not fetch profile" });
  // Cached so the next page shows the chat instantly instead of a sign-in flash.
  chrome.storage.local.set({ profile_cache: { data: payload.data, at: Date.now() } });
  return payload.data;
}

// ── Views ───────────────────────────────────────────────────────────────────

let cachedProfile = null; // { profile, supplemental, entitlement }

function showLoginView() {
  viewLogin.style.display = "flex";
  viewMain.style.display = "none";
  viewPaywall.style.display = "none";
  btnLogout.hidden = true;
  menuUpload.hidden = true;
  menuPlan.hidden = true;
}

function showPaywallView(entitlement) {
  viewLogin.style.display = "none";
  viewMain.style.display = "none";
  viewPaywall.style.display = "flex";
  btnLogout.hidden = false;
  menuUpload.hidden = true;
  menuPlan.hidden = true;
  $("paywall-title").textContent =
    entitlement?.reason === "trial_expired" ? "Your free trial has ended" : "Subscribe to use Fillthru";
}

function renderPlanNote(entitlement) {
  if (!entitlement) { menuPlan.hidden = true; return; }
  if (entitlement.reason === "trial") {
    const d = entitlement.trialDaysLeft ?? 0;
    menuPlan.textContent = `Free trial · ${d} day${d === 1 ? "" : "s"} left`;
    menuPlan.hidden = false;
  } else if (entitlement.reason === "subscription") {
    menuPlan.textContent = entitlement.planInterval === "year" ? "Yearly plan · active" : "Monthly plan · active";
    menuPlan.hidden = false;
  } else {
    menuPlan.hidden = true;
  }
}

function showMainView(profileData, { quiet = false } = {}) {
  cachedProfile = profileData;
  const entitlement = profileData?.entitlement;
  if (entitlement && !entitlement.active) {
    showPaywallView(entitlement);
    return;
  }
  const alreadyShowing = viewMain.style.display === "flex";
  viewLogin.style.display = "none";
  viewPaywall.style.display = "none";
  viewMain.style.display = "flex";
  btnLogout.hidden = false;
  menuUpload.hidden = false;
  renderPlanNote(entitlement);
  if (!alreadyShowing) {
    watchAutopilot();
    restoreChat();
    askInput.focus();
  }
  void quiet;
}

async function init() {
  const { user_email, access_token } = await getStoredAuth();

  // Signed in before? Paint the last known state immediately, then refresh.
  if (access_token) {
    const { profile_cache } = await chrome.storage.local.get("profile_cache");
    if (profile_cache?.data) showMainView(profile_cache.data, { quiet: true });
  }

  let token = null;
  try { token = await getValidToken(); } catch { token = null; }

  if (!token) {
    if (user_email) await clearAuth();
    showLoginView();
    return;
  }

  try {
    let data;
    try {
      data = await fetchProfile(token);
    } catch (err) {
      if (err?.status !== 401) throw err;
      token = await getValidToken({ force: true });
      data = await fetchProfile(token);
    }
    showMainView(data);
  } catch (err) {
    if (err?.status === 402) return; // paywall already shown
    await clearAuth();
    showLoginView();
  }
}

// ── Thread rendering ────────────────────────────────────────────────────────

function scrollToBottom() {
  scrollArea.scrollTop = scrollArea.scrollHeight;
}

// What's on screen, in a form that can be replayed after a page load.
const threadLog = []; // [{ kind: "user"|"assistant", text, error, file: {name,size,type,role}, textActions }]

function appendMessage(role, text, { error = false, thinking = false, record = true, textActions = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = `msg msg-${role}${error ? " error" : ""}`;
  const bubble = document.createElement("div");
  bubble.className = `bubble${thinking ? " thinking" : ""}`;
  bubble.textContent = text;
  wrap.appendChild(bubble);
  askThread.appendChild(wrap);
  scrollToBottom();
  const entry = { kind: role, text, error, textActions };
  if (record && !thinking) { threadLog.push(entry); persistChat(); }
  return { wrap, bubble, entry };
}

function resolveMessage(pending, text, { error = false, textActions = false } = {}) {
  pending.bubble.classList.remove("thinking");
  pending.bubble.textContent = text;
  if (error) pending.wrap.classList.add("error");
  if (textActions) addTextActions(pending.wrap, text);
  threadLog.push({ kind: "assistant", text, error, textActions });
  persistChat();
  scrollToBottom();
}

function fileKind(file) {
  if (/\.docx?$/i.test(file.name) || /wordprocessingml|msword/.test(file.type)) return "DOCX";
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return "PDF";
  if (/\.(png|jpe?g|webp|heic|heif|gif)$/i.test(file.name) || file.type.startsWith("image/")) return "IMG";
  return "TXT";
}

function buildFileChip(file, { removable = false, onRemove = null, role = "file" } = {}) {
  const chip = document.createElement("div");
  chip.className = "file-chip";
  const kind = fileKind(file);
  const kb = Math.max(1, Math.round(file.size / 1024));
  chip.innerHTML = `<span class="file-icon ${kind.toLowerCase()}">${kind}</span><span class="file-meta"><span class="file-name"></span><span class="file-sub">${role === "resume" ? "Résumé" : "File"} · ${kb} KB</span></span>`;
  chip.querySelector(".file-name").textContent = file.name;
  if (removable) {
    const x = document.createElement("button");
    x.type = "button";
    x.className = "file-remove";
    x.title = "Remove";
    x.textContent = "×";
    x.addEventListener("click", onRemove);
    chip.appendChild(x);
  }
  return chip;
}

function appendUserMessage({ text = "", file = null, role = "file", record = true } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "msg msg-user";
  if (file) wrap.appendChild(buildFileChip(file, { role }));
  if (text) {
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    wrap.appendChild(bubble);
  }
  askThread.appendChild(wrap);
  scrollToBottom();
  if (record) {
    threadLog.push({ kind: "user", text, file: file ? { name: file.name, size: file.size, type: file.type, role } : null });
    persistChat();
  }
  return wrap;
}

// ── Chat persistence (per tab, session storage) ─────────────────────────────
// A page load inside the tab replays the conversation; another tab can pull it
// over with "Move here", like Gemini's side panel.

let currentTabId = null;
let persistTimer = null;

async function getTabId() {
  if (currentTabId != null) return currentTabId;
  const info = await getTabInfo().catch(() => null);
  currentTabId = info?.id ?? null;
  return currentTabId;
}

function chatSnapshot() {
  return {
    log: threadLog.slice(-80),
    history: chatHistory.slice(-30),
    attachments: chatAttachments.map((a) => ({ name: a.name, text: a.text })),
    pendingQuestions,
    at: Date.now(),
  };
}

function persistChat() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    const tabId = await getTabId();
    if (tabId == null || !chrome.storage?.session) return;
    if (!threadLog.length) {
      chrome.storage.session.remove(`chat:${tabId}`).catch(() => {});
      return;
    }
    const info = await getTabInfo().catch(() => null);
    let host = "";
    try { host = new URL(info?.url || "").hostname.replace(/^www\./, ""); } catch { host = ""; }
    const firstUser = threadLog.find((e) => e.kind === "user" && e.text)?.text || threadLog.find((e) => e.kind === "user" && e.file)?.file?.name || "Conversation";
    chrome.storage.session.set({
      [`chat:${tabId}`]: chatSnapshot(),
      chat_recent: { tabId, host, preview: firstUser.slice(0, 80), count: threadLog.length, at: Date.now() },
    }).catch(() => {});
  }, 150);
}

function replayChat(snapshot) {
  askThread.replaceChildren();
  threadLog.length = 0;
  chatHistory.length = 0;
  chatAttachments.length = 0;
  for (const e of snapshot.log || []) {
    if (e.kind === "user") {
      const file = e.file ? { name: e.file.name, size: e.file.size, type: e.file.type } : null;
      appendUserMessage({ text: e.text, file, role: e.file?.role || "file", record: false });
    } else {
      const m = appendMessage("assistant", e.text, { error: Boolean(e.error), record: false });
      if (e.textActions) addTextActions(m.wrap, e.text);
    }
    threadLog.push(e);
  }
  chatHistory.push(...(snapshot.history || []));
  chatAttachments.push(...(snapshot.attachments || []));
  pendingQuestions = snapshot.pendingQuestions || [];
  scrollToBottom();
}

async function restoreChat() {
  if (!chrome.storage?.session) return;
  const tabId = await getTabId();
  if (tabId == null) return;
  const { [`chat:${tabId}`]: own, chat_recent: recent } = await chrome.storage.session.get([`chat:${tabId}`, "chat_recent"]);
  if (own?.log?.length) {
    replayChat(own);
    return;
  }
  // Nothing here — offer the most recent chat from another tab (within a day).
  if (recent && recent.tabId !== tabId && Date.now() - recent.at < 86_400_000) {
    const { [`chat:${recent.tabId}`]: theirs } = await chrome.storage.session.get(`chat:${recent.tabId}`);
    if (!theirs?.log?.length) return;
    $("move-here-title").textContent = recent.preview || "Conversation";
    $("move-here-sub").textContent = `${recent.host ? `On ${recent.host} · ` : ""}${recent.count} message${recent.count === 1 ? "" : "s"}`;
    moveHere.hidden = false;
    btnMoveHere.onclick = async () => {
      moveHere.hidden = true;
      replayChat(theirs);
      await chrome.storage.session.remove(`chat:${recent.tabId}`).catch(() => {});
      persistChat();
      askInput.focus();
    };
    btnMoveDismiss.onclick = () => { moveHere.hidden = true; };
  }
}

function makeButton(className, label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function setTemporaryButtonLabel(button, temporaryText, originalText, duration = 1500) {
  button.textContent = temporaryText;
  setTimeout(() => { button.textContent = originalText; }, duration);
}

function addTextActions(wrap, text) {
  const actions = document.createElement("div");
  actions.className = "answer-actions";
  const insert = makeButton("btn btn-primary", "Insert into focused field", async () => {
    const res = await relayToContent({ type: "CL_INSERT_AT_FOCUS", text });
    if (res?.ok) setTemporaryButtonLabel(insert, "Inserted!", "Insert into focused field");
    else setTemporaryButtonLabel(insert, "Click a field on the page first", "Insert into focused field", 2500);
  });
  const copy = makeButton("btn btn-secondary", "Copy", async () => {
    try { await copyTextToClipboard(text); setTemporaryButtonLabel(copy, "Copied!", "Copy"); }
    catch { setTemporaryButtonLabel(copy, "Copy failed", "Copy"); }
  });
  actions.append(insert, copy);
  wrap.appendChild(actions);
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value.trim()) throw new Error("Nothing to copy yet.");
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return; }
    catch (error) { console.warn("Clipboard API failed, falling back:", error); }
  }
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  Object.assign(textArea.style, { position: "fixed", opacity: "0", pointerEvents: "none", top: "-1000px" });
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("Copy command was rejected.");
  } finally {
    textArea.remove();
  }
}

function setActionBusy(button, busy, busyText = "Working…") {
  const label = button.querySelector(".action-label");
  if (busy) {
    label.dataset.original = label.textContent;
    label.textContent = busyText;
  } else if (label.dataset.original) {
    label.textContent = label.dataset.original;
    delete label.dataset.original;
  }
  button.disabled = busy;
}

// ── Page context for the assistant ──────────────────────────────────────────

async function getJobInfo() {
  return (await relayToContent({ type: "CL_EXTRACT_JOB" })) || null;
}

async function getOtherTabs() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "CL_COLLECT_TAB_CONTEXT" });
    return res?.tabs || [];
  } catch {
    return [];
  }
}

// The most recent chat on another tab, so "the thing we discussed" carries over
// without moving the conversation.
async function getPriorConversation() {
  try {
    const tabId = await getTabId();
    const { chat_recent } = await chrome.storage.session.get("chat_recent");
    if (!chat_recent || chat_recent.tabId === tabId || Date.now() - chat_recent.at > 86_400_000) return [];
    const { [`chat:${chat_recent.tabId}`]: theirs } = await chrome.storage.session.get(`chat:${chat_recent.tabId}`);
    return (theirs?.history || []).slice(-8);
  } catch {
    return [];
  }
}

let lastContext = null;

async function getPageContext({ includeFields = true } = {}) {
  const [tab, job, form, sel, otherTabs, priorConversation] = await Promise.all([
    getTabInfo().catch(() => null),
    getJobInfo(),
    includeFields ? relayToContent({ type: "CL_SCAN_FORM" }) : null,
    relayToContent({ type: "CL_GET_SELECTION" }),
    getOtherTabs(),
    getPriorConversation(),
  ]);
  const ctx = {
    url: tab?.url || "",
    title: tab?.title || "",
    job: job?.title || job?.description ? { title: job.title, company: job.company, description: job.description, url: job.url } : null,
    fields: form?.fields || [],
    selection: sel?.selection || "",
    language: sel?.language || "",
    pendingQuestions: pendingQuestions,
    attachments: chatAttachments.map((a) => ({ name: a.name, text: a.text })),
    otherTabs,
    priorConversation,
  };
  lastContext = ctx;
  return ctx;
}

// ── The assistant loop ──────────────────────────────────────────────────────

const chatHistory = [];       // [{ role, content }] shown in the thread this session
const chatAttachments = [];   // [{ name, text }] files added to this conversation (never stored server-side)
let pendingQuestions = [];    // [{ id, question }] the assistant asked last turn
let turnInFlight = false;

async function runTurn({ intent = "chat", userMessage = null, includeFields = true, alreadyRendered = false, rerun = false } = {}) {
  if (turnInFlight && !rerun) return null;
  const token = await getValidToken();
  if (!token) return null;

  turnInFlight = true;
  askSend.disabled = true;
  if (userMessage) {
    chatHistory.push({ role: "user", content: userMessage });
    if (!alreadyRendered) appendUserMessage({ text: userMessage });
  }
  const pending = appendMessage("assistant", "Thinking…", { thinking: true });

  try {
    const context = await getPageContext({ includeFields });
    const { payload } = await fetchCareerLaunch("/api/extension/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ intent, messages: chatHistory.slice(-14), context }),
    }, {
      fallbackMessage: "The assistant didn't respond",
      timeoutMs: 60000,
      timeoutMessage: "That took too long. Please try again.",
    });

    const turn = payload.data || {};

    // The assistant wants to read another tab first: fetch it, attach it, and
    // answer again with the text in hand (once, so it can't loop).
    const readTab = !rerun && (turn.actions || []).find((a) => a.type === "read_tab");
    if (readTab) {
      const page = await chrome.runtime.sendMessage({ type: "CL_READ_TAB", tabId: readTab.id }).catch(() => null);
      if (page?.text) {
        chatAttachments.push({ name: `Tab: ${page.title || page.url}`, text: page.text });
        pending.bubble.textContent = `Reading "${page.title || "that tab"}"…`;
        turnInFlight = false;
        pending.wrap.remove();
        return await runTurn({ intent, includeFields, rerun: true });
      }
    }

    const notes = await applyTurn(turn, token);
    const reply = [turn.reply, ...notes].filter(Boolean).join("\n");
    resolveMessage(pending, reply || "Done.");
    if (turn.reply) chatHistory.push({ role: "assistant", content: turn.reply });
    pendingQuestions = (turn.ask || []).map((q) => ({ id: q.id, question: q.question }));
    return turn;
  } catch (err) {
    resolveMessage(pending, err.message || "Something went wrong.", { error: true });
    return null;
  } finally {
    turnInFlight = false;
    askSend.disabled = !askInput.value.trim();
    askInput.focus();
  }
}

// Execute what the assistant decided: fills, saved answers for Autopilot, and actions.
async function applyTurn(turn, token) {
  const notes = [];

  if (turn.fill?.length) {
    const pageFills = turn.fill.filter((f) => !String(f.id).startsWith("supp:"));
    const suppFills = turn.fill.filter((f) => String(f.id).startsWith("supp:"));
    if (pageFills.length) {
      const res = await relayToContent({ type: "CL_FILL_FIELDS", fields: pageFills });
      if (res && res.filled < pageFills.length) notes.push(`(${pageFills.length - res.filled} field${pageFills.length - res.filled === 1 ? "" : "s"} couldn't be filled on the page.)`);
    }
    if (suppFills.length) {
      for (const f of suppFills) {
        const key = f.id.slice(5);
        await fetchCareerLaunch("/api/extension/supplemental", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ question_key: key, question_label: key.replace(/_/g, " "), answer: f.value }),
        }, { fallbackMessage: "Could not save" }).catch(() => {});
      }
      if (autopilot.awaitingSupplemental) await resumeAutopilot(token);
    }
  }

  for (const action of turn.actions || []) {
    try {
      const note = await runAction(action, token);
      if (note) notes.push(note);
    } catch (err) {
      notes.push(err.message || "An action failed.");
    }
  }
  return notes;
}

async function runAction(action, token) {
  switch (action.type) {
    case "save_job": return saveCurrentJob(token);
    case "write_cover_letter": return writeCoverLetter(token, action.notes || "");
    case "translate_page": return translatePage(action.target);
    case "insert_text": {
      const res = await relayToContent({ type: "CL_INSERT_AT_FOCUS", text: action.text || "" });
      return res?.ok ? "" : "Click into a field on the page and I'll insert it.";
    }
    case "search_jobs": return searchJobs(action);
    case "start_autopilot": return startAutopilot(token, action);
    case "pause_autopilot":
    case "resume_autopilot":
    case "stop_autopilot": return controlAutopilot(action.type, token);
    case "read_tab": return "";
    case "update_job_status": return updateJobStatus(token, action);
    case "set_resume": {
      const name = action.name || [...attachedFiles.keys()].pop();
      const file = name && attachedFiles.get(name);
      if (!file) return "I don't have that file any more — add it again with + and I'll set it as your résumé.";
      const summary = await uploadResume(file);
      return summary || "";
    }
    default: return "";
  }
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function saveJobToCareerLaunch(token, jobInfo, filledFields = null) {
  try {
    const { payload } = await fetchCareerLaunch("/api/extension/save-job", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ ...jobInfo, filled_fields: filledFields }),
    }, { fallbackMessage: "Could not save job" });
    return payload.data;
  } catch (err) {
    if (err?.status === 402) throw err;
  }
  return null;
}

const STAGE_LABELS = { discovered: "Saved", in_progress: "In progress", applied: "Applied", interviewing: "Interviewing", rejected: "Rejected", offer: "Offer" };

async function saveCurrentJob(token) {
  const info = await getJobInfo();
  if (!info?.title || !info?.url) return "I couldn't find a job posting on this page to save. Open the listing or the application page and try again.";
  const result = await saveJobToCareerLaunch(token, info);
  if (!result) return "Couldn't save this job right now — please try again in a moment.";
  const stage = STAGE_LABELS[result.job?.status] || "In progress";
  return result.created
    ? `Saved "${info.title}"${info.company ? ` at ${info.company}` : ""} to your Applications as ${stage}. Tell me when you've submitted it, hear back, or get an interview and I'll update it.`
    : `"${info.title}" is already in your Applications (${stage}).`;
}

async function updateJobStatus(token, action) {
  const info = await getJobInfo();
  const body = { status: action.status };
  if (!action.company && !action.title && info?.url) body.url = info.url;
  if (action.company) body.company = action.company;
  if (action.title) body.title = action.title;
  try {
    const { payload } = await fetchCareerLaunch("/api/extension/save-job", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body),
    }, { fallbackMessage: "Could not update the job" });
    const job = payload.data?.job;
    return `Marked "${job?.title || "the job"}"${job?.company ? ` at ${job.company}` : ""} as ${STAGE_LABELS[action.status] || action.status}.`;
  } catch (err) {
    if (err?.status === 404) return "I couldn't find that job in your Applications. Save it first, or tell me the company name.";
    if (err?.status === 402) throw err;
    return err.message || "Couldn't update that job.";
  }
}

function findJobElsewhere() {
  const fromTab = lastContext?.otherTabs?.find((t) => t.job?.title);
  if (fromTab) return { ...fromTab.job, via: `the "${fromTab.title}" tab` };
  const jd = chatAttachments.find((a) => /\b(responsibilities|requirements|qualifications|we are looking|about the role)\b/i.test(a.text));
  if (jd) return { title: "", company: "", description: jd.text.slice(0, 6000), via: jd.name };
  return null;
}

async function writeCoverLetter(token, notes = "") {
  let info = await getJobInfo();
  let via = "";
  if (!info?.title && !info?.description) {
    const elsewhere = findJobElsewhere();
    if (!elsewhere) return "I couldn't find a job posting on this page or your other tabs. Open the listing, or add the description with +, and I'll write it.";
    info = elsewhere;
    via = elsewhere.via;
  }

  const { payload } = await fetchCareerLaunch("/api/extension/generate-cover-letter", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ jobTitle: info.title, companyName: info.company, jobDescription: info.description, notes }),
  }, {
    fallbackMessage: "Generation failed",
    timeoutMs: 60000,
    timeoutMessage: "Cover letter generation took too long. Please try again.",
  });
  const coverLetter = payload.data?.coverLetter?.trim();
  if (!coverLetter) return "The AI returned an empty cover letter — try again.";

  const fillRes = await relayToContent({ type: "CL_FILL_COVER_LETTER", text: coverLetter });
  if (fillRes?.ok) return `Cover letter for ${info.title || "this role"}${info.company ? ` at ${info.company}` : ""}${via ? ` (from ${via})` : ""} written into the page.`;

  const msg = appendMessage("assistant", coverLetter, { textActions: true });
  addTextActions(msg.wrap, coverLetter);
  return "";
}

let pageTranslated = false;

async function translatePage(target) {
  const lang = target || (navigator.language || "en").split("-")[0];
  const res = await relayToContent({ type: "CL_TRANSLATE_PAGE", target: lang });
  if (res?.ok) {
    pageTranslated = true;
    btnTranslate.querySelector(".action-label").textContent = "Show original";
    return `Translated the page from ${res.source.toUpperCase()} to ${lang.toUpperCase()} (${res.translated} pieces of text). Anything you've typed into fields is untouched.`;
  }
  if (res?.unsupported) {
    const info = await getTabInfo();
    const url = `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(lang)}&u=${encodeURIComponent(info?.url || "")}`;
    chrome.tabs?.create ? chrome.tabs.create({ url }) : window.open(url, "_blank");
    return "This Chrome can't translate on-device yet, so I opened the page in Google Translate. You can also select any text here and ask me to translate it.";
  }
  return res?.error || "Couldn't translate this page.";
}

async function restoreTranslation() {
  await relayToContent({ type: "CL_RESTORE_TRANSLATION" });
  pageTranslated = false;
  btnTranslate.querySelector(".action-label").textContent = "Translate this page";
}

const INDEED_JT = { fulltime: "fulltime", parttime: "parttime", contract: "contract", temporary: "temporary", internship: "internship" };

function indeedSearchUrl({ keywords, location, jobTypes }) {
  const params = new URLSearchParams();
  if (keywords) params.set("q", keywords);
  if (location) params.set("l", location);
  if (jobTypes?.length === 1 && INDEED_JT[jobTypes[0]]) params.set("jt", INDEED_JT[jobTypes[0]]);
  return `https://www.indeed.com/jobs?${params}`;
}

async function searchJobs(action) {
  const url = indeedSearchUrl(action);
  await chrome.storage.local.set({ jobPrefs: { keywords: action.keywords || "", location: action.location || "", jobTypes: action.jobTypes || [] } });
  chrome.tabs?.create ? chrome.tabs.create({ url }) : window.open(url, "_blank");
  return "Opened Indeed in a new tab. When you're on the results, open me there and say \"apply to these\" to start Autopilot.";
}

// ── Autopilot (driven from chat, silent otherwise) ──────────────────────────
// No status card: the assistant only speaks up when Autopilot needs an answer
// or when it finishes. "pause" / "resume" / "stop" in the chat control it.

const autopilot = { poll: null, awaitingSupplemental: false, announcedDone: false };

function stopAutopilotPolling() {
  if (autopilot.poll) clearInterval(autopilot.poll);
  autopilot.poll = null;
}

async function resumeAutopilot(token) {
  const updated = await fetchProfile(token);
  autopilot.awaitingSupplemental = false;
  await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_RESUME", profile: updated.profile, supplemental: updated.supplemental });
}

async function pollAutopilot() {
  let state;
  try { ({ state } = await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_STATUS" })); }
  catch { return; }

  if (!state?.active) {
    stopAutopilotPolling();
    if (!autopilot.announcedDone && state?.appliedCount) {
      autopilot.announcedDone = true;
      appendMessage("assistant", `Autopilot finished — applied to ${state.appliedCount} job${state.appliedCount === 1 ? "" : "s"}. Details are on your dashboard.`);
    }
    return;
  }

  if (state.paused && state.pauseReason === "missing_supplemental" && state.pendingSupplemental?.length && !autopilot.awaitingSupplemental) {
    autopilot.awaitingSupplemental = true;
    const qs = state.pendingSupplemental.map((f) => ({
      id: `supp:${f.fieldName}`,
      question: f.options?.length ? `${f.pageLabel} (options: ${f.options.join(", ")})` : f.pageLabel,
    }));
    pendingQuestions = qs;
    const applied = state.appliedCount || 0;
    const total = state.jobQueue?.length || 0;
    appendMessage("assistant", `Autopilot needs a few answers to keep going (${applied}/${total} done):\n` + qs.map((q, i) => `${i + 1}. ${q.question}`).join("\n") + "\n\nAnswer here and I'll save them and continue.");
    chatHistory.push({ role: "assistant", content: "Autopilot needs: " + qs.map((q) => q.question).join("; ") });
  }
}

function watchAutopilot() {
  stopAutopilotPolling();
  autopilot.announcedDone = false;
  autopilot.poll = setInterval(pollAutopilot, 3000);
  pollAutopilot();
}

async function controlAutopilot(action, token) {
  const { state } = await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_STATUS" });
  if (!state?.active) return "Autopilot isn't running right now.";
  const applied = state.appliedCount || 0;
  const total = state.jobQueue?.length || 0;
  if (action === "pause_autopilot") {
    await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_PAUSE" });
    return `Paused Autopilot at ${applied}/${total}. Say "resume" when you're ready.`;
  }
  if (action === "resume_autopilot") {
    await resumeAutopilot(token);
    return `Resuming Autopilot (${applied}/${total} done).`;
  }
  await chrome.runtime.sendMessage({ type: "CL_AUTOPILOT_STOP" });
  stopAutopilotPolling();
  return `Stopped Autopilot after ${applied} application${applied === 1 ? "" : "s"}.`;
}

async function startAutopilot(token, action = {}) {
  const tab = await getTabInfo().catch(() => null);
  const onIndeed = /indeed\.com\/jobs/.test(tab?.url || "");
  if (!onIndeed) {
    const stored = (await chrome.storage.local.get("jobPrefs")).jobPrefs || {};
    const url = indeedSearchUrl({ ...stored, ...action });
    chrome.tabs?.create ? chrome.tabs.create({ url }) : window.open(url, "_blank");
    return "Autopilot works from an Indeed results page — I opened one for you. Open me there and say \"apply to these\".";
  }

  const scan = await relayToContent({ type: "CL_FIND_INDEED_JOBS", jobTypes: action.jobTypes || [] });
  if (!scan?.jobs?.length) return "I don't see matching jobs on this page. Adjust the search and try again.";

  let status = null;
  try {
    const resp = await fetchCareerLaunch("/api/extension/autopilot/complete", { method: "GET", headers: { "Authorization": `Bearer ${token}` } }, { fallbackMessage: "Could not check status" });
    status = resp.payload.data;
  } catch { status = null; }
  if (status?.paywalled) return "Your plan's auto-apply limit is reached. Upgrade on the website to keep going.";

  const profileData = await fetchProfile(token);
  const limit = Math.min(action.limit || scan.jobs.length, status?.limit ?? 10);
  await chrome.runtime.sendMessage({
    type: "CL_AUTOPILOT_START",
    jobQueue: scan.jobs.slice(0, limit),
    maxApplications: limit,
    token,
    baseUrl: activeBaseUrl,
    profile: profileData.profile,
    supplemental: profileData.supplemental,
  });
  watchAutopilot();
  return `Autopilot started on ${Math.min(limit, scan.jobs.length)} jobs. I'll only check in if I need an answer, or say "pause" / "stop" any time.`;
}

// ── Quick actions ───────────────────────────────────────────────────────────

btnAutofill.addEventListener("click", async () => {
  const token = await getValidToken();
  if (!token) return;
  setActionBusy(btnAutofill, true, "Filling…");
  try {
    // 1) Deterministic pass from the profile — instant, no tokens.
    const profileData = cachedProfile?.profile ? cachedProfile : await fetchProfile(token);
    cachedProfile = profileData;
    const local = await relayToContent({ type: "CL_AUTOFILL", profile: profileData.profile || {}, supplemental: profileData.supplemental || {} });
    if (local?.jobInfo?.url) saveJobToCareerLaunch(token, local.jobInfo, local.filled_fields).catch(() => {});
    if (local?.no_fields) {
      appendMessage("assistant", "I don't see a form on this page. Open an application page and try again.");
      return;
    }
    if (local?.filled > 0) {
      appendMessage("assistant", `Filled ${local.filled} field${local.filled === 1 ? "" : "s"} from your profile. Checking the rest…`);
    }
    // 2) The assistant handles everything the matcher couldn't, and asks for what it doesn't know.
    await runTurn({ intent: "fill_form" });
  } catch (err) {
    if (err?.status !== 402) appendMessage("assistant", err.message || "Couldn't fill this form.", { error: true });
  } finally {
    setActionBusy(btnAutofill, false);
  }
});

btnCoverLetter.addEventListener("click", async () => {
  setActionBusy(btnCoverLetter, true, "Reading the posting…");
  try {
    await runTurn({ intent: "cover_letter", includeFields: false });
  } finally {
    setActionBusy(btnCoverLetter, false);
  }
});

btnSaveJob.addEventListener("click", async () => {
  const token = await getValidToken();
  if (!token) return;
  setActionBusy(btnSaveJob, true, "Saving…");
  try {
    appendMessage("assistant", await saveCurrentJob(token));
  } catch (err) {
    if (err?.status !== 402) appendMessage("assistant", err.message || "Couldn't save this job.", { error: true });
  } finally {
    setActionBusy(btnSaveJob, false);
  }
});

btnTranslate.addEventListener("click", async () => {
  if (pageTranslated) { await restoreTranslation(); return; }
  setActionBusy(btnTranslate, true, "Translating…");
  try {
    appendMessage("assistant", await translatePage());
  } catch (err) {
    appendMessage("assistant", err.message || "Couldn't translate this page.", { error: true });
  } finally {
    setActionBusy(btnTranslate, false);
    if (pageTranslated) btnTranslate.querySelector(".action-label").textContent = "Show original";
  }
});

// ── Ask box ─────────────────────────────────────────────────────────────────

function autosizeAsk() {
  askInput.style.height = "auto";
  askInput.style.height = `${Math.min(askInput.scrollHeight, 120)}px`;
  askSend.disabled = turnInFlight || (!askInput.value.trim() && !pendingFile);
}

async function submitAsk() {
  const question = askInput.value.trim();
  const file = pendingFile;
  if ((!question && !file) || turnInFlight) return;
  askInput.value = "";
  clearPendingFile();
  autosizeAsk();

  if (!file) {
    await runTurn({ intent: "chat", userMessage: question });
    return;
  }

  // The file goes with the message, ChatGPT-style: chip + text in one user turn.
  appendUserMessage({ text: question, file: file.file, role: file.role });

  if (file.role === "resume") {
    const summary = await uploadResume(file.file);
    if (!summary) return; // error already shown
    if (question) {
      await runTurn({ intent: "chat", userMessage: `${question}\n(attached résumé: ${file.file.name} — now on file)`, alreadyRendered: true });
    } else {
      appendMessage("assistant", summary);
      chatHistory.push({ role: "user", content: `(attached résumé: ${file.file.name})` }, { role: "assistant", content: summary });
    }
    return;
  }

  const extracted = await extractAttachment(file.file);
  if (!extracted) return;

  // Looks like a résumé and there's none on file → it becomes the résumé, no questions asked.
  if (extracted.looksLikeResume && !cachedProfile?.profile) {
    const summary = await uploadResume(file.file);
    if (!summary) return;
    if (question) {
      await runTurn({ intent: "chat", userMessage: `${question}\n(attached résumé: ${file.file.name} — now on file)`, alreadyRendered: true });
    } else {
      appendMessage("assistant", summary);
      chatHistory.push({ role: "user", content: `(attached résumé: ${file.file.name})` }, { role: "assistant", content: summary });
    }
    return;
  }

  chatAttachments.push(extracted);
  attachedFiles.set(extracted.name, file.file);
  let note = `(attached file: ${extracted.name}${extracted.truncated ? ", long — first part only" : ""})`;
  if (extracted.looksLikeResume) {
    note += " This looks like a résumé and the user already has one on file — ask in one short sentence whether to replace it, unless the message already says.";
  }
  if (question) {
    await runTurn({ intent: "chat", userMessage: `${question}\n${note}`, alreadyRendered: true });
  } else {
    await runTurn({ intent: "chat", userMessage: `${note} What's in it, briefly, and how can you use it here?`, alreadyRendered: true });
  }
}

askInput.addEventListener("input", autosizeAsk);
askInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submitAsk();
  }
});
askSend.addEventListener("click", submitAsk);

// ── Attachments (the + button) ──────────────────────────────────────────────
// Picking a file parks it in the composer as a chip; it's uploaded when the
// message is sent, and from then on it's context for every turn.

let pendingFile = null; // { file, role: "file" | "resume" }
let pickRole = "file";
const attachedFiles = new Map(); // name → File, kept for a later "use this as my résumé"

const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.webp,.heic,.heif,.gif,image/*";
const ACCEPT = {
  file: `.pdf,.docx,.doc,.txt,.md,.csv,${IMAGE_ACCEPT},application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/markdown,text/csv`,
  resume: `.pdf,.docx,.doc,${IMAGE_ACCEPT},application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword`,
};

function renderPendingFile() {
  composerFiles.replaceChildren();
  if (!pendingFile) { composerFiles.hidden = true; return; }
  composerFiles.appendChild(buildFileChip(pendingFile.file, { role: pendingFile.role, removable: true, onRemove: () => { clearPendingFile(); autosizeAsk(); } }));
  composerFiles.hidden = false;
}

function clearPendingFile() {
  pendingFile = null;
  resumeFile.value = "";
  renderPendingFile();
}

function openPicker(role) {
  closeMenu();
  pickRole = role;
  resumeFile.accept = ACCEPT[role];
  resumeFile.value = "";
  resumeFile.click();
}

askAttach.addEventListener("click", () => openPicker("file"));
menuUpload.addEventListener("click", () => openPicker("resume"));

resumeFile.addEventListener("change", () => {
  const file = resumeFile.files?.[0];
  if (!file) return;
  pendingFile = { file, role: pickRole };
  renderPendingFile();
  autosizeAsk();
  askInput.focus();
});

// Extracts an attachment's text for this conversation; returns { name, text, truncated } or null.
async function extractAttachment(file) {
  const token = await getValidToken();
  if (!token) return null;
  const pending = appendMessage("assistant", `Reading ${file.name}…`, { thinking: true });
  try {
    const form = new FormData();
    form.append("file", file);
    const { payload } = await fetchCareerLaunch("/api/extension/attachments", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: form,
    }, { fallbackMessage: "Couldn't read that file", timeoutMs: 90000, timeoutMessage: "Reading the file took too long. Please try again." });
    pending.wrap.remove();
    const data = payload.data || {};
    return { name: data.name || file.name, text: data.text || "", truncated: Boolean(data.truncated), looksLikeResume: Boolean(data.looksLikeResume) };
  } catch (err) {
    if (err?.status !== 402) resolveMessage(pending, err.message || "Couldn't read that file.", { error: true });
    else pending.wrap.remove();
    return null;
  }
}

// Uploads + parses the résumé; returns a one-line summary or null on failure.
async function uploadResume(file) {
  const token = await getValidToken();
  if (!token) return null;
  const pending = appendMessage("assistant", `Reading ${file.name}…`, { thinking: true });
  askAttach.disabled = true;
  try {
    const form = new FormData();
    form.append("file", file);
    const { payload } = await fetchCareerLaunch("/api/resume/upload", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }, // browser sets the multipart boundary
      body: form,
    }, { fallbackMessage: "Upload failed", timeoutMs: 90000, timeoutMessage: "The upload took too long. Please try again." });

    const parsed = payload.data || {};
    const name = parsed.personal?.name || "your résumé";
    const roles = parsed.experience?.length || 0;
    const skills = parsed.skills?.length || 0;
    cachedProfile = null; // refetch on next fill so the new résumé is used
    pending.wrap.remove();
    return `Got it — ${name}, ${roles} role${roles === 1 ? "" : "s"}, ${skills} skill${skills === 1 ? "" : "s"}. I'll use this for forms, answers, and cover letters from now on.`;
  } catch (err) {
    if (err?.status !== 402) resolveMessage(pending, err.message || "Couldn't read that file.", { error: true });
    else pending.wrap.remove();
    return null;
  } finally {
    askAttach.disabled = false;
  }
}

// ── Menu / misc ─────────────────────────────────────────────────────────────

function closeMenu() {
  menu.hidden = true;
  btnMenu.setAttribute("aria-expanded", "false");
}

btnMenu.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = menu.hidden;
  menu.hidden = !open;
  btnMenu.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (event) => {
  if (!menu.hidden && !menu.contains(event.target)) closeMenu();
});
openDashboard.addEventListener("click", closeMenu);

menuClear.addEventListener("click", () => {
  closeMenu();
  askThread.replaceChildren();
  chatHistory.length = 0;
  chatAttachments.length = 0;
  attachedFiles.clear();
  threadLog.length = 0;
  pendingQuestions = [];
  clearPendingFile();
  persistChat();
});

btnHide.addEventListener("click", async () => {
  closeMenu();
  try { await relayToContent({ type: "CL_DISMISS_ASSISTANT" }); }
  catch (error) { console.warn("Dismiss relay failed:", error); }
});

btnClose.addEventListener("click", async (event) => {
  event.preventDefault();
  try {
    const response = await relayToContent({ type: "CL_CLOSE_ASSISTANT" });
    if (response?.ok) return;
  } catch (error) { console.warn("Direct close relay failed:", error); }
  try { await chrome.runtime.sendMessage({ type: "CL_TOGGLE_SELF" }); }
  catch (error) { console.error("Close failed:", error); }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { event.preventDefault(); btnClose.click(); return; }
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === "KeyX") {
    event.preventDefault();
    btnClose.click();
  }
});

btnLogin.addEventListener("click", async () => {
  loginError.style.display = "none";
  btnLogin.disabled = true;
  const original = btnLogin.innerHTML;
  btnLogin.textContent = "Opening Google…";
  try {
    const auth = await signInWithGoogle();
    await storeSession(auth, auth.user?.email ?? "");
    showMainView(await fetchProfile(auth.access_token));
  } catch (err) {
    if (err?.status !== 402) {
      loginError.textContent = err.message ?? "Sign in failed";
      loginError.style.display = "block";
    }
  } finally {
    btnLogin.disabled = false;
    btnLogin.innerHTML = original;
  }
});

btnLogout.addEventListener("click", async () => {
  closeMenu();
  await clearAuth();
  await chrome.storage.local.remove("profile_cache");
  cachedProfile = null;
  showLoginView();
});

btnPaywallRefresh.addEventListener("click", () => init());

// ── Boot ────────────────────────────────────────────────────────────────────
init();
