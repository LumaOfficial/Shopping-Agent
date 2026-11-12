// What a sealed code contains, and how it is put back.
//
// The profile a person builds here — account, wallet, saved and verified codes,
// price points, settings, the tour — is only on this browser profile. This
// module turns all of it into one payload, seals it with the recovery key (see
// vault.js) and applies a payload again on a device that has nothing.
//
// Two things never travel, on purpose:
//
//   * the things that belong to one machine — the session, the failed-sign-in
//     clock and the recovery record itself (a code that carried its own key
//     would protect nothing);
//   * the provider credentials entered under Developer. They stay on the device
//     they were typed on, exactly as the settings page and the privacy policy
//     already promise, so restoring a profile asks for those again.
import { CREDENTIAL_KEYS, sanitizeSettings } from "./settings.js";
import { newRecoveryKey, open, seal } from "./vault.js";

export const VAULT_KEY = "vault";
export const APP_ID = "luma-pay-savings";

// Keys that describe this installation rather than the person: restoring them
// would either carry a dead session to a new device or put the recovery key
// inside the copy it protects. Cards belong here too — the vault is sealed with
// a PIN that only exists on the device it was set on, and a card the shopper
// chose to keep here does not travel in a profile backup.
const DEVICE_ONLY = ["session", "signInGuard", "vault", "cardVault", "cardVaultKey", "cardGuard"];

function stamp(now) {
  return new Date(typeof now === "number" ? now : Date.now()).toISOString();
}

// The settings a code carries: everything except the credentials.
export function shareableSettings(raw) {
  const clean = sanitizeSettings(raw);
  CREDENTIAL_KEYS.forEach((key) => {
    clean[key] = "";
  });
  return clean;
}

// Everything stored on this device that is worth putting back, in one object.
export async function collectProfile(now) {
  const all = (await chrome.storage.local.get(null)) || {};
  const data = {};
  Object.keys(all).forEach((key) => {
    if (DEVICE_ONLY.indexOf(key) !== -1) return;
    data[key] = all[key];
  });
  if (data.settings) data.settings = shareableSettings(data.settings);
  return { app: APP_ID, v: 1, sealedAt: stamp(now), data };
}

export async function sealProfile(recoveryKey, now, options) {
  const payload = await collectProfile(now);
  return {
    code: await seal(payload, recoveryKey, options),
    keys: Object.keys(payload.data).length,
    sealedAt: payload.sealedAt,
  };
}

// Checks the box is one of ours before anything is written anywhere.
export async function openProfile(code, recoveryKey, options) {
  const payload = await open(code, recoveryKey, options);
  if (!payload || payload.app !== APP_ID) {
    throw new Error("That code is not a backup of this extension.");
  }
  if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    throw new Error("That code does not hold a profile.");
  }
  return payload;
}

// Restoring onto a device that already has a credential must not erase it: the
// code never held one, so blank means "leave what is here alone", not "clear".
function mergeSettings(existing, incoming) {
  const before = sanitizeSettings(existing);
  const after = sanitizeSettings(incoming);
  CREDENTIAL_KEYS.forEach((key) => {
    if (!after[key]) after[key] = before[key];
  });
  return after;
}

// Writes a sealed profile back over this one. Everything is read through the
// same sanitizers the pages use, so a hand-made code cannot plant an unknown
// key or an address the extension would refuse to contact.
export async function applyProfile(payload, now) {
  const stored = await chrome.storage.local.get("settings");
  const patch = {};
  Object.keys(payload.data).forEach((key) => {
    if (DEVICE_ONLY.indexOf(key) !== -1) return;
    if (key === "settings") {
      patch.settings = mergeSettings(stored.settings, payload.data.settings);
      return;
    }
    patch[key] = payload.data[key];
  });
  if (!Object.keys(patch).length) return { keys: 0, accounts: 0, sealedAt: payload.sealedAt || null };
  await chrome.storage.local.set(patch);
  const accounts = patch.accounts && typeof patch.accounts === "object" ? Object.keys(patch.accounts).length : 0;
  return { keys: Object.keys(patch).length, accounts, sealedAt: payload.sealedAt || null, at: stamp(now) };
}

// ---- the recovery record ------------------------------------------------
// `vault` holds the recovery key next to the data it protects. That is not a
// weakness on this device — anyone who can read this store already reads the
// wallet and the account hash — and it is what lets the hourly pass seal a fresh
// copy without asking for the key every time. What survives a wipe is the sealed
// code, and that still needs the key, which is why the key is written down
// somewhere else.
export async function readVault() {
  const stored = await chrome.storage.local.get(VAULT_KEY);
  const record = stored[VAULT_KEY];
  if (!record || typeof record !== "object" || !record.recoveryKey) return null;
  return record;
}

export async function writeVault(record) {
  await chrome.storage.local.set({ [VAULT_KEY]: record });
  return record;
}

export async function createVault(now) {
  const recoveryKey = newRecoveryKey();
  return writeVault({
    v: 1,
    recoveryKey,
    createdAt: stamp(now),
    lastSealedAt: null,
    lastPushAt: null,
    lastError: "",
  });
}

// Posts the sealed code to the address the operator named. The endpoint holds
// ciphertext it cannot open, and nothing is sent at all unless an address is
// configured, so a profile that never set one keeps its data to itself.
export async function pushVault(record, settings, now) {
  const url = String((settings && settings.backupUrl) || "").trim();
  if (!record || !record.recoveryKey || !url) return { ok: false, skipped: true };
  const sealed = await sealProfile(record.recoveryKey, now);
  const headers = { "content-type": "application/json", accept: "application/json" };
  const token = String((settings && settings.backupToken) || "").trim();
  if (token) headers.authorization = "Bearer " + token;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({ code: sealed.code, sealedAt: sealed.sealedAt, keys: sealed.keys }),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const at = stamp(now);
    await writeVault(Object.assign({}, record, { lastSealedAt: at, lastPushAt: at, lastError: "" }));
    return { ok: true, at };
  } catch (error) {
    const message = String((error && error.message) || error);
    await writeVault(Object.assign({}, record, { lastSealedAt: sealed.sealedAt, lastError: message }));
    return { ok: false, error: message };
  }
}
