// Card details kept on this device, behind a PIN, and typed into a checkout only
// when the shopper picks one in the panel.
//
// What this module will not do:
//
//   * it never stores the security code. A CVV may not be kept after an
//     authorization (PCI DSS 3.2), and every checkout asks for it again anyway,
//     so Luma Pay fills what it can and says so;
//   * it never sends a card anywhere — adding, listing, removing and filling are
//     all local to this browser profile;
//   * it keeps nothing but ciphertext: the vault holds the card number sealed
//     with AES-256-GCM, and the plaintext exists only between the moment the
//     shopper taps "Fill card details" and the moment the field is written.
//
// How it is locked:
//
//   * a PIN of at least 6 digits is stretched with PBKDF2-HMAC-SHA-256 at
//     210,000 rounds over a fresh 16-byte salt — the same floor accounts.js uses
//     for a password, so a copied vault is not a weekend's work;
//   * each card is sealed under the derived key with its own 12-byte IV, and the
//     format string is authenticated with it, so a tampered record does not open;
//   * the derived key is held for ten minutes from the last use. It lives in the
//     worker's memory and, so a suspended service worker does not ask for the PIN
//     on every message, in chrome.storage.session — memory-only storage the
//     browser empties when it quits, never written to disk;
//   * five wrong PINs start the same doubling pause sign-in uses, because a
//     6-digit PIN is only 10,000 guesses wide.
import { constantTimeEquals, textValue } from "./guard.js";

const VAULT_KEY = "cardVault";
const SESSION_KEY = "cardVaultKey";
const GUARD_KEY = "cardGuard";
const ITERATIONS = 210000;
const MIN_ITERATIONS = 1000;
const MAX_ITERATIONS = 2000000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AAD = new TextEncoder().encode("luma-card-v1");
const CHECK_TEXT = "luma-card-vault";
const MAX_CARDS = 12;
const MAX_TRIES = 5;
const BASE_LOCK_MS = 30 * 1000;
const MAX_LOCK_MS = 15 * 60 * 1000;

export const MIN_PIN = 6;
export const MAX_PIN = 12;
// Ten minutes is about one checkout: long enough not to retype a PIN between
// picking a card and paying, short enough that a walked-away laptop locks itself.
export const UNLOCK_MS = 10 * 60 * 1000;

// In this worker's memory: the derived key and when it stops being good.
let openKey = null;
let openUntil = 0;

export const BRANDS = {
  visa: { name: "Visa", groups: [4, 4, 4, 4], lengths: [16, 19] },
  mastercard: { name: "Mastercard", groups: [4, 4, 4, 4], lengths: [16] },
  amex: { name: "American Express", groups: [4, 6, 5], lengths: [15] },
  discover: { name: "Discover", groups: [4, 4, 4, 4], lengths: [16, 19] },
  jcb: { name: "JCB", groups: [4, 4, 4, 4], lengths: [16, 19] },
  unionpay: { name: "UnionPay", groups: [4, 4, 4, 4], lengths: [16, 19] },
  card: { name: "Card", groups: [4, 4, 4, 4], lengths: [12, 19] },
};

