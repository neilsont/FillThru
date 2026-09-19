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
    title: "Fillthru — Action Required",
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

  async function broadcastToTab(tabId, payload) {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      const framesWithResponse = await Promise.all(
        frames.map((f) =>
          chrome.tabs.sendMessage(tabId, payload, { frameId: f.frameId })
            .then(res => ({ ...res, frameId: f.frameId }))
            .catch(() => null)
        )
      );
      // Return the first non-null, non-empty response
      return framesWithResponse.find((r) => r && (r.title || r.ok)) || 
             framesWithResponse.find((r) => r !== null) || 
             null;
    } catch (err) {
      console.error("Broadcast failed:", err);
      return null;
    }
  }

  if (message.type === "CL_RELAY_TO_CONTENT") {
    const tabId = sender.tab?.id;
    if (tabId) {
      broadcastToTab(tabId, message.payload).then(sendResponse);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          broadcastToTab(tab.id, message.payload).then(sendResponse);
        } else {
          sendResponse({ error: "No active tab context" });
        }
      });
    }
    return true;
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
      chrome.tabs.sendMessage(tabId, { type: "CL_CLOSE_ASSISTANT" }).then(sendResponse);
      return true;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "CL_CLOSE_ASSISTANT" }).then(sendResponse).catch((error) => {
          sendResponse({ error: error?.message || "Could not close overlay" });
        });
      } else {
        sendResponse({ error: "No active tab context" });
      }
    });
    return true;
  }
});

// ── Autopilot State Machine ───────────────────────────────────────────────
//
// State lives in chrome.storage.local under key "autopilot".
// The popup starts/stops autopilot; background.js drives it tab-by-tab
// by listening to chrome.tabs.onUpdated (page load complete).

const AUTOPILOT_STEP_DELAY_MS = 2000; // wait after page load before acting

async function getAutopilotState() {
  const { autopilot } = await chrome.storage.local.get("autopilot");
  return autopilot || null;
}

async function setAutopilotState(patch) {
  const current = await getAutopilotState() || {};
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ autopilot: next });
  return next;
}

async function clearAutopilotState() {
  await chrome.storage.local.remove("autopilot");
}

async function sendToAutopilotTab(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    return null;
  }
}

