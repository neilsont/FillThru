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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  // ── Relay Logic for Injected Overlay ──

  if (message.type === "CL_RELAY_TO_CONTENT") {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, message.payload).then(sendResponse);
      return true; // async response from content script
    }
    sendResponse({ error: "No active tab context" });
    return false;
  }

  if (message.type === "CL_GET_CURRENT_TAB_INFO") {
    if (sender.tab) {
      sendResponse({ url: sender.tab.url, title: sender.tab.title });
    } else {
      // Fallback: This might happen if called from outside a tab context
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab) sendResponse({ url: tab.url, title: tab.title });
        else sendResponse(null);
      });
      return true;
    }
    return false;
  }

  if (message.type === "CL_TOGGLE_SELF") {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: "CL_TOGGLE_OVERLAY" }).then(sendResponse);
      return true;
    }
    sendResponse({ error: "No active tab context" });
    return false;
  }
});

// ── On install ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  setActionBadge("", null);
});

// ── Action (Icon Click) ───────────────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  // If the browser UI can't be injected (e.g. chrome:// or edge:// pages), skip
  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) return;

  try {
    // Send message to content script to toggle the overlay
    await chrome.tabs.sendMessage(tab.id, { type: "CL_TOGGLE_OVERLAY" });
  } catch (err) {
    // Content script might not be injected yet. Inject it and retry.
    if (err.message.includes("Could not establish connection") || err.message.includes("Receiving end does not exist")) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      // Wait a bit for initialization
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: "CL_TOGGLE_OVERLAY" }).catch(() => {});
      }, 200);
    }
  }
});

// ── Init ─────────────────────────────────────────────────────────────────

updateBadgeCount();
