// CareerLaunch — Background Service Worker
// Handles badge updates, alert notifications, and tab monitoring

// ── Badge helper ───────────────────────────────────────────────────────────

function setActionBadge(text, color) {
  chrome.action.setBadgeText({ text: text ?? "" });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}

// ── Alert notifications ───────────────────────────────────────────────────

async function storeAlert(alert) {
  const { alerts = [] } = await chrome.storage.local.get("alerts");
  // Deduplicate by url + type
  const key = `${alert.job_url}|${alert.blocker_type}`;
  if (!alerts.some((a) => `${a.job_url}|${a.blocker_type}` === key)) {
    alerts.unshift(alert);
    await chrome.storage.local.set({ alerts: alerts.slice(0, 20) }); // cap at 20
    updateBadgeCount();
    showNotification(alert);
  }
}

async function updateBadgeCount() {
  const { alerts = [] } = await chrome.storage.local.get("alerts");
  const count = alerts.length;
  if (count > 0) {
    setActionBadge(String(count), "#b8941f"); // gold
  } else {
    setActionBadge("", null);
  }
}

function showNotification(alert) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: "CareerLaunch — Action Required",
    message: alert.blocker_detail ?? "A job application needs your attention",
    priority: 1,
  });
}

// ── Listen for messages from content script / popup ───────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CL_STORE_ALERT") {
    storeAlert(message.alert).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "CL_CLEAR_ALERTS") {
    chrome.storage.local.set({ alerts: [] }).then(() => {
      setActionBadge("", null);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "CL_GET_ALERTS") {
    chrome.storage.local.get("alerts").then(({ alerts = [] }) => {
      sendResponse({ alerts });
    });
    return true;
  }
});

// ── On install ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  setActionBadge("", null);
});

// ── Init ─────────────────────────────────────────────────────────────────

updateBadgeCount();