async function runAutopilotStep(tabId) {
  const state = await getAutopilotState();
  if (!state?.active || state.paused) return;

  // Detect what's on the current page
  const pageState = await sendToAutopilotTab(tabId, { type: "CL_DETECT_PAGE_STATE" });
  if (!pageState) {
    await setAutopilotState({ currentStep: "waiting_nav" });
    return;
  }

  // Application complete — record and move on
  if (pageState.isCompletionPage) {
    const jobInfo = pageState.jobInfo;
    if (jobInfo?.url || jobInfo?.jobUrl) {
      // Notify the server that this application is done
      try {
        await fetch(`${state.baseUrl}/api/extension/autopilot/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
          body: JSON.stringify({ jobUrl: jobInfo.url || jobInfo.jobUrl, title: jobInfo.title, company: jobInfo.company }),
        });
      } catch { /* best-effort */ }
    }

    const appliedCount = (state.appliedCount || 0) + 1;
    await setAutopilotState({ appliedCount, currentStep: "done_job" });
    await advanceAutopilotToNextJob(tabId, state, appliedCount);
    return;
  }

  // Blocker — pause and notify
  if (pageState.hasBlocker) {
    await setAutopilotState({ active: true, paused: true, pauseReason: "blocker", currentStep: "paused" });
    chrome.notifications.create({
      type: "basic", iconUrl: "icons/icon48.png",
      title: "Fillthru Autopilot Paused",
      message: `Manual action required: ${pageState.blockerType || "blocker detected"}. Open the extension to resume.`,
      priority: 2,
    });
    return;
  }

  // Application page — fill, answer, advance
  if (pageState.isApplicationPage) {
    await setAutopilotState({ currentStep: "filling" });

    // 1. Standard autofill (resume fields)
    const autofillResult = await sendToAutopilotTab(tabId, {
      type: "CL_AUTOFILL",
      profile: state.profile,
      supplemental: state.supplemental,
    });

    // 2. If missing supplemental fields, pause and let user fill them
    if (autofillResult?.skippedFields?.length > 0) {
      await setAutopilotState({
        active: true, paused: true, pauseReason: "missing_supplemental",
        currentStep: "paused", pendingSupplemental: autofillResult.skippedFields,
      });
      chrome.notifications.create({
        type: "basic", iconUrl: "icons/icon48.png",
        title: "Fillthru Autopilot Paused",
        message: `Need ${autofillResult.skippedFields.length} answer(s) to continue. Open the extension.`,
        priority: 2,
      });
      return;
    }

    // 3. Scan and AI-answer custom questions
    await setAutopilotState({ currentStep: "answering" });
    const scanResult = await sendToAutopilotTab(tabId, { type: "CL_SCAN_QUESTIONS" });
    const questions = (scanResult?.questions || []).filter((q) => !q.isFilled);

    if (questions.length > 0) {
      try {
        const jobContext = pageState.jobInfo || {};
        const resp = await fetch(`${state.baseUrl}/api/extension/answer-questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.token}` },
          body: JSON.stringify({
            questions: questions.map((q) => ({
              id: q.id, label: q.label, type: q.type,
              options: q.options || [], helpText: q.helpText || "",
              placeholder: q.placeholder || "", required: q.required,
              maxLength: q.maxLength, minLength: q.minLength,
              isCoverLetter: q.isCoverLetter,
            })),
            jobTitle: jobContext.title || "", companyName: jobContext.company || "",
            jobDescription: jobContext.description || "",
          }),
        });
        if (resp.ok) {
          const { answers = [] } = await resp.json();
          for (const ans of answers) {
            if (ans.answer?.trim()) {
              await sendToAutopilotTab(tabId, { type: "CL_FILL_QUESTION", questionId: ans.id, text: ans.answer });
            }
          }
        }
      } catch { /* best-effort — advance anyway */ }
    }

    // 4. Click Next / Submit
    await setAutopilotState({ currentStep: "advancing" });
    await new Promise((r) => setTimeout(r, 800)); // brief pause before clicking
    await sendToAutopilotTab(tabId, { type: "CL_ADVANCE_PAGE" });

    await setAutopilotState({ currentStep: "waiting_nav" });
  }
}

async function advanceAutopilotToNextJob(tabId, state, appliedCount) {
  const nextIndex = (state.currentIndex || 0) + 1;
  const jobQueue = state.jobQueue || [];

  if (nextIndex >= jobQueue.length || appliedCount >= (state.maxApplications || 10)) {
    // All done
    await clearAutopilotState();
    setActionBadge("", null);
    chrome.notifications.create({
      type: "basic", iconUrl: "icons/icon48.png",
      title: "Fillthru Autopilot Complete",
      message: `Applied to ${appliedCount} job${appliedCount !== 1 ? "s" : ""}. Check your dashboard.`,
    });
    return;
  }

  const nextJob = jobQueue[nextIndex];
  await setAutopilotState({ currentIndex: nextIndex, currentStep: "opening", appliedCount });

  // Navigate the same tab to the next job
  await chrome.tabs.update(tabId, { url: nextJob.applyUrl });
}

// ── Drive autopilot when a tab finishes loading ───────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;

  const state = await getAutopilotState();
  if (!state?.active || state.paused) return;
  if (tabId !== state.autopilotTabId) return;

  // Brief delay to let the page settle (React hydration, etc.)
  setTimeout(() => runAutopilotStep(tabId), AUTOPILOT_STEP_DELAY_MS);
});

// ── Autopilot message handlers ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CL_AUTOPILOT_START") {
    const { jobQueue, maxApplications, token, baseUrl, profile, supplemental } = message;
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      if (!tab?.id || !jobQueue?.length) {
        sendResponse({ ok: false, error: "No jobs or no active tab" });
        return;
      }
      const firstJob = jobQueue[0];
      await setAutopilotState({
        active: true, paused: false,
        jobQueue, maxApplications: maxApplications || 10,
        currentIndex: 0, appliedCount: 0,
        currentStep: "opening",
        pauseReason: null, pendingSupplemental: [],
        token, baseUrl, profile, supplemental,
        autopilotTabId: tab.id,
      });
      await chrome.tabs.update(tab.id, { url: firstJob.applyUrl });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "CL_AUTOPILOT_PAUSE") {
    setAutopilotState({ paused: true, currentStep: "paused" }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "CL_AUTOPILOT_RESUME") {
    setAutopilotState({ paused: false, pauseReason: null, currentStep: "filling",
      profile: message.profile || undefined,
      supplemental: message.supplemental || undefined,
    }).then(async (state) => {
      const { autopilotTabId } = state;
      if (autopilotTabId) setTimeout(() => runAutopilotStep(autopilotTabId), 500);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "CL_AUTOPILOT_STOP") {
    clearAutopilotState().then(() => {
      setActionBadge("", null);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "CL_AUTOPILOT_STATUS") {
    getAutopilotState().then((state) => sendResponse({ state }));
    return true;
  }
});

// ── On install ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  setActionBadge("", null);
});

// ── Action (Icon Click) ───────────────────────────────────────────────────

async function summonAssistant(tab) {
  // If the browser UI can't be injected (e.g. chrome:// or edge:// pages), skip
  if (!tab?.id || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) return;

  try {
    // Send message to content script to toggle the assistant panel
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
}

chrome.action.onClicked.addListener(summonAssistant);

// Chrome binds suggested_key only on first install and silently skips
// conflicts. If ⌥C didn't get bound, send the user to the one place it can be set.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install" && reason !== "update") return;
  try {
    const commands = await chrome.commands.getAll();
    const toggle = commands.find((c) => c.name === "toggle-assistant");
    if (toggle && !toggle.shortcut) {
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    }
  } catch (err) {
    console.warn("Could not verify shortcuts:", err);
  }
});

// ⌥C opens / ⌥X closes — see "commands" in manifest.json
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (command === "toggle-assistant") return summonAssistant(tab);
  if (command === "close-assistant" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "CL_CLOSE_ASSISTANT" }).catch(() => {});
  }
});

// ── Init ─────────────────────────────────────────────────────────────────

updateBadgeCount();
