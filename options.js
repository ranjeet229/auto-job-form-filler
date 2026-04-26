/**
 * Auto Job Form Filler — options page: profiles, storage, import/export, blacklist.
 */
(function () {
  "use strict";

  const FIELDS = [
    "fullName",
    "firstName",
    "lastName",
    "email",
    "phone",
    "currentLocation",
    "address",
    "city",
    "state",
    "country",
    "pincode",
    "collegeName",
    "degree",
    "branch",
    "graduationYear",
    "cgpa",
    "skills",
    "experience",
    "internshipExperience",
    "whatYouBuilt",
    "currentCompany",
    "github",
    "linkedin",
    "portfolio",
    "leetcode",
    "hackerrank",
    "noticePeriod",
    "expectedSalary",
    "workAuthorization",
  ];

  const EMPTY_PROFILE = (id, name) => ({
    id,
    name: name || "Profile",
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
  });

  const el = (id) => document.getElementById(id);

  let state = {
    profiles: [],
    activeProfileId: null,
    autoFillOnLoad: false,
    showFloatingButton: true,
    domainBlacklist: [],
  };

  let lastResumeRead = { name: "", data: "" };

  function getActive() {
    return state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
  }

  function uid() {
    return "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function setControlsFromProfile() {
    const p = getActive();
    if (!p) return;
    FIELDS.forEach((f) => {
      const n = el(f);
      if (n) n.value = p[f] == null ? "" : String(p[f]);
    });
    if (p.resumeName && p.resumeData) {
      el("resumeMeta").textContent = "Saved: " + p.resumeName + " (stored in browser)";
      lastResumeRead = { name: p.resumeName, data: p.resumeData };
    } else {
      el("resumeMeta").textContent = "No file saved for this profile.";
      lastResumeRead = { name: "", data: "" };
    }
    const fi = el("resumeFile");
    if (fi) fi.value = "";
  }

  function readFormIntoActive() {
    const p = getActive();
    if (!p) return;
    FIELDS.forEach((f) => {
      const n = el(f);
      if (n) p[f] = n.value;
    });
    if (lastResumeRead.data) {
      p.resumeName = lastResumeRead.name;
      p.resumeData = lastResumeRead.data;
    }
  }

  function refreshProfileSelect() {
    const s = el("activeProfile");
    s.innerHTML = "";
    state.profiles.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name || p.id;
      s.appendChild(o);
    });
    s.value = state.activeProfileId;
    el("profileIdHint").textContent = "Profile ID: " + state.activeProfileId;
  }

  async function load() {
    const data = await chrome.storage.local.get(null);
    if (!data.profiles || !data.profiles.length) {
      const def = EMPTY_PROFILE("default", "Default");
      state = {
        profiles: [def],
        activeProfileId: "default",
        autoFillOnLoad: false,
        showFloatingButton: true,
        domainBlacklist: [],
      };
    } else {
      state = {
        profiles: data.profiles,
        activeProfileId: data.activeProfileId || data.profiles[0].id,
        autoFillOnLoad: !!data.autoFillOnLoad,
        showFloatingButton: data.showFloatingButton !== false,
        domainBlacklist: Array.isArray(data.domainBlacklist) ? data.domainBlacklist : [],
      };
    }
    // migrate missing keys on each profile
    state.profiles = state.profiles.map((p) => ({ ...EMPTY_PROFILE(p.id, p.name), ...p }));
    if (!getActive() && state.profiles.length) state.activeProfileId = state.profiles[0].id;
    refreshProfileSelect();
    setControlsFromProfile();
    el("autoFillOnLoad").checked = state.autoFillOnLoad;
    el("showFloatingButton").checked = state.showFloatingButton;
    el("domainBlacklist").value = (state.domainBlacklist || []).join("\n");
  }

  function parseBlacklist() {
    return el("domainBlacklist")
      .value.split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
  }

  function showSaved() {
    const a = el("saveSuccessAlert");
    if (a) {
      a.textContent = "All changes saved";
      a.hidden = false;
      clearTimeout(showSaved.t);
      showSaved.t = setTimeout(() => {
        a.hidden = true;
      }, 4000);
    }
  }

  async function save() {
    el("saveError").textContent = "";
    readFormIntoActive();
    state.activeProfileId = el("activeProfile").value;
    state.autoFillOnLoad = el("autoFillOnLoad").checked;
    state.showFloatingButton = el("showFloatingButton").checked;
    state.domainBlacklist = parseBlacklist();
    const payload = {
      profiles: state.profiles,
      activeProfileId: state.activeProfileId,
      autoFillOnLoad: state.autoFillOnLoad,
      showFloatingButton: state.showFloatingButton,
      domainBlacklist: state.domainBlacklist,
    };
    try {
      await chrome.storage.local.set(payload);
    } catch (e) {
      el("saveError").textContent = (e && e.message) || "Failed to save. Is the resume file too large?";
      return;
    }
    showSaved();
  }

  function onProfileSwitch() {
    readFormIntoActive();
    state.activeProfileId = el("activeProfile").value;
    setControlsFromProfile();
  }

  function onAddProfile() {
    readFormIntoActive();
    const id = uid();
    const np = EMPTY_PROFILE(id, "New profile");
    state.profiles.push(np);
    state.activeProfileId = id;
    refreshProfileSelect();
    setControlsFromProfile();
  }

  function onRename() {
    const p = getActive();
    if (!p) return;
    const n = window.prompt("Profile name", p.name);
    if (n === null) return;
    p.name = n.trim() || p.name;
    refreshProfileSelect();
  }

  async function onResumePicked(e) {
    const file = e.target && e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      el("saveError").textContent = "File is over ~2.5 MB; Chrome storage may fail. Please use a smaller PDF.";
      e.target.value = "";
      return;
    }
    const b64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = r.result;
        if (typeof s === "string") {
          const m = s.indexOf("base64,");
          resolve(m === -1 ? s : s.slice(m + 7));
        } else resolve("");
      };
      r.onerror = () => reject(new Error("read error"));
      r.readAsDataURL(file);
    });
    lastResumeRead = { name: file.name, data: b64 };
    el("resumeMeta").textContent = "Staged: " + file.name + " — click Save to store.";
  }

  function onClearResume() {
    const p = getActive();
    if (p) {
      p.resumeName = "";
      p.resumeData = "";
    }
    lastResumeRead = { name: "", data: "" };
    if (el("resumeFile")) el("resumeFile").value = "";
    el("resumeMeta").textContent = "No file saved for this profile.";
  }

  function onExport() {
    chrome.storage.local.get(null).then((d) => {
      const b = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "auto-job-form-filler-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  function onImportFile(e) {
    const file = e.target && e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      el("importResult").textContent = "";
      let json;
      try {
        json = JSON.parse(r.result);
      } catch (err) {
        el("importResult").textContent = "Invalid JSON: " + err.message;
        return;
      }
      if (!Array.isArray(json) && !json.profiles) {
        el("importResult").textContent = "File does not look like an Auto Job Form Filler export.";
        return;
      }
      const toMerge = Array.isArray(json)
        ? { profiles: json, activeProfileId: (json[0] && json[0].id) || "imported" }
        : json;
      chrome.storage.local
        .get(null)
        .then((cur) => {
          const byId = {};
          (cur.profiles || []).forEach((p) => {
            byId[p.id] = p;
          });
          (toMerge.profiles || []).forEach((p) => {
            byId[p.id] = { ...EMPTY_PROFILE(p.id, p.name), ...p };
          });
          return {
            profiles: Object.values(byId),
            activeProfileId: toMerge.activeProfileId || cur.activeProfileId,
            autoFillOnLoad: toMerge.autoFillOnLoad != null ? toMerge.autoFillOnLoad : cur.autoFillOnLoad,
            showFloatingButton:
              toMerge.showFloatingButton != null ? toMerge.showFloatingButton : cur.showFloatingButton,
            domainBlacklist: toMerge.domainBlacklist != null ? toMerge.domainBlacklist : cur.domainBlacklist,
          };
        })
        .then((out) => chrome.storage.local.set(out))
        .then(() => {
          el("importResult").textContent = "Import complete. Refreshing form…";
          return load();
        })
        .then(() => {
          el("importResult").textContent = "Import complete.";
        })
        .catch((err) => {
          el("importResult").textContent = (err && err.message) || "Import failed";
        });
    };
    r.readAsText(file);
  }

  /** Tabs */
  function setupTabs() {
    const tabs = document.querySelectorAll(".tab");
    const panels = {
      profile: el("panel-profile"),
      control: el("panel-control"),
      data: el("panel-data"),
    };
    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        const id = t.getAttribute("data-tab");
        tabs.forEach((x) => {
          const on = x === t;
          x.classList.toggle("active", on);
          x.setAttribute("aria-selected", on ? "true" : "false");
        });
        Object.keys(panels).forEach((k) => {
          const p = panels[k];
          if (!p) return;
          const on = k === id;
          p.classList.toggle("active", on);
          p.toggleAttribute("hidden", !on);
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    setupTabs();
    el("btnSave").addEventListener("click", save);
    el("activeProfile").addEventListener("change", onProfileSwitch);
    el("btnAddProfile").addEventListener("click", onAddProfile);
    el("btnRenameProfile").addEventListener("click", onRename);
    el("resumeFile").addEventListener("change", onResumePicked);
    el("btnClearResume").addEventListener("click", onClearResume);
    el("btnExport").addEventListener("click", onExport);
    el("importFile").addEventListener("change", onImportFile);
  });
})();
