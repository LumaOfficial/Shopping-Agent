// Small things a shopper keeps about stores rather than about money: a note on
// a particular shop, the handful of shops pinned as one-tap launchers, and the
// searches they ran last. All of it stays in this browser profile.
export const BOOKMARKS_KEY = "storeBookmarks";

export const MAX_NOTE = 160;
export const MAX_PINS = 6;
export const MAX_RECENTS = 6;

export function emptyBookmarks() {
  return { notes: {}, pins: [], recents: [] };
}

function storeId(value) {
  const id = String(value == null ? "" : value).trim().toLowerCase();
  return /^[a-z0-9_-]{1,60}$/.test(id) ? id : null;
}

export function cleanNote(text) {
  return String(text == null ? "" : text)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NOTE);
}

export function sanitizeBookmarks(raw) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const notes = {};
  const source = input.notes && typeof input.notes === "object" ? input.notes : {};
  Object.keys(source).forEach((key) => {
    const id = storeId(key);
    const note = cleanNote(source[key]);
    if (id && note) notes[id] = note;
  });
  const pins = [];
  (Array.isArray(input.pins) ? input.pins : []).forEach((value) => {
    const id = storeId(value);
    if (id && pins.indexOf(id) === -1) pins.push(id);
  });
  const recents = [];
  (Array.isArray(input.recents) ? input.recents : []).forEach((value) => {
    const text = cleanNote(value).slice(0, 40);
    if (text && recents.indexOf(text) === -1) recents.push(text);
  });
  return { notes, pins: pins.slice(0, MAX_PINS), recents: recents.slice(0, MAX_RECENTS) };
}

// An empty note removes the entry rather than storing a blank.
export function setNote(bookmarks, id, text) {
  const clean = sanitizeBookmarks(bookmarks);
  const key = storeId(id);
  if (!key) return clean;
  const note = cleanNote(text);
  const notes = Object.assign({}, clean.notes);
  if (note) notes[key] = note;
  else delete notes[key];
  clean.notes = notes;
  return clean;
}

export function togglePin(bookmarks, id) {
  const clean = sanitizeBookmarks(bookmarks);
  const key = storeId(id);
  if (!key) return clean;
  if (clean.pins.indexOf(key) !== -1) {
    clean.pins = clean.pins.filter((entry) => entry !== key);
    return clean;
  }
  clean.pins = [key].concat(clean.pins).slice(0, MAX_PINS);
  return clean;
}

// Newest first, no duplicates, one entry per shop the shopper looked for.
export function pushRecent(bookmarks, query) {
  const clean = sanitizeBookmarks(bookmarks);
  const text = cleanNote(query).slice(0, 40);
  if (text.length < 2) return clean;
  clean.recents = [text]
    .concat(clean.recents.filter((entry) => entry.toLowerCase() !== text.toLowerCase()))
    .slice(0, MAX_RECENTS);
  return clean;
}

export async function readBookmarks() {
  const stored = await chrome.storage.local.get(BOOKMARKS_KEY);
  return sanitizeBookmarks(stored[BOOKMARKS_KEY]);
}

export async function saveBookmarks(bookmarks) {
  const clean = sanitizeBookmarks(bookmarks);
  await chrome.storage.local.set({ [BOOKMARKS_KEY]: clean });
  return clean;
}
