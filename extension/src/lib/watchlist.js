// A small watch list of products the shopper wants to think about. Each row
// remembers the price it was saved at and the price seen most recently, so the
// panel can say whether it has moved — and never guesses a price it did not see.
export const WATCH_KEY = "priceWatch";
export const MAX_WATCH = 40;

function text(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit);
}

// The same product on the same store is one row, however the title is worded.
export function watchId(item) {
  const store = text(item && item.storeId, 60).toLowerCase();
  const title = text(item && item.title, 120).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!store || !title) return null;
  return store + "|" + title;
}

function cents(value) {
  const number = Number(value);
  return isFinite(number) && number > 0 ? Math.round(number) : null;
}

export function cleanItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const price = cents(raw.price);
  if (!price) return null;
  const id = watchId(raw);
  if (!id) return null;
  return {
    id,
    storeId: text(raw.storeId, 60),
    storeName: text(raw.storeName, 60) || text(raw.storeId, 60),
    title: text(raw.title, 120),
    currency: /^[A-Z]{3}$/.test(String(raw.currency || "").toUpperCase())
      ? String(raw.currency).toUpperCase()
      : "USD",
    price,
    saved: cents(raw.saved) || price,
    url: /^https?:\/\//i.test(String(raw.url || "")) ? String(raw.url).slice(0, 400) : "",
    at: Number(raw.at) || 0,
  };
}

export function cleanWatch(raw) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const items = [];
  const seen = new Set();
  (Array.isArray(input.items) ? input.items : []).forEach((entry) => {
    const item = cleanItem(entry);
    if (!item || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  });
  return { items: items.slice(0, MAX_WATCH) };
}

// Saving the same product again refreshes the price shown but keeps the price it
// was first saved at, so the row can say whether it is cheaper than when the
// shopper decided to watch it.
export function addWatch(watch, raw) {
  const clean = cleanWatch(watch);
  const item = cleanItem(raw);
  if (!item) return { watch: clean, added: null, duplicate: false };
  const at = clean.items.findIndex((entry) => entry.id === item.id);
  if (at === -1) {
    clean.items = [item].concat(clean.items).slice(0, MAX_WATCH);
    return { watch: clean, added: item, duplicate: false };
  }
  const existing = clean.items[at];
  const updated = Object.assign({}, existing, {
    price: item.price,
    saved: existing.saved,
    at: item.at || existing.at,
    title: item.title || existing.title,
    url: item.url || existing.url,
  });
  clean.items = clean.items.slice();
  clean.items[at] = updated;
  return { watch: clean, added: updated, duplicate: true };
}

export function removeWatch(watch, id) {
  const clean = cleanWatch(watch);
  const at = clean.items.findIndex((entry) => entry.id === id);
  if (at === -1) return { watch: clean, removed: null, index: -1 };
  const removed = clean.items[at];
  clean.items = clean.items.slice(0, at).concat(clean.items.slice(at + 1));
  return { watch: clean, removed, index: at };
}

export function restoreWatch(watch, removed, index) {
  const clean = cleanWatch(watch);
  if (!removed) return clean;
  const at = Math.max(0, Math.min(typeof index === "number" ? index : 0, clean.items.length));
  clean.items = clean.items.slice(0, at).concat([removed], clean.items.slice(at));
  return clean;
}

// How far the price has moved since the row was saved. Positive means cheaper.
export function priceMove(item) {
  if (!item || !item.price || !item.saved) return 0;
  return item.saved - item.price;
}

export async function readWatch() {
  const stored = await chrome.storage.local.get(WATCH_KEY);
  return cleanWatch(stored[WATCH_KEY]);
}

export async function saveWatch(watch) {
  const clean = cleanWatch(watch);
  await chrome.storage.local.set({ [WATCH_KEY]: clean });
  return clean;
}