function toB64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function fromB64(text) {
  const binary = atob(String(text || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

// Luhn: every card number the networks issue satisfies it, and a single mistyped
// digit breaks it. Checked before anything is stored, so a typo is caught here
// rather than at the checkout where it would fail the payment.
export function passesLuhn(number) {
  const text = digits(number);
  if (text.length < 12 || text.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = text.length - 1; index >= 0; index -= 1) {
    let value = Number(text[index]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

// The issuing network, from the range prefixes each one publishes. The brand is
// what lets the panel label a card and what decides where the spaces go.
export function cardBrand(number) {
  const text = digits(number);
  if (/^4/.test(text)) return "visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(text)) return "mastercard";
  if (/^3[47]/.test(text)) return "amex";
  if (/^(6011|65|64[4-9]|622(12[6-9]|1[3-9]\d|[2-8]\d\d|9[01]\d|92[0-5]))/.test(text)) return "discover";
  if (/^35/.test(text)) return "jcb";
  if (/^62/.test(text)) return "unionpay";
  return "card";
}

export function brandName(id) {
  return (BRANDS[id] || BRANDS.card).name;
}

// "4242 4242 4242 4242" — the groups the network prints on the card, so a field
// that re-formats as the shopper types is not surprised by the paste.
export function groupNumber(number) {
  const text = digits(number);
  const groups = (BRANDS[cardBrand(text)] || BRANDS.card).groups;
  const out = [];
  let at = 0;
  for (const size of groups) {
    if (at >= text.length) break;
    out.push(text.slice(at, at + size));
    at += size;
  }
  if (at < text.length) out.push(text.slice(at));
  return out.join(" ");
}

export function normalizePin(value) {
  return digits(value);
}

export function pinProblem(value) {
  const pin = normalizePin(value);
  if (pin.length < MIN_PIN) return "Choose a PIN of at least " + MIN_PIN + " digits.";
  if (pin.length > MAX_PIN) return "A PIN is at most " + MAX_PIN + " digits.";
  if (/^(\d)\1+$/.test(pin)) return "That PIN is one digit repeated — pick something less predictable.";
  return "";
}

function readExpiry(value) {
  const text = String(value || "").trim();
  const match = /^(\d{1,2})\s*[\/\-. ]\s*(\d{2}|\d{4})$/.exec(text);
  if (!match) return null;
  const month = Number(match[1]);
  const rawYear = Number(match[2]);
  const year = match[2].length === 4 ? rawYear : 2000 + rawYear;
  return { month, year };
}

// A card that is about to be stored, checked in the order the form asks for it.
// `now` is passed in so a test can stand at a fixed date.
export function validateCard(input, now) {
  const raw = input || {};
  const number = digits(raw.number);
  if (!number) return { ok: false, error: "Enter the card number." };
  if (number.length < 12 || number.length > 19) {
    return { ok: false, error: "A card number has 12 to 19 digits." };
  }
  if (!passesLuhn(number)) return { ok: false, error: "That card number is not the right length — check it." };

  const holder = textValue(raw.holder, 60);
  if (holder.length < 2) return { ok: false, error: "Enter the name printed on the card." };

  const expiry = typeof raw.expMonth === "number" && typeof raw.expYear === "number"
    ? { month: raw.expMonth, year: raw.expYear }
    : readExpiry(raw.expiry);
  if (!expiry || !isFinite(expiry.month) || expiry.month < 1 || expiry.month > 12) {
    return { ok: false, error: "Enter the expiry as MM/YY." };
  }
  if (!isFinite(expiry.year) || expiry.year < 2000 || expiry.year > 2099) {
    return { ok: false, error: "Enter the expiry as MM/YY." };
  }
  // A card is good through the last day of its month, so the month is compared
  // rather than the day.
  const today = new Date(typeof now === "number" ? now : Date.now());
  const thisMonth = today.getFullYear() * 12 + today.getMonth();
  const cardMonth = expiry.year * 12 + (expiry.month - 1);
  if (cardMonth < thisMonth) return { ok: false, error: "That card has expired." };
  if (cardMonth > thisMonth + 20 * 12) return { ok: false, error: "Check the expiry year." };

  const brand = cardBrand(number);
  const nickname = textValue(raw.nickname, 24);
  return {
    ok: true,
    error: "",
    card: { number, brand, holder, expMonth: expiry.month, expYear: expiry.year, nickname },
  };
}

function refused(reason, message, extra) {
  return Object.assign({ ok: false, reason, error: message }, extra || {});
}

async function deriveBytes(pin, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    256
  );
  return new Uint8Array(bits);
}

async function aesKey(bytes) {
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function sealWith(keyBytes, value) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 },
    await aesKey(keyBytes),
    plaintext
  );
  return { iv: toB64(iv), ct: toB64(new Uint8Array(sealed)) };
}

// Returns null for a box that does not open: a wrong key, an edited record and a
// truncated one all land here, because the GCM tag is checked before any byte of
// the plaintext is handed back.
async function openWith(keyBytes, box) {
  if (!box || !box.iv || !box.ct) return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(box.iv), additionalData: AAD, tagLength: 128 },
      await aesKey(keyBytes),
      fromB64(box.ct)
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch (_error) {
    return null;
  }
}

async function readVault() {
  const stored = await chrome.storage.local.get(VAULT_KEY);
  const vault = stored && stored[VAULT_KEY];
  if (!vault || vault.v !== 1 || !Array.isArray(vault.cards)) return null;
  const iterations = Number(vault.iter);
  if (!isFinite(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) return null;
  return vault;
}

async function writeVault(vault) {
  await chrome.storage.local.set({ [VAULT_KEY]: vault });
}

async function sessionArea() {
  const storage = typeof chrome !== "undefined" ? chrome.storage : null;
  return (storage && storage.session) || null;
}

async function rememberKey(keyBytes) {
  openKey = keyBytes;
  openUntil = Date.now() + UNLOCK_MS;
  const area = await sessionArea();
  if (!area) return;
  try {
    await area.set({ [SESSION_KEY]: { key: toB64(keyBytes), until: openUntil } });
  } catch (_error) {
    // Session storage can be unavailable in a private window; memory still holds
    // the key for this worker, so the panel works and simply asks again sooner.
  }
}

// The key this session may use, or null. Every read extends the deadline, so a
// checkout in progress never locks out from under the shopper.
async function currentKey() {
  if (openKey && Date.now() < openUntil) {
    openUntil = Date.now() + UNLOCK_MS;
    return openKey;
  }
  openKey = null;
  const area = await sessionArea();
  if (!area) return null;
  let stored;
  try {
    stored = (await area.get(SESSION_KEY))[SESSION_KEY];
  } catch (_error) {
    return null;
  }
  if (!stored || typeof stored.key !== "string" || !(Number(stored.until) > Date.now())) {
    try {
      await area.remove(SESSION_KEY);
    } catch (_error) {
      // nothing to clear
    }
    return null;
  }
  openKey = fromB64(stored.key);
  openUntil = Date.now() + UNLOCK_MS;
  return openKey;
}

export async function lock() {
  openKey = null;
  openUntil = 0;
  const area = await sessionArea();
  if (area) {
    try {
      await area.remove(SESSION_KEY);
    } catch (_error) {
      // already gone
    }
  }
  return { ok: true };
}

async function readGuard() {
  const stored = await chrome.storage.local.get(GUARD_KEY);
  const guard = stored && stored[GUARD_KEY];
  return guard && typeof guard === "object" ? guard : {};
}

async function noteWrongPin() {
  const guard = await readGuard();
  const tries = Math.min(Number(guard.tries) + 1 || 1, 50);
  const until = tries >= MAX_TRIES ? Date.now() + Math.min(MAX_LOCK_MS, BASE_LOCK_MS * Math.pow(2, tries - MAX_TRIES)) : 0;
  await chrome.storage.local.set({ [GUARD_KEY]: { tries, until } });
  return { tries, until };
}

async function clearGuard() {
  await chrome.storage.local.remove(GUARD_KEY);
}

export async function vaultStatus() {
  const vault = await readVault();
  const key = await currentKey();
  return {
    ok: true,
    configured: Boolean(vault),
    unlocked: Boolean(vault && key),
    count: vault ? vault.cards.length : 0,
    expiresIn: key ? Math.max(0, openUntil - Date.now()) : 0,
  };
}

// A newly created vault is unlocked straight away: the shopper just chose the
// PIN, so asking for it again to save the first card would only be theatre.
export async function createVault(pin) {
  const existing = await readVault();
  if (existing) return refused("exists", "Cards on this device already have a PIN.", { configured: true });
  const problem = pinProblem(pin);
  if (problem) return refused("bad-pin", problem);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyBytes = await deriveBytes(normalizePin(pin), salt, ITERATIONS);
  const vault = {
    v: 1,
    kdf: "PBKDF2-SHA-256",
    iter: ITERATIONS,
    cipher: "AES-256-GCM",
    salt: toB64(salt),
    check: await sealWith(keyBytes, CHECK_TEXT),
    cards: [],
    createdAt: Date.now(),
  };
  await writeVault(vault);
  await clearGuard();
  await rememberKey(keyBytes);
  return { ok: true, configured: true, unlocked: true, count: 0 };
}

export async function unlock(pin) {
  const vault = await readVault();
  if (!vault) return refused("empty", "No cards are saved on this device yet.", { configured: false });

  const guard = await readGuard();
  const wait = Number(guard.until) - Date.now();
  if (wait > 0) {
    return refused("wait", "Too many wrong PINs. Try again in " + Math.ceil(wait / 1000) + " seconds.");
  }

  const problem = pinProblem(pin);
  if (problem) return refused("bad-pin", problem);

  const keyBytes = await deriveBytes(normalizePin(pin), fromB64(vault.salt), Number(vault.iter));
  const opened = await openWith(keyBytes, vault.check);
  // The check opens to a constant, so a record that opens to anything else was
  // not sealed by this code's PIN path.
  if (typeof opened !== "string" || !constantTimeEquals(opened, CHECK_TEXT)) {
    const recorded = await noteWrongPin();
    const left = Math.max(0, recorded.until - Date.now());
    return refused(
      "wrong-pin",
      left > 0
        ? "Too many wrong PINs. Try again in " + Math.ceil(left / 1000) + " seconds."
        : "That PIN does not open the cards."
    );
  }

  await clearGuard();
  await rememberKey(keyBytes);
  return { ok: true, configured: true, unlocked: true, count: vault.cards.length };
}

function publicCard(entry) {
  return {
    id: entry.id,
    brand: entry.brand,
    brandName: brandName(entry.brand),
    last4: entry.last4,
    holder: entry.holder,
    expMonth: entry.expMonth,
    expYear: entry.expYear,
    nickname: entry.nickname || "",
    addedAt: entry.addedAt,
  };
}

export async function listCards() {
  const vault = await readVault();
  if (!vault) return { ok: true, cards: [], unlocked: false };
  if (!(await currentKey())) return refused("locked", "Unlock the cards with your PIN first.", { cards: [] });
  return { ok: true, unlocked: true, cards: vault.cards.map(publicCard) };
}

export async function addCard(input, now) {
  const vault = await readVault();
  if (!vault) return refused("empty", "Set a PIN for cards on this device first.", { configured: false });
  const keyBytes = await currentKey();
  if (!keyBytes) return refused("locked", "Unlock the cards with your PIN first.");

  const checked = validateCard(input, now);
  if (!checked.ok) return refused("invalid", checked.error);

  const card = checked.card;
  const dupe = vault.cards.find(
    (entry) =>
      entry.last4 === card.number.slice(-4) &&
      entry.expMonth === card.expMonth &&
      entry.expYear === card.expYear &&
      entry.brand === card.brand
  );
  if (dupe) return refused("duplicate", "That card is already saved on this device.");
  if (vault.cards.length >= MAX_CARDS) {
    return refused("full", "This device holds " + MAX_CARDS + " cards — remove one first.");
  }

  const entry = {
    id: "card_" + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : toB64(crypto.getRandomValues(new Uint8Array(12)))),
    brand: card.brand,
    last4: card.number.slice(-4),
    holder: card.holder,
    expMonth: card.expMonth,
    expYear: card.expYear,
    nickname: card.nickname,
    addedAt: typeof now === "number" ? now : Date.now(),
    // The number lives only inside the sealed box below.
    box: await sealWith(keyBytes, { number: card.number }),
  };
  vault.cards = vault.cards.concat([entry]);
  await writeVault(vault);
  return { ok: true, card: publicCard(entry), count: vault.cards.length };
}

export async function removeCard(id) {
  const vault = await readVault();
  if (!vault) return refused("empty", "No cards are saved on this device.");
  if (!(await currentKey())) return refused("locked", "Unlock the cards with your PIN first.");
  const wanted = textValue(id, 80);
  const kept = vault.cards.filter((entry) => entry.id !== wanted);
  if (kept.length === vault.cards.length) return refused("missing", "That card is not on this device.");
  vault.cards = kept;
  await writeVault(vault);
  return { ok: true, count: kept.length };
}

// What a checkout needs and nothing else: no security code exists to return, and
// the number is the only plaintext this worker ever hands out.
export async function revealCard(id) {
  const vault = await readVault();
  if (!vault) return refused("empty", "No cards are saved on this device.");
  const keyBytes = await currentKey();
  if (!keyBytes) return refused("locked", "Unlock the cards with your PIN first.");
  const entry = vault.cards.find((candidate) => candidate.id === textValue(id, 80));
  if (!entry) return refused("missing", "That card is not saved on this device.");
  const opened = await openWith(keyBytes, entry.box);
  if (!opened || typeof opened.number !== "string") {
    return refused("damaged", "That card could not be opened — save it again.");
  }
  return {
    ok: true,
    card: {
      brand: entry.brand,
      number: opened.number,
      expMonth: entry.expMonth,
      expYear: entry.expYear,
      holder: entry.holder,
    },
  };
}

// Forgetting is always possible without the PIN: the data is gone either way,
// and a shopper locked out of their own vault must not be stuck with it.
export async function forgetAll() {
  await chrome.storage.local.remove(VAULT_KEY);
  await clearGuard();
  await lock();
  return { ok: true, configured: false, count: 0 };
}
