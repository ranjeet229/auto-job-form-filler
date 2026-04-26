/**
 * Popup: switch profile, toggles, trigger fill, open options.
 * Fill uses scripting.executeScript(allFrames) so iframes (e.g. Greenhouse) are covered.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const msg = (t, type) => {
    const m = $("msg");
    m.textContent = t || "";
    m.className = "msg" + (type ? " " + type : "");
  };

  function fillProfileSelect(data) {
    const s = $("selProfile");
    s.innerHTML = "";
    (data.profiles || []).forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name || p.id;
      s.appendChild(o);
    });
    s.value = data.activeProfileId || (data.profiles[0] && data.profiles[0].id) || "";
    const active = (data.profiles || []).find((p) => p.id === s.value);
    $("profileNameHint").textContent = active && active.name ? "Name: " + active.name : "";
  }

  async function load() {
    const d = await chrome.storage.local.get(null);
    fillProfileSelect(d);
    $("autoFill").checked = !!d.autoFillOnLoad;
    $("floatBtn").checked = d.showFloatingButton !== false;
  }

  async function savePartial(patch) {
    await chrome.storage.local.set(patch);
  }

  $("selProfile").addEventListener("change", async (e) => {
    const id = e.target.value;
    await savePartial({ activeProfileId: id });
    const data = await chrome.storage.local.get(null);
    const active = (data.profiles || []).find((p) => p.id === id);
    $("profileNameHint").textContent = active && active.name ? "Name: " + active.name : "";
    msg("Active profile updated.", "ok");
  });

  $("autoFill").addEventListener("change", (e) => {
    savePartial({ autoFillOnLoad: e.target.checked }).then(() => msg("Saved.", "ok"));
  });
  $("floatBtn").addEventListener("change", (e) => {
    savePartial({ showFloatingButton: e.target.checked }).then(() => {
      msg("Saved. Reload page to update floating button.", "ok");
    });
  });

  $("btnOptions").addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  $("btnFill").addEventListener("click", async () => {
    msg("Filling…");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null) {
        msg("No active tab.", "err");
        return;
      }
      if (!tab.url || !/^https?:/i.test(tab.url)) {
        msg("This page cannot be filled (use http/https pages).", "err");
        return;
      }
      const inj = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: async () => {
          try {
            if (typeof window.__ajfRunFill === "function") {
              return await window.__ajfRunFill();
            }
            return { ok: false, filled: 0, reason: "ext_not_ready" };
          } catch (err) {
            return { ok: false, filled: 0, reason: (err && err.message) || "error" };
          }
        },
      });
      const parts = (inj && inj.map((r) => r && r.result)) || [];
      let total = 0;
      let blocked = false;
      for (const r of parts) {
        if (!r) continue;
        if (r.blocked) blocked = true;
        if (typeof r.filled === "number") total += r.filled;
      }
      if (blocked && total === 0) {
        msg("This site is in your domain blacklist. Change it in Settings.", "err");
        return;
      }
      const nok = parts.some((r) => r && r.reason === "ext_not_ready");
      if (nok && total === 0) {
        msg("Reload the page, then try again (extension not ready in this frame).", "err");
        return;
      }
      if (total === 0) {
        msg("No fields matched. Check your profile in Settings, or the form may be in a special widget.", "ok");
      } else {
        msg("Filled " + total + " field(s) in this tab.", "ok");
      }
    } catch (e) {
      msg((e && e.message) || "Error", "err");
    }
  });

  document.addEventListener("DOMContentLoaded", load);
})();
