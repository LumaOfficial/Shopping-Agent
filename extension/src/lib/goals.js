// The habit side of the panel: a monthly cashback goal and what happened on each
// day. Everything is computed from what is already stored on this device — no
// figure here is invented, and a day with nothing on it counts as nothing.
export const GOAL_KEY = "savingsGoal";

const MAX_DAYS = 400;
const MAX_SEEN = 400;

function asDate(now) {
  if (now instanceof Date) return now;
  return new Date(typeof now === "number" ? now : Date.now());
}

function pad(value) {
  return String(value).padStart(2, "0");
}

// Local calendar day, so "today" changes at the shopper's midnight rather than
// at UTC's.
export function dayKey(now) {
  const at = asDate(now);
  return at.getFullYear() + "-" + pad(at.getMonth() + 1) + "-" + pad(at.getDate());
}

export function monthKey(now) {
  const at = asDate(now);
  return at.getFullYear() + "-" + pad(at.getMonth() + 1);
}

function shiftDays(date, by) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + by);
}

export function emptyActivity() {
  return { goal: 0, days: {}, seen: [] };
}

function whole(value) {
  const number = Number(value);
  return isFinite(number) && number > 0 ? Math.round(number) : 0;
}

export function sanitizeActivity(raw) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const days = {};
  const source = input.days && typeof input.days === "object" ? input.days : {};
  Object.keys(source)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort()
    .slice(-MAX_DAYS)
    .forEach((key) => {
      const day = source[key] || {};
      days[key] = { saved: whole(day.saved), tries: whole(day.tries), applied: whole(day.applied) };
    });
  const seen = (Array.isArray(input.seen) ? input.seen : [])
    .filter((id) => typeof id === "string" && id)
    .slice(-MAX_SEEN);
  return { goal: whole(input.goal), days, seen };
}

export function setGoal(activity, cents) {
  const clean = sanitizeActivity(activity);
  const value = Number(cents);
  clean.goal = isFinite(value) && value > 0 ? Math.min(Math.round(value), 100000000) : 0;
  return clean;
}

function bump(activity, key, at) {
  const clean = sanitizeActivity(activity);
  const day = dayKey(at);
  const record = clean.days[day] || { saved: 0, tries: 0, applied: 0 };
  record[key] += 1;
  clean.days[day] = record;
  return clean;
}

// A code was put into the store's promo field. A code the page accepted counts
// as applied as well as tried.
export function recordAttempt(activity, applied, now) {
  const tried = bump(activity, "tries", now);
  if (!applied) return tried;
  return bump(tried, "applied", now);
}

export function recordEarning(activity, amount, at) {
  const cents = whole(amount);
  if (!cents) return sanitizeActivity(activity);
  const clean = sanitizeActivity(activity);
  const day = dayKey(at);
  const record = clean.days[day] || { saved: 0, tries: 0, applied: 0 };
  record.saved += cents;
  clean.days[day] = record;
  return clean;
}

// Folds confirmed cashback from the wallet into the day it was earned. Entry ids
// are remembered, so a panel that reloads the same wallet does not count the
// same earning twice.
export function syncEarnings(activity, entries, now) {
  let clean = sanitizeActivity(activity);
  const known = new Set(clean.seen);
  let added = 0;
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (!entry || typeof entry.id !== "string" || known.has(entry.id)) return;
    const amount = whole(entry.amount);
    const at = Number(entry.at);
    if (!amount || !isFinite(at)) return;
    // An earning older than the record window needs no slot of its own.
    if (asDate(now).getTime() - at > MAX_DAYS * 24 * 60 * 60 * 1000) {
      known.add(entry.id);
      return;
    }
    clean = recordEarning(clean, amount, at);
    known.add(entry.id);
    added += 1;
  });
  clean.seen = Array.from(known).slice(-MAX_SEEN);
  return Object.assign(clean, { added });
}

export function todayTotals(activity, now) {
  const clean = sanitizeActivity(activity);
  const record = clean.days[dayKey(now)] || { saved: 0, tries: 0, applied: 0 };
  return { saved: record.saved, tries: record.tries, applied: record.applied };
}

export function monthTotal(activity, now) {
  const clean = sanitizeActivity(activity);
  const month = monthKey(now);
  return Object.keys(clean.days)
    .filter((key) => key.slice(0, 7) === month)
    .reduce((total, key) => total + clean.days[key].saved, 0);
}

function isActive(day) {
  return Boolean(day && (day.saved || day.tries || day.applied));
}

// Consecutive days with something on them, ending today — or yesterday, so a
// streak still reads correctly first thing in the morning.
export function streak(activity, now) {
  const clean = sanitizeActivity(activity);
  let cursor = asDate(now);
  if (!isActive(clean.days[dayKey(cursor)])) {
    cursor = shiftDays(cursor, -1);
    if (!isActive(clean.days[dayKey(cursor)])) return 0;
  }
  let count = 0;
  while (count < MAX_DAYS && isActive(clean.days[dayKey(cursor)])) {
    count += 1;
    cursor = shiftDays(cursor, -1);
  }
  return count;
}

export function goalProgress(activity, now) {
  const clean = sanitizeActivity(activity);
  const saved = monthTotal(clean, now);
  const goal = clean.goal;
  return {
    set: goal > 0,
    goal,
    saved,
    ratio: goal > 0 ? Math.min(1, saved / goal) : 0,
    left: goal > 0 ? Math.max(0, goal - saved) : 0,
  };
}

// The stored record, or a fresh one. A copy that cannot be read is replaced
// rather than thrown, so a damaged profile still opens the panel.
export async function readActivity() {
  const stored = await chrome.storage.local.get(GOAL_KEY);
  return sanitizeActivity(stored[GOAL_KEY]);
}

export async function saveActivity(activity) {
  const clean = sanitizeActivity(activity);
  await chrome.storage.local.set({ [GOAL_KEY]: clean });
  return clean;
}
