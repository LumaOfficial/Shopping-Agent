// Accounts keep each person's money apart. There is no server: an account is a
// profile on this browser, its password is stored only as a salted PBKDF2 hash,
// and every figure that can turn into money (wallet, savings, ad value) lives
// under that account's own key prefix. Nothing here is ever sent anywhere.
const ACCOUNTS_KEY = "accounts";
const SESSION_KEY = "session";
const ITERATIONS = 120000;
const GUEST_PREFIX = "guest:";

export const MIN_PASSWORD = 8;
export const MIN_AGE = 18;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const text = String(hex || "");
  const bytes = new Uint8Array(Math.floor(text.length / 2));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(text.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function derive(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations, hash: "SHA-256" },
    key,
    256
  );
  return toHex(new Uint8Array(bits));
}

function newId() {
  if (crypto.randomUUID) return "acct_" + crypto.randomUUID().replace(/-/g, "");
  return "acct_" + toHex(crypto.getRandomValues(new Uint8Array(12)));
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

// Whole years between the date of birth and today, so the age gate is the same
// figure a bank would check.
export function ageFrom(dob, now) {
  const text = String(dob || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const born = new Date(text + "T00:00:00");
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date(typeof now === "number" ? now : Date.now());
  if (born.getTime() > today.getTime()) return null;
  let age = today.getFullYear() - born.getFullYear();
  const month = today.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

// Everything signup collects, checked in the order a person fills it in so the
// first message they see is the first thing to fix.
export function validateSignup(input, now) {
  const fullName = String((input && input.fullName) || "").trim().replace(/\s+/g, " ");
  const email = normalizeEmail(input && input.email);
  const phone = String((input && input.phone) || "").trim();
  const dob = String((input && input.dob) || "").trim();
  const password = String((input && input.password) || "");

  if (fullName.split(" ").filter(Boolean).length < 2) {
    return { ok: false, error: "Enter your first and last name." };
  }
  if (!EMAIL.test(email)) return { ok: false, error: "Enter an email address you can reach." };
  const digits = phoneDigits(phone);
  if (digits.length < 7 || digits.length > 15) {
    return { ok: false, error: "Enter a phone number with 7 to 15 digits." };
  }
  const age = ageFrom(dob, now);
  if (age === null) return { ok: false, error: "Enter your date of birth." };
  if (age < MIN_AGE) {
    return { ok: false, error: "You need to be " + MIN_AGE + " or older to cash out, so this account can't be opened yet." };
  }
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: "Choose a password of at least " + MIN_PASSWORD + " characters." };
  }
  return { ok: true, error: "", account: { fullName, email, phone, dob, password } };
}

// A session is kept on this device by default, so opening the panel again does
// not ask for the password. Unticking "Keep me signed in" parks it in the
// browser-session store instead, which the browser empties when it quits.
function sessionArea(remember) {
  return remember ? chrome.storage.local : chrome.storage.session || chrome.storage.local;
}

async function readSession() {
  const areas = [chrome.storage.local];
  if (chrome.storage.session) areas.push(chrome.storage.session);
  for (const area of areas) {
    const stored = await area.get(SESSION_KEY);
    if (stored && stored[SESSION_KEY]) return stored[SESSION_KEY];
  }
  return null;
}

async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
  if (chrome.storage.session) await chrome.storage.session.remove(SESSION_KEY);
}

async function writeSession(accountId, remember) {
  const keep = remember !== false;
  await clearSession();
  await sessionArea(keep).set({ [SESSION_KEY]: { accountId, at: Date.now(), remember: keep } });
  return keep;
}

async function readAccounts() {
  const stored = await chrome.storage.local.get(ACCOUNTS_KEY);
  return stored[ACCOUNTS_KEY] || {};
}

async function writeAccounts(map) {
  await chrome.storage.local.set({ [ACCOUNTS_KEY]: map });
}

function publicProfile(account) {
  return {
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    phone: account.phone,
    dob: account.dob,
    createdAt: account.createdAt,
  };
}

// Money earned before this browser had any account is moved into the first one,
// so signing up never makes a balance disappear.
async function adoptGuestData(accountId) {
  const all = await chrome.storage.local.get(null);
  const moves = {};
  const drops = [];
  Object.keys(all || {}).forEach((key) => {
    if (key.indexOf(GUEST_PREFIX) !== 0) return;
    moves["acct:" + accountId + ":" + key.slice(GUEST_PREFIX.length)] = all[key];
    drops.push(key);
  });
  if (!drops.length) return;
  await chrome.storage.local.set(moves);
  await chrome.storage.local.remove(drops);
}

export async function signUp(input, now, options) {
  const checked = validateSignup(input, now);
  if (!checked.ok) return { ok: false, error: checked.error };

  const accounts = await readAccounts();
  const first = Object.keys(accounts).length === 0;
  const taken = Object.keys(accounts).some(
    (id) => accounts[id] && accounts[id].email === checked.account.email
  );
  if (taken) return { ok: false, error: "That email already has an account — sign in instead." };

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const account = {
    id: newId(),
    fullName: checked.account.fullName,
    email: checked.account.email,
    phone: checked.account.phone,
    dob: checked.account.dob,
    createdAt: typeof now === "number" ? now : Date.now(),
    password: { salt, iterations: ITERATIONS, hash: await derive(checked.account.password, salt, ITERATIONS) },
  };

  accounts[account.id] = account;
  await writeAccounts(accounts);
  if (first) await adoptGuestData(account.id);
  const remember = await writeSession(account.id, !(options && options.remember === false));
  return { ok: true, account: publicProfile(account), remember };
}

// `options.remember` defaults to true: signing in on a device you own should not
// have to be repeated every time the panel opens.
export async function signIn(email, password, options) {
  const wanted = normalizeEmail(email);
  const accounts = await readAccounts();
  const account = Object.keys(accounts)
    .map((id) => accounts[id])
    .find((entry) => entry && entry.email === wanted);
  // Same answer for an unknown email and a wrong password, so the panel never
  // says which emails exist.
  const refused = { ok: false, error: "That email and password don't match an account." };
  if (!account) return refused;

  const secret = account.password || {};
  const hash = await derive(password, secret.salt, secret.iterations || ITERATIONS);
  if (hash !== secret.hash) return refused;

  const remember = await writeSession(account.id, !(options && options.remember === false));
  return { ok: true, account: publicProfile(account), remember };
}

export async function signOut() {
  await clearSession();
  return { ok: true };
}

export async function hasAccounts() {
  return Object.keys(await readAccounts()).length > 0;
}

export async function currentAccountId() {
  const session = await readSession();
  if (!session || !session.accountId) return null;
  const accounts = await readAccounts();
  // A session for an account that no longer exists signs nobody in.
  return accounts[session.accountId] ? session.accountId : null;
}

export async function currentAccount() {
  const id = await currentAccountId();
  if (!id) return null;
  const accounts = await readAccounts();
  return publicProfile(accounts[id]);
}

// The prefix every money key for the signed-in account starts with. Signed out,
// figures go to a guest namespace nothing displays, so they can never be read
// as someone else's.
export async function scopePrefix() {
  const id = await currentAccountId();
  return id ? "acct:" + id + ":" : GUEST_PREFIX;
}

export async function scopedKey(base) {
  return (await scopePrefix()) + base;
}
