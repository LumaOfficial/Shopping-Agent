// One definition of the stored settings, shared by the service worker (which
// reads them) and the options page (which writes them).
//
// Everything written here is sanitized on the way in: only the keys below are
// stored, addresses must be HTTPS (or a loopback listener) and figures are whole
// numbers inside a range. A stored object that somehow carries extra keys — a
// tampered profile, an edited import — loses them on the next read.
import { endpoint, hostKey, intValue, isPlainObject, textValue } from "./guard.js";

export const DEFAULTS = {
  feedUrl: "",
  feedAuth: "bearer",
  feedUser: "",
  feedKey: "",
  cashbackTemplate: "",
  cashbackSiteId: "",
  payoutUrl: "",
  payoutKey: "",
  payoutPlatform: "",
  payoutPlatformKey: "",
  payoutAccount: "",
  payoutCustomer: "",
  payoutUtid: "",
  payoutMinimum: 500,
  sponsorUrl: "",
  sponsorKey: "",
  priceHistoryKey: "",
  // The relay that holds a face provider's credentials (server/age-verify.mjs).
  // The extension only ever stores its address and an optional bearer token.
  ageCheckUrl: "",
  ageCheckToken: "",
  // Where an operator publishes a newer savings catalog. Optional: with nothing
  // here the bundled list is used, and either way the worker re-checks it
  // hourly so expired rows disappear without anyone asking.
  catalogUrl: "",
  // Where a sealed copy of the profile is kept so a wiped device can be put
  // back. The address only ever receives the encrypted code (src/lib/backup.js),
  // and with nothing here the profile is sealed to a file the person keeps.
  backupUrl: "",
  backupToken: "",
  // Keep the savings list and any connected feed current on a schedule.
  autoRefresh: true,
  partnerMembers: "",
  enabledSites: [],
  enabled: {
    coupons: true,
    cashback: true,
    priceHistory: true,
    clipOffers: true,
    priceTracking: true,
    adBlock: true,
  },
};

// How much of each free-text value is kept. A credential is the longest because
// a provider token has to arrive intact.
const TEXT_LIMITS = {
  feedUser: 200,
  feedKey: 600,
  cashbackSiteId: 120,
  payoutKey: 600,
  payoutPlatform: 60,
  payoutPlatformKey: 600,
  payoutAccount: 120,
  payoutCustomer: 120,
  payoutUtid: 120,
  sponsorKey: 600,
  priceHistoryKey: 600,
  ageCheckToken: 600,
  backupToken: 600,
  partnerMembers: 200,
};

// Addresses this extension contacts. Each is validated in guard.js, so a plain
// HTTP address on the open internet is dropped rather than sent a credential.
const ENDPOINTS = [
  "feedUrl",
  "cashbackTemplate",
  "payoutUrl",
  "sponsorUrl",
  "ageCheckUrl",
  "catalogUrl",
  "backupUrl",
];

const MAX_SITES = 500;

function cleanSites(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  value.forEach((entry) => {
    const host = hostKey(textValue(entry, 253));
    if (host) seen.add(host);
  });
  return Array.from(seen).slice(0, MAX_SITES);
}

function cleanEnabled(value) {
  const input = isPlainObject(value) ? value : {};
  const enabled = {};
  Object.keys(DEFAULTS.enabled).forEach((key) => {
    enabled[key] = typeof input[key] === "boolean" ? input[key] : DEFAULTS.enabled[key];
  });
  return enabled;
}

export function sanitizeSettings(raw) {
  const input = isPlainObject(raw) ? raw : {};
  const settings = {};

  Object.keys(DEFAULTS).forEach((key) => {
    if (key === "enabled") {
      settings.enabled = cleanEnabled(input.enabled);
      return;
    }
    if (key === "enabledSites") {
      settings.enabledSites = cleanSites(input.enabledSites);
      return;
    }
    if (key === "payoutMinimum") {
      const minimum = intValue(input.payoutMinimum, 0, 10000000);
      settings.payoutMinimum = minimum === null ? DEFAULTS.payoutMinimum : minimum;
      return;
    }
    if (key === "autoRefresh") {
      settings.autoRefresh = typeof input.autoRefresh === "boolean" ? input.autoRefresh : DEFAULTS.autoRefresh;
      return;
    }
    if (ENDPOINTS.indexOf(key) !== -1) {
      settings[key] = endpoint(input[key]);
      return;
    }
    if (key === "feedAuth") {
      settings.feedAuth = input.feedAuth === "basic" ? "basic" : "bearer";
      return;
    }
    settings[key] = textValue(input[key], TEXT_LIMITS[key] || 200);
  });

  return settings;
}

// The values that are credentials rather than preferences: an API key, a payout
// token, a relay's bearer token. Only the settings page needs them, so every
// other reader of the same object gets them blanked — a panel that is talked
// into reading a second time still learns nothing it can replay.
export const CREDENTIAL_KEYS = [
  "feedUser",
  "feedKey",
  "payoutKey",
  "payoutPlatformKey",
  "sponsorKey",
  "priceHistoryKey",
  "ageCheckToken",
  "backupToken",
];

export function publicSettings(raw) {
  const clean = sanitizeSettings(raw);
  CREDENTIAL_KEYS.forEach((key) => {
    clean[key] = "";
  });
  return clean;
}

export function withDefaults(stored) {
  return sanitizeSettings(stored);
}

export async function readSettings() {
  const stored = await chrome.storage.local.get("settings");
  return withDefaults(stored.settings);
}

// Returns what was actually stored, so a caller can show the value that took
// effect rather than the one it typed.
export async function writeSettings(settings) {
  const clean = sanitizeSettings(settings);
  await chrome.storage.local.set({ settings: clean });
  return clean;
}
