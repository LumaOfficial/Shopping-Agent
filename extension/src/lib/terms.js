// The terms a shopper agrees to before the panel does anything for them.
//
// The record is stored on this device and is versioned: bumping TERMS_VERSION
// asks again, and only a record with that exact version and a real timestamp
// counts as agreement. A tampered or partial record (a bare `true`, an old
// version, a missing time) is no consent at all, so a page that pokes storage
// cannot hand itself the features the gate holds back.
export const TERMS_VERSION = "1.4";
export const TERMS_UPDATED = "2026-11-12";

const KEY = "terms";

function clean(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  if (record.version !== TERMS_VERSION) return null;
  if (typeof record.at !== "number" || !isFinite(record.at) || record.at <= 0) return null;
  return { version: TERMS_VERSION, at: record.at };
}

// The accepted record, or null when there is none for this version.
export async function readConsent() {
  const stored = await chrome.storage.local.get(KEY);
  return clean(stored[KEY]);
}

// Called only from a deliberate tap on the panel's agree button.
export async function acceptTerms(now) {
  const record = { version: TERMS_VERSION, at: typeof now === "number" ? now : Date.now() };
  await chrome.storage.local.set({ [KEY]: record });
  return record;
}

export async function withdrawConsent() {
  await chrome.storage.local.remove(KEY);
}

// The full document, served from the package itself: no external page, no
// network call, and no reading past the extension's own files.
export function termsUrl() {
  return chrome.runtime.getURL("terms.html");
}

export function consentLine(record) {
  if (!record) return "Not accepted yet — the panel stays limited until you agree.";
  const at = new Date(record.at);
  const day = isFinite(at.getTime()) ? at.toISOString().slice(0, 10) : "an earlier date";
  return "Accepted on this device on " + day + " (terms version " + TERMS_VERSION + ").";
}
