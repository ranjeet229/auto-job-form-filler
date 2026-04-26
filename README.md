# Auto Job Form Filler

A **Chrome extension** (Manifest V3) that stores your job-application details once, then **fills online application forms** for you. It matches fields using labels, names, and nearby text—so you spend less time copy-pasting the same name, email, and resume links on every company site.

---

## Where it helps

- **Frequent job applications** — You apply to many roles on different career portals (company sites, Greenhouse, Lever, and other ATS-style pages). Filling the same information repeatedly is slow and error-prone; this extension reduces that friction.
- **Long or multi-step forms** — When applications ask for contact info, education, work history, skills, notice period, salary expectations, and links (GitHub, LinkedIn, portfolio, etc.), you can populate much of that from a saved **profile** instead of typing it again.
- **Embedded or iframe-based forms** — Filling is triggered in the active tab **including iframes**, which helps on sites that host the form inside a frame.
- **Resume uploads** — If you attach a **resume in Settings**, the extension can try to select it on file inputs that look like resume/CV/attachment fields (where the browser allows programmatic assignment).

**Limitations (honest):** Not every site will be fillable. Some applications use custom widgets, heavy scripting, or block programmatic file input changes. A **domain blacklist** lets you disable the script on sites where you do not want it to run.

---

## How it helps

| What you do | What the extension does |
|------------|-------------------------|
| Save your details in **Options** (full page settings) | Keeps one or more **profiles** in **local browser storage** (`chrome.storage.local`—on your device, not sent to a custom server by this project). |
| Open a job application page | Injects a content script that can **map form fields to your profile** using **keyword/label matching** (e.g. “first name,” “e-mail,” “LinkedIn,” “zip”). |
| Click **Fill** in the popup, use the page **“Fill Job Form”** button, or enable **auto-fill on load** | Fills matching `<input>`, `<textarea>`, and `<select>` fields and dispatches input/change events so many frameworks see the values. |
| Use multiple **profiles** | Switch the active profile from the **toolbar popup** for different personas or job types. |
| Avoid certain sites | Add hostnames to the **domain blacklist** so the filler does not run there. |
| Back up or move your data | **Import/export** in Options (as implemented in `options.js`) to save or restore your settings. |

**Toolbar popup** — Choose profile, turn **auto-fill on load** and the **floating button** on or off, open **Options**, and run **Fill** for the current tab.

---

## Install (load unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this project folder (the one containing `manifest.json`).

---

## First-time setup

1. Click the extension icon → **Options** (or open the extension’s options from `chrome://extensions` → *Details* → *Extension options* if your browser exposes it that way).
2. Fill in the fields for your main profile, add a resume if you want upload help, and create additional profiles if needed.
3. On a job application page, use the popup’s **Fill** or the on-page **Fill Job Form** button, or enable **auto-fill on load** in the popup and reload the page (where appropriate).

---

## Project layout (brief)

- `manifest.json` — Extension manifest, permissions, content script, and options page.
- `background.js` — Service worker: default storage shape, install/startup, simple messaging.
- `content.js` — Field matching, fill logic, floating UI, auto-fill on load, blacklist check.
- `popup.html` / `popup.js` — Quick controls and “Fill this tab” (all frames).
- `options.html` / `options.js` — Full profile editor, import/export, blacklist.
- `content.css` — Styles for the floating control (Shadow DOM).
- `icons/` — Extension icons.

---

## Privacy

Data in this project is stored **locally in the browser** via the extension’s storage API. This README does not replace reading the code for your own security review, especially if you change or distribute the extension.

---

**Version:** 1.0.0 (see `manifest.json`).
