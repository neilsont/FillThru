// CareerLaunch Browser Extension — Popup
// Connects to CareerLaunch website and coordinates auto-fill

const BASE_URL = "https://career-launch-taylorneilson-projects.vercel.app"; // production URL
const SUPABASE_URL = "https://jxricnvgdaktresxfwqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iyRuOLc1Nwwk_fb0frFVIQ_gDSBadVw";

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
const alertsList    = document.getElementById("alerts-list");
const alertCount    = document.getElementById("alert-count");

openDashboard.href = BASE_URL + "/dashboard";

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
  const res = await fetch(`${BASE_URL}/api/extension/profile`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not fetch profile");
  return res.json();
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

// ── Current tab info ───────────────────────────────────────────────────────────

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function updatePageInfo() {
  try {
    const tab = await getCurrentTab();
    if (tab?.url) {
      const url = new URL(tab.url);
      pageHost.textContent = `Current page: ${url.hostname}`;
    } else {
      pageHost.textContent = "No active page";
    }
  } catch {
    pageHost.textContent = "Unable to detect page";
  }
}

// ── Autofill ──────────────────────────────────────────────────────────────────

async function runAutofill() {
  const { access_token } = await getStoredAuth();
  if (!access_token) return;

  btnAutofill.disabled = true;
  autofillBadge.textContent = "Filling…";
  autofillBadge.className = "badge badge-warn";
  fillResult.style.display = "none";

  try {
    const profileData = await fetchProfile(access_token);
    const tab = await getCurrentTab();
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "CL_AUTOFILL",
      profile: profileData.profile,
      supplemental: profileData.supplemental,
    });

    // Always save the job being applied to, regardless of fill success
    if (response?.jobInfo) {
      await saveJobToCareerLaunch(access_token, response.jobInfo);
    }

    if (response?.filled > 0) {
      autofillBadge.textContent = `${response.filled} filled`;
      autofillBadge.className = "badge badge-ok";
      showFillResult("success", `Filled ${response.filled} field${response.filled !== 1 ? "s" : ""}.${response.skipped > 0 ? ` ${response.skipped} field${response.skipped !== 1 ? "s" : ""} need your attention.` : ""}`);
    } else if (response?.no_fields) {
      autofillBadge.textContent = "No fields";
      autofillBadge.className = "badge badge-idle";
      showFillResult("warn", "No fillable application fields detected on this page.");
    } else {
      autofillBadge.textContent = "Done";
      autofillBadge.className = "badge badge-idle";
      showFillResult("warn", "No fields were filled. This page may require manual input.");
    }

    if (response?.alerts?.length > 0) {
      for (const alert of response.alerts) {
        await sendAlert(access_token, alert);
      }
      loadAlerts();
    }
  } catch (err) {
    autofillBadge.textContent = "Error";
    autofillBadge.className = "badge badge-error";
    showFillResult("error", "Could not fill: " + (err.message ?? "Unknown error"));
  } finally {
    btnAutofill.disabled = false;
  }
}

async function saveJobToCareerLaunch(token, jobInfo) {
  try {
    await fetch(`${BASE_URL}/api/extension/save-job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(jobInfo),
    });
  } catch {
    // best-effort — don't block the user if this fails
  }
}

async function sendAlert(token, alert) {
  try {
    await fetch(`${BASE_URL}/api/extension/alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(alert),
    });
  } catch {
    // best-effort
  }
}

// ── Load alerts ───────────────────────────────────────────────────────────────

async function loadAlerts() {
  const { alerts = [] } = await new Promise((r) => chrome.storage.local.get("alerts", r));
  if (alerts.length === 0) {
    alertsList.innerHTML = '<p class="hint">No pending alerts</p>';
    alertCount.style.display = "none";
    return;
  }
  alertCount.style.display = "inline";
  alertCount.textContent = alerts.length;
  alertsList.innerHTML = alerts.map((a) => `
    <div class="alert-item">
      <div class="alert-company">${a.company ?? a.job_url ?? "Unknown site"}</div>
      <div class="alert-detail">${a.blocker_detail ?? "Manual action required"}</div>
    </div>
  `).join("");
}

// ── Main init ─────────────────────────────────────────────────────────────────

async function init() {
  const { access_token, user_email } = await getStoredAuth();

  if (access_token && user_email) {
    try {
      const data = await fetchProfile(access_token);
      showMainView(data, user_email);
      setStatus(true);
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
