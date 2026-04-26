/**
 * Auto Job Form Filler — content script: smart field matching, fill, resume upload,
 * floating button, auto-fill on load. Does not run on blacklisted hostnames.
 */
(function () {
  "use strict";

  const AJF = "data-ajf-touched";

  /**
   * Keyword groups: each fieldKey maps to { weight, terms } for fuzzy label matching.
   * terms are lowercased substrings or regex string sources.
   */
  const FIELD_KEYWORDS = [
    { key: "firstName", get: (p) => p.firstName, terms: ["first name", "given name", "fname", "forename", "名"] },
    { key: "lastName", get: (p) => p.lastName, terms: ["last name", "surname", "family name", "lname", "姓"] },
    {
      key: "fullName",
      get: (p) => p.fullName,
      terms: ["full name", "your name", "applicant name", "name", "legal name", "print name"],
    },
    { key: "email", get: (p) => p.email, terms: ["e-mail", "email", "email id", "e mail id", "mail id", "电邮"] },
    {
      key: "phone",
      get: (p) => p.phone,
      terms: ["phone", "phone number", "contact no", "contact number", "contact #", "mobile", "cell", "cellphone", "whatsapp", "whats app", "tel", "telephone", "msisdn", "电话"],
    },
    { key: "city", get: (p) => p.city, terms: ["city", "town", "municipality"] },
    { key: "state", get: (p) => p.state, terms: ["state", "province", "region", "州", "省"] },
    { key: "country", get: (p) => p.country, terms: ["country", "nation"] },
    { key: "pincode", get: (p) => p.pincode, terms: ["zip", "postal", "post code", "pin", "postcode", "郵遞"] },
    { key: "address", get: (p) => p.address, terms: ["street", "address line", "line 1", "郵政"] },
    {
      key: "currentLocation",
      get: (p) => p.currentLocation,
      terms: [
        "current location",
        "location",
        "where are you based",
        "where do you live",
        "residing at",
        " based in",
        "based in",
        "based out of",
        "base location",
        "current city",
        "present address",
        "residence",
      ],
    },
    {
      key: "collegeName",
      get: (p) => p.collegeName,
      terms: [
        "campus",
        "alma mater",
        "university",
        "college",
        "university name",
        "college name",
        "institute",
        "institut",
        "school",
        "ug college",
        "education",
      ],
    },
    { key: "degree", get: (p) => p.degree, terms: ["degree", "qualification", "program", "b.tech", "btech", "b e", "bachelor", "masters", "m.tech"] },
    { key: "cgpa", get: (p) => p.cgpa, terms: ["cgpa", "c g p a", "cgp", "gpa", "grade point", "cpi", "sgpa", "cumulative gpa", "g p a", "academic score"] },
    { key: "branch", get: (p) => p.branch, terms: ["branch", "stream", "major", "field of study", "concentrat"] },
    { key: "graduationYear", get: (p) => p.graduationYear, terms: ["graduat", "year of completion", "class of", "batch"] },
    { key: "skills", get: (p) => p.skills, terms: ["skill", "technologies", "expertise", "stack", "tech stack", "competenc"] },
    {
      key: "internshipExperience",
      get: (p) => p.internshipExperience,
      terms: [
        "internship",
        "intern exp",
        "intern experience",
        "past internship",
        "current or past internship",
        "internship at",
        "summer intern",
        "stipend",
        "industrial training",
      ],
    },
    {
      key: "experience",
      get: (p) => p.experience,
      terms: [
        "experience",
        "yoe",
        "years of exp",
        "total exp",
        "total experience",
        "work experience",
        "years experience",
        "how many years",
        "professional experience",
        "relevant experience",
        "yrs of exp",
        "yrs experience",
      ],
    },
    { key: "whatYouBuilt", get: (p) => p.whatYouBuilt, terms: ["what you have built", "what you built", "what have you built", "what did you build", "things you built", "notable build", "projects you", "work sample", "describe a project", "proud of building"] },
    {
      key: "currentCompany",
      get: (p) => p.currentCompany,
      terms: [
        "current company",
        "present company",
        "current org",
        "current organisation",
        "current organization",
        "current employer",
        "employer",
        "company",
        "company name",
        "where do you work",
        "where are you working",
        "name of company",
        "org name",
        "comapny",
      ],
    },
    { key: "github", get: (p) => p.github, terms: ["github", "git"] },
    { key: "linkedin", get: (p) => p.linkedin, terms: ["linkedin", "linked in"] },
    { key: "portfolio", get: (p) => p.portfolio, terms: ["portfolio", "website", "personal site", "url"] },
    { key: "leetcode", get: (p) => p.leetcode, terms: ["leetcode", "leet code"] },
    { key: "hackerrank", get: (p) => p.hackerrank, terms: ["hackerrank", "hacker rank"] },
    { key: "noticePeriod", get: (p) => p.noticePeriod, terms: ["notice", "joining", "available"] },
    { key: "expectedSalary", get: (p) => p.expectedSalary, terms: ["salary", "compensation", "expectation", "ctc", "pay"] },
    { key: "workAuthorization", get: (p) => p.workAuthorization, terms: ["work auth", "visa", "authorized", "eligib", "sponsorship", "relocation"] },
  ];

  /** file upload — separate patterns */
  const FILE_RESUME_TERMS = ["resume", "résumé", "curriculum", "cv", "upload", "document", "attachment"];

  function norm(s) {
    if (s == null) return "";
    return String(s)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[-_.,:;()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isBlacklisted(hostname, list) {
    if (!list || !list.length) return false;
    const h = norm(hostname);
    return list.some((b) => {
      if (!b) return false;
      return h.includes(b) || h === b;
    });
  }

  function getContextBlob(el) {
    const tag = (el && el.tagName) || "";
    if (!tag) return "";
    const parts = [];
    const add = (s) => {
      const t = norm(s);
      if (t) parts.push(t);
    };
    if (el.id) add(el.id);
    if (el.getAttribute) {
      add(el.getAttribute("name"));
      add(el.getAttribute("placeholder"));
      add(el.getAttribute("autocomplete"));
      add(el.getAttribute("aria-label"));
      add(el.getAttribute("title"));
    }
    if (el.id) {
      const lb = document.querySelector('label[for="' + el.id.replace(/"/g, '\\"') + '"]');
      if (lb) add(lb.textContent);
    }
    let w = el;
    for (let d = 0; d < 4 && w; d++) {
      if (w.getAttribute) {
        const la = w.getAttribute("aria-labelledby");
        if (la) {
          la.split(/\s+/).forEach((id) => {
            const n = document.getElementById(id);
            if (n) add(n.textContent);
          });
        }
      }
      w = w.parentElement;
    }
    let n = el;
    for (let d = 0; d < 3 && n; d++) {
      n = n.previousElementSibling;
      if (n && n.tagName === "LABEL") add(n.textContent);
    }
    n = el;
    const sibTags = { LABEL: 1, SPAN: 1, DIV: 1, P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, LEGEND: 1, TD: 1, TH: 1, LI: 1 };
    for (let d = 0; d < 12 && n; d++) {
      n = n.previousElementSibling;
      if (!n || !n.tagName) continue;
      const tg = n.tagName;
      if (sibTags[tg] || n.getAttribute("role") === "heading" || n.className) {
        const t = n.textContent && n.textContent.trim();
        if (t) add(t.length > 400 ? t.slice(0, 400) : t);
      }
    }
    w = el;
    for (let d = 0; d < 4 && w; d++) {
      w = w.parentElement;
      if (w && w.getAttribute) {
        const g = w.getAttribute("data-params") || w.getAttribute("data-question");
        if (g) add(g);
      }
    }
    return parts.join(" | ");
  }

  function setNativeInputValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(input, value);
    else input.value = value;
  }

  function dispatchValueEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    try {
      if (typeof InputEvent === "function") {
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: el.value, inputType: "insertReplacementText" }));
      }
    } catch (_) {
      /* ignore */
    }
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
  }

  function fillTextLike(el, text) {
    if (el.disabled || el.readOnly) return false;
    if (el.tagName === "TEXTAREA") {
      setNativeInputValue(el, text);
      dispatchValueEvents(el);
      return true;
    }
    if (el.tagName !== "INPUT") return false;
    const t = (el.type || "text").toLowerCase();
    if (["button", "submit", "image", "reset", "file", "hidden"].indexOf(t) >= 0) return false;
    setNativeInputValue(el, text);
    dispatchValueEvents(el);
    return true;
  }

  function findBestSelectOption(el, value) {
    if (!value || el.tagName !== "SELECT" || el.disabled) return -1;
    const v = norm(String(value));
    for (let i = 0; i < el.options.length; i++) {
      const o = el.options[i];
      if (norm(o.value) === v) return i;
    }
    for (let i = 0; i < el.options.length; i++) {
      const o = el.options[i];
      if (norm(o.text) === v || o.text && norm(o.text).indexOf(v) !== -1) return i;
    }
    return -1;
  }

  function fillSelect(el, value) {
    if (el.tagName !== "SELECT" || el.disabled) return false;
    const idx = findBestSelectOption(el, value);
    if (idx < 0) {
      const pe = (window).__ajf_profile;
      for (const def of FIELD_KEYWORDS) {
        const m = def.get && pe && def.get(pe);
        if (m) {
          const j = findBestSelectOption(el, m);
          if (j >= 0) {
            el.selectedIndex = j;
            el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
            el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
            return true;
          }
        }
      }
      return false;
    }
    el.selectedIndex = idx;
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    return true;
  }

  function b64ToFile(b64, fileName) {
    const raw = atob(b64);
    const len = raw.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = raw.charCodeAt(i);
    return new File([u8], fileName || "resume.pdf", { type: "application/pdf" });
  }

  function fileScore(el) {
    const b = norm(getContextBlob(el));
    let s = 0;
    FILE_RESUME_TERMS.forEach((t) => {
      if (b.indexOf(norm(t)) !== -1) s += 10 + Math.min(4, t.length);
    });
    return s;
  }

  function bestMatchForText(blob, profile) {
    const b = norm(blob);
    let best = { key: null, score: 0, getValue: function () { return ""; } };
    for (const def of FIELD_KEYWORDS) {
      let s = 0;
      (def.terms || []).forEach((term) => {
        if (b.indexOf(norm(term)) !== -1) s += 10 + Math.min(5, String(term).length);
      });
      if (s > 0 && def.key === "fullName" && b.indexOf("first name") !== -1 && b.indexOf("last name") !== -1) {
        s = Math.max(0, s - 4);
      }
      if (s <= 0) continue;
      const g = def.get ? def.get(profile) : "";
      if (g == null || String(g).trim() === "") continue;
      if (s > best.score) {
        best = { key: def.key, score: s, getValue: function () { return def.get ? String(def.get(profile) || "") : ""; } };
      }
    }
    if (best.score < 5) return null;
    return best;
  }

  function collectTargets(root) {
    return root.querySelectorAll("input, textarea, select");
  }

  function runFillInternal() {
    const result = { ok: true, filled: 0, blocked: false };
    const p = (window).__ajf_last_ctx && (window).__ajf_last_ctx.profile;
    if (!p) {
      result.ok = false;
      return result;
    }
    if ((window).__ajf_last_ctx.blocked) {
      result.blocked = true;
      return result;
    }
    (window).__ajf_profile = p;
    const doc = document;
    const all = collectTargets(doc);
    const used = new WeakSet();

    const tryFill = (el, str) => {
      if (used.has(el) || str == null || str === "") return 0;
      if (el.tagName === "SELECT" && fillSelect(el, str)) {
        el.setAttribute(AJF, "1");
        used.add(el);
        return 1;
      }
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        if (fillTextLike(el, String(str))) {
          el.setAttribute(AJF, "1");
          used.add(el);
          return 1;
        }
      }
      return 0;
    };

    /** Pass 1: by label match */
    all.forEach((el) => {
      if (used.has(el) || (el.getAttribute && el.getAttribute(AJF))) return;
      const t = (el.type || "text").toLowerCase();
      if (t === "hidden" && el.tagName === "INPUT") return;
      if (t === "file" && el.tagName === "INPUT") return;
      const blob = getContextBlob(el);
      const def = bestMatchForText(blob, p);
      if (def) {
        const v = def.getValue();
        result.filled += tryFill(el, v);
      }
    });

    /** Pass 2: full name if a generic name field (not first/last) */
    if (p.fullName && p.fullName.trim()) {
      all.forEach((el) => {
        if (used.has(el) || (el.getAttribute && el.getAttribute(AJF))) return;
        if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
        const t = (el.type || "text").toLowerCase();
        if (t !== "text" && t !== "search" && t !== "email" && t !== "tel" && t !== "url" && t !== "number") return;
        const b = norm(getContextBlob(el));
        const looksGenericName =
          (b.indexOf("name") !== -1 && b.indexOf("first name") === -1 && b.indexOf("last name") === -1) ||
          /\bname\b/.test(b);
        if (!looksGenericName) return;
        if (/first|last|user ?name|username|company|file|form ?name|node name/i.test(b)) return;
        result.filled += tryFill(el, p.fullName);
      });
    }

    /** Pass 3: file inputs (resume) */
    if (p.resumeData && p.resumeName) {
      all.forEach((el) => {
        if (el.tagName !== "INPUT" || (el.type || "") !== "file" || el.disabled) return;
        if (fileScore(el) < 5) return;
        try {
          const file = b64ToFile(p.resumeData, p.resumeName);
          const dt = new DataTransfer();
          dt.items.add(file);
          el.files = dt.files;
          el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
          el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
          el.setAttribute(AJF, "1");
          used.add(el);
          result.filled += 1;
        } catch (_) {
          /* Some sites block programmatic file assignment. */
        }
      });
    }

    return result;
  }

  let _ctx = null;
  function prepareContext() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(null, (data) => {
          const list = (data && data.domainBlacklist) || [];
          const host = location.hostname || "";
          if (isBlacklisted(host, list)) {
            _ctx = { blocked: true, profile: null, showFloat: false, auto: false };
            (window).__ajf_last_ctx = _ctx;
            return resolve(_ctx);
          }
          const profiles = (data && data.profiles) || [];
          const id = (data && data.activeProfileId) || (profiles[0] && profiles[0].id);
          const profile = profiles.find((p) => p.id === id) || profiles[0] || null;
          _ctx = {
            blocked: false,
            profile: profile,
            showFloat: data && data.showFloatingButton !== false,
            auto: !!(data && data.autoFillOnLoad),
          };
          (window).__ajf_last_ctx = _ctx;
          resolve(_ctx);
        });
      } catch (e) {
        _ctx = { blocked: false, profile: null, showFloat: true, auto: false };
        resolve(_ctx);
      }
    });
  }

  function injectFloatUI() {
    if (document.getElementById("ajf-chrome-ext-host")) return;
    if (!_ctx || _ctx.blocked || !_ctx.showFloat) return;
    const host = document.createElement("div");
    host.id = "ajf-chrome-ext-host";
    host.setAttribute("style", "all:initial;position:static;pointer-events:none");
    (document.documentElement || document.body).appendChild(host);
    const sh = host.attachShadow({ mode: "open" });
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("content.css");
    sh.appendChild(link);
    const root = document.createElement("div");
    root.id = "ajf-root";
    const btn = document.createElement("button");
    btn.id = "ajf-fill-btn";
    btn.type = "button";
    btn.textContent = "Fill Job Form";
    const status = document.createElement("div");
    status.id = "ajf-status";
    status.setAttribute("role", "status");
    root.appendChild(btn);
    root.appendChild(status);
    sh.appendChild(root);
    const showStatus = (m, ok) => {
      status.textContent = m || "";
      if (!m) {
        status.className = "";
        return;
      }
      status.className = "ajf-visible" + (ok === false ? " ajf-err" : "");
      clearTimeout(showStatus.t);
      showStatus.t = setTimeout(() => {
        status.className = "";
        status.textContent = "";
      }, 4000);
    };
    btn.addEventListener("click", () => {
      btn.setAttribute("aria-pressed", "true");
      Promise.resolve((window).__ajfRunFill())
        .then((r) => {
          showStatus("Filled " + (r.filled || 0) + " field(s).", true);
        })
        .catch(() => {
          showStatus("Could not fill. Try again.", false);
        })
        .then(() => {
          btn.setAttribute("aria-pressed", "false");
        });
    });
  }

  let _autoTimeout = null;
  function scheduleAuto() {
    if (_autoTimeout) clearTimeout(_autoTimeout);
    if (!_ctx || _ctx.blocked || !_ctx.auto) return;
    const delay = document.readyState === "complete" ? 500 : 900;
    _autoTimeout = setTimeout(() => {
      Promise.resolve((window).__ajfRunFill()).then((r) => {
        if (r && r.filled > 0) {
          const s = document.getElementById("ajf-chrome-ext-host");
          if (s && s.shadowRoot) {
            const st = s.shadowRoot.getElementById("ajf-status");
            if (st) {
              st.textContent = "Auto-filled " + r.filled + " field(s).";
              st.className = "ajf-visible";
              setTimeout(() => (st.className = ""), 3000);
            }
          }
        }
      });
    }, delay);
  }

  (window).__ajfRunFill = async function ajfRunFill() {
    await prepareContext();
    (window).__ajf_last_ctx = _ctx;
    if (_ctx && _ctx.blocked) {
      return { ok: true, filled: 0, blocked: true };
    }
    if (!_ctx || !_ctx.profile) {
      return { ok: true, filled: 0, reason: "no_profile" };
    }
    return runFillInternal();
  };

  prepareContext().then((ctx) => {
    if (ctx.blocked) {
      return;
    }
    injectFloatUI();
    if (ctx.auto) scheduleAuto();
  });

  /** Re-read storage when the extension updates settings while page is open */
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!changes || (!changes.profiles && !changes.activeProfileId && !changes.autoFillOnLoad && !changes.showFloatingButton && !changes.domainBlacklist)) return;
      prepareContext().then(() => {
        const h = document.getElementById("ajf-chrome-ext-host");
        if (h) h.remove();
        injectFloatUI();
      });
    });
  }
})();
