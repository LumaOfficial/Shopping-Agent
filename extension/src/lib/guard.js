// The trust boundary. Anything that crosses between the page, the panel and the
// worker is checked here first: who sent it, whether the address is one that may
// be contacted, and whether the value has the shape the caller expects. Nothing
// here is a secret — the whole extension is readable — so the point is that
// reading the code gives an attacker no shortcut past these checks.

const MAX_URL = 2048;
const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?(?:\/|$)/i;
const BARE_HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?(?:\/\S*)?$/i;
const CONTROL = /[\u0000-\u001f\u007f]/g;

// True only for a message sent by this extension itself: its own pages and its
// own content scripts. Another extension, a web page or an injected script has a
// different id (or none), so it never gets this far.
export function ownSender(sender) {
  if (!sender || typeof sender.id !== "string" || !sender.id) return false;
  const runtime = typeof chrome !== "undefined" && chrome && chrome.runtime;
  return Boolean(runtime && runtime.id) && sender.id === runtime.id;
}

// A content script speaks for a web page, so its sender URL is that page's. An
// extension page — the panel, the settings tab — carries the extension's own URL
// instead (and may still sit in a tab, which is why the URL decides and the tab
// does not). Messages from a page are the narrowest set in the extension:
// the page can influence what its content script says, so it may only report the
// ad slots it hid.
export function fromContentScript(sender) {
  if (!ownSender(sender)) return false;
  const origin = String(sender.url || sender.origin || "");
  return /^https?:\/\//i.test(origin);
}

// Where this extension's own pages live, with a trailing slash. Chromium serves
// them from chrome-extension://, Firefox from moz-extension:// and Safari from
// safari-web-extension://, so the base is asked of the browser instead of being
// written out with one browser's scheme. "" when there is no runtime at all.
function extensionBase() {
  const runtime = typeof chrome !== "undefined" && chrome && chrome.runtime;
  if (!runtime || !runtime.id) return "";
  const base = typeof runtime.getURL === "function" ? String(runtime.getURL("")) : "";
  return base ? base.replace(/\/+$/, "") + "/" : "";
}

// Which of the extension's own pages is speaking, as a bare file name, or "" when
// the sender is not one of them. A page script, a content script and another
// extension all come back empty, so a command that only the settings page should
// answer can be held to it instead of being handed to every caller.
export function extensionPage(sender) {
  if (!ownSender(sender)) return "";
  const base = extensionBase();
  if (!base) return "";
  const url = String(sender.url || "");
  if (url.indexOf(base) !== 0) return "";
  return url
    .slice(base.length)
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");
}

export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Text that came from a page, a feed or a form: never longer than the field it
// is shown in, never carrying control characters.
export function textValue(value, max) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(CONTROL, "").trim().slice(0, max || 200);
}

// A whole number inside a range, or null when the value is not one. Used for
// every figure that can turn into money.
export function intValue(value, min, max) {
  const number = typeof value === "number" ? value : Number(value);
  if (!isFinite(number)) return null;
  const whole = Math.round(number);
  if (whole < min || whole > max) return null;
  return whole;
}

export function moneyValue(value) {
  const number = typeof value === "number" ? value : Number(value);
  if (!isFinite(number) || number < 0 || number > 1e9) return null;
  return number;
}

// An address this extension may contact. Only HTTPS, so no credential or frame
// ever travels in the clear, with plain HTTP allowed solely for a listener on
// this machine while a relay or proxy is being built. `{store}`, `{url}` and
// `{siteId}` placeholders are part of the extension's own template syntax and
// are filled in later, so they are not treated as characters to reject.
export function endpoint(value) {
  const raw = textValue(value, MAX_URL);
  if (!raw) return "";
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  const candidate = hasScheme ? raw : BARE_HOST.test(raw) ? "https://" + raw : "";
  if (!candidate) return "";

  let parsed;
  try {
    parsed = new URL(candidate.replace(/\{(store|url|siteId)\}/gi, "x"));
  } catch (_error) {
    return "";
  }
  if (parsed.username || parsed.password) return ""; // no credentials in an address
  // A bare host is stored with its scheme so the fetch that uses it is always
  // the encrypted one.
  if (parsed.protocol === "https:") return hasScheme ? raw : candidate;
  if (parsed.protocol === "http:" && LOOPBACK.test(candidate)) return raw;
  return "";
}

// A page address handed to the worker by the panel or a content script.
export function webUrl(value) {
  const raw = textValue(value, MAX_URL);
  if (!raw || !/^https?:\/\//i.test(raw)) return "";
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    return raw;
  } catch (_error) {
    return "";
  }
}

export function hostKey(value) {
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(String(value || ""))
    ? String(value).toLowerCase()
    : "";
}

export function constantTimeEquals(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

// A small in-memory ceiling per action, so a page cannot empty a wallet or
// inflate a figure by repeating one message thousands of times. It resets when
// the worker is torn down, which is enough: the cost is per session, not per
// page, and each entry is a bare timestamp.
const seen = new Map();

export function allowance(name, limit, windowMs) {
  const now = Date.now();
  const hits = (seen.get(name) || []).filter((at) => now - at < windowMs);
  if (hits.length >= limit) {
    seen.set(name, hits);
    return false;
  }
  hits.push(now);
  seen.set(name, hits);
  return true;
}
