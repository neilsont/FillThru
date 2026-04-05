// CareerLaunch Browser Extension — Popup
// Connects to CareerLaunch website and coordinates auto-fill

const BASE_URL = "https://career-launch-taylorneilson-projects.vercel.app"; // production URL
const SUPABASE_URL = "https://jxricnvgdaktresxfwqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iyRuOLc1Nwwk_fb0frFVIQ_gDSBadVw";

// ── DOM refs ────────────────────────────────────────────────────────────────
const viewLogin = document.getElementById("view-login");
const viewMain  = document.getElementById("view-main");
const loginEmail    = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError    = document.getElementById("login-error");
const btnLogin      = document.getElementById("btn-login");
const btnLogout     = document.getElementById("btn-logout");
const btnAutofill   = document.getElementById("btn-autofill");
const statusDot     = document.getElementById("status-dot");
const autofillBadge = document.getElementById("autofill-badge");
const fillResult    = document.getElementById("fill-result");
const pageHost      = document.getElementById("page-host");
const profileName   = document.getElementById("profile-name");
const profileEmail  = document.getElementById("profile-email");
const avatarInitials = document.getElementById("avatar-initials");
const profileSummary = document.getElementById("profile-summary");
const openDashboard  = document.getElementById("open-dashboard");
const alertsList    = document.getElementById("alerts-list");
const alertCount    = document.getElementById("alert-count");

openDashboard.href = BASE_URL + "/dashboard";

// ── Auth helpers ─────────────────────────────────────────────────────────────

async function supabaseSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || err.msg || "Sign in failed");
  }
  return res.json(); // { access_token, refresh_token, user, ... }
}

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
    headers: { "Cookie": `sb-access-token=${token}` },
    credentials: "include",
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
  profileEmail.textContent = email ?? "";
  avatarInitials.textContent = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  const skills = profile?.skills?.slice(0, 10) ?? [];
  profileSummary.innerHTML = `
    ${p.name ? `<div class="profile-field"><span class="profile-key">Name</span><span class="profile-val">${p.name}</span></div>` : ""}
    ${p.email ? `<div class="profile-field"><span class="profile-key">Email</span><span class="profile-val">${p.email}</span></div>` : ""}
    ${p.phone ? `<div class="profile-field"><span class="profile-key">Phone</span><span class="profile-val">${p.phone}</span></div>` : ""}
    ${p.location ? `<div class="profile-field"><span class="profile-key">Location</span><span class="profile-val">${p.location}</span></div>` : ""}
    ${p.linkedin ? `<div class="profile-field"><span class="profile-key">LinkedIn</span><span class="profile-val">${p.linkedin}</span></div>` : ""}
    ${skills.length > 0 ? `
      <div class="profile-field" style="flex-direction:column; align-items:flex-start;">
        <span class="profile-key" style="margin-bottom:4px;">Skills</span>
        <div class="skill-chips">${skills.map((s) => `<span class="skill-chip">${s}</span>`).join("")}</div>
      </div>
    ` : ""}
    ${!p.name && !p.email ? '<div class="hint">No resume uploaded yet. Visit the dashboard to upload.</div>' : ""}
  `;
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
    // Fetch latest profile
    const profileData = await fetchProfile(access_token);

    // Send to content script
    const tab = await getCurrentTab();
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "CL_AUTOFILL",
      profile: profileData.profile,
      supplemental: profileData.supplemental,
    });

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

    // Handle any blockers the content script flagged
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

async function sendAlert(token, alert) {
  try {
    await fetch(`${BASE_URL}/api/extension/alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `sb-access-token=${token}`,
      },
      credentials: "include",
      body: JSON.stringify(alert),
    });
  } catch {
    // best-effort
  }
}

// ── Load alerts from storage ──────────────────────────────────────────────────

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
    // Check if still valid by fetching profile
    try {
      const data = await fetchProfile(access_token);
      showMainView(data, user_email);
      setStatus(true);
    } catch {
      // Token expired
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
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  loginError.style.display = "none";

  if (!email || !password) {
    loginError.textContent = "Please enter your email and password.";
    loginError.style.display = "block";
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Signing in…";

  try {
    const auth = await supabaseSignIn(email, password);
    await storeAuth(auth.access_token, email, auth.user?.id);
    const profileData = await fetchProfile(auth.access_token);
    showMainView(profileData, email);
    setStatus(true);
  } catch (err) {
    loginError.textContent = err.message ?? "Sign in failed";
    loginError.style.display = "block";
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Sign in";
  }
});

loginPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLogin.click();
});

btnLogout.addEventListener("click", async () => {
  await clearAuth();
  showLoginView();
  setStatus(false);
});

btnAutofill.addEventListener("click", runAutofill);

// ── Boot ───────────────────────────────────────────────────────────────────────
init();
