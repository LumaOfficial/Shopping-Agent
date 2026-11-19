// Which shops this profile actually uses. The deals feed reads it to put those
// shops first, and nothing else does: it stays in this browser profile, carries
// no account or page content, and is never sent anywhere.
//
// One row per shop: how many separate shopping trips it has seen and when the
// last one was. A reload is not a new trip, so a repeat visit inside the gap is
// ignored — that keeps the record small and the weighting honest.
import { storeById } from "./stores.js";

export const AFFINITY_KEY = "storeAffinity";

const MAX_STORES = 40;
const MAX_COUNT = 999;
const VISIT_GAP_MS = 60 * 60 * 1000;

function storeId(value) {
  const id = String(value == null ? "" : value).trim().toLowerCase();
  return /^[a-z0-9_-]{1,60}$/.test(id) ? id : null;
}

export function cleanAffinity(raw) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const source = input.visits && typeof input.visits === "object" ? input.visits : {};
  const rows = [];
  Object.keys(source).forEach((key) => {
    const id = storeId(key);
    const row = source[key];
    if (!id || !row || typeof row !== "object") return;
    const count = Math.min(MAX_COUNT, Math.round(Number(row.count) || 0));
    const last = Math.max(0, Number(row.last) || 0);
    if (count <= 0) return;
    rows.push({ id, count, last });
  });
  // The most recently used shops are the ones worth keeping.
  rows.sort((a, b) => b.last - a.last || b.count - a.count);
  const visits = {};
  rows.slice(0, MAX_STORES).forEach((row) => {
    visits[row.id] = { count: row.count, last: row.last };
  });
  return { visits };
}

// Returns the record unchanged when the shop was already seen inside the gap,
// so the caller only writes when something actually changed.
export function noteVisit(affinity, id, now = Date.now()) {
  const clean = cleanAffinity(affinity);
  const key = storeId(id);
  if (!key) return { affinity: clean, changed: false };
  const row = clean.visits[key];
  const at = Number(now) || Date.now();
  if (row && at - row.last < VISIT_GAP_MS) return { affinity: clean, changed: false };
  const visits = Object.assign({}, clean.visits);
  visits[key] = { count: Math.min(MAX_COUNT, (row ? row.count : 0) + 1), last: at };
  return { affinity: cleanAffinity({ visits }), changed: true };
}

export async function readAffinity() {
  const stored = await chrome.storage.local.get(AFFINITY_KEY);
  return cleanAffinity(stored[AFFINITY_KEY]);
}

export async function saveAffinity(affinity) {
  const clean = cleanAffinity(affinity);
  await chrome.storage.local.set({ [AFFINITY_KEY]: clean });
  return clean;
}

// The catalog groups shops more broadly than the feed groups products: a shoe
// shop is "Fashion" there and "shoes" on a card. This is that translation, so a
// category signal can actually meet an offer.
const CATEGORY_OF_STORE = {
  Fashion: ["fashion", "shoes", "eyewear", "workwear"],
  Electronics: ["electronics", "laptop", "phone", "tablet", "tv", "audio", "camera", "wearables", "gaming"],
  Home: ["home", "kitchen", "furniture"],
  Beauty: ["beauty"],
  Pets: ["pet"],
  Outdoor: ["outdoor"],
  Books: ["books"],
  Software: ["software"],
  Tools: ["tools"],
  Fitness: ["fitness"],
  Gaming: ["gaming", "electronics"],
  Grocery: ["grocery"],
  Health: ["health", "beauty"],
  Music: ["audio"],
  Photo: ["camera"],
  Office: ["software"],
};

function productCategories(id) {
  const store = storeById(id);
  if (!store) return [];
  return CATEGORY_OF_STORE[store.category] || [String(store.category || "").toLowerCase()];
}

// The weights the ranking reads. A pinned shop counts most, then a shop the
// shopper has visited, then one they are watching a product at. Each also
// contributes its category at a lower weight, so someone who lives in running
// shoes still sees footwear offers at a shop they have not opened yet.
export function buildSignals({ affinity, pins, watch } = {}) {
  const stores = {};
  const categories = {};

  const add = (id, weight) => {
    const key = storeId(id);
    if (!key) return;
    stores[key] = Math.max(stores[key] || 0, weight);
    productCategories(key).forEach((category) => {
      if (!category) return;
      categories[category] = Math.max(categories[category] || 0, Math.min(weight, 2));
    });
  };

  (Array.isArray(pins) ? pins : []).forEach((id) => add(id, 3));

  const visits = cleanAffinity(affinity).visits;
  Object.keys(visits).forEach((id) => add(id, Math.min(2, visits[id].count)));

  (Array.isArray(watch) ? watch : []).forEach((item) => add(item && item.storeId, 2));

  return { stores, categories };
}
