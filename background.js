/**
 * Service worker: default storage, install/update, optional message bridge.
 * Heavy logic lives in the content script and options page.
 */
(function () {
  "use strict";

  const DEFAULT_PROFILE = {
    id: "default",
    name: "Default",
    fullName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    currentLocation: "",
    address: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    collegeName: "",
    degree: "",
    branch: "",
    graduationYear: "",
    cgpa: "",
    skills: "",
    experience: "",
    internshipExperience: "",
    whatYouBuilt: "",
    currentCompany: "",
    resumeName: "",
    resumeData: "",
    github: "",
    linkedin: "",
    portfolio: "",
    leetcode: "",
    hackerrank: "",
    noticePeriod: "",
    expectedSalary: "",
    workAuthorization: "",
  };

  const DEFAULTS = {
    profiles: [DEFAULT_PROFILE],
    activeProfileId: "default",
    autoFillOnLoad: false,
    showFloatingButton: true,
    domainBlacklist: [] /** string: hostname or substring, lowercased */,
  };

  async function ensureStorage() {
    const data = await chrome.storage.local.get(null);
    if (data && data.profiles && data.profiles.length) return;
    await chrome.storage.local.set(DEFAULTS);
  }

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
      ensureStorage();
    }
  });

  /** Ensure first load after install in case onInstalled is delayed. */
  chrome.runtime.onStartup.addListener(() => {
    ensureStorage();
  });

  /** Allow popup to request a fresh read without duplicating much logic. */
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === "AJF_GET_STATE") {
      chrome.storage.local.get(null).then(sendResponse);
      return true;
    }
    if (message && message.type === "AJF_PING") {
      sendResponse({ ok: true });
      return true;
    }
  });
})();
