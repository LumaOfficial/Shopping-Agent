// The toolkit's own arithmetic and storage shapes: the goal, the watch list,
// the store bookmarks, the insights, the keyboard map and the expiring-code
// rule. All of it is local to this device, so it can be checked in plain Node.
import test from "node:test";
import assert from "node:assert/strict";

import { sanitizePrefs, stepText, applyPrefs } from "./../src/lib/prefs.js";
import {
  dayKey,
  monthKey,
  sanitizeActivity,
  setGoal,
  recordAttempt,
  recordEarning,
  syncEarnings,
  todayTotals,
  monthTotal,
  streak,
  goalProgress,
} from "./../src/lib/goals.js";
import { cleanWatch, addWatch, removeWatch, restoreWatch, priceMove, watchId } from "./../src/lib/watchlist.js";
import { sanitizeBookmarks, setNote, togglePin, pushRecent, MAX_PINS } from "./../src/lib/bookmarks.js";
import { bestStore, topCategory, monthEarned, toCsv, summaryText } from "./../src/lib/insights.js";
import { actionFor, SHORTCUTS } from "./../src/lib/shortcuts.js";
import { daysLeft, endingSoon, normalizeCode } from "./../src/lib/codes.js";

const DAY = 24 * 60 * 60 * 1000;
const at = (year, month, day) => new Date(year, month, day, 12, 0, 0).getTime();

// ---- preferences -------------------------------------------------------

test("preferences take only the values the stylesheet has rules for", () => {
  const clean = sanitizePrefs({ contrast: "high", density: "tiny", motion: "reduce", textScale: 3, extra: "x" });
  assert.deepEqual(clean, { contrast: "high", density: "cozy", motion: "reduce", textScale: 1 });
  assert.deepEqual(sanitizePrefs(null), { contrast: "normal", density: "cozy", motion: "auto", textScale: 1 });
});

test("text size moves one step at a time and stops at the ends", () => {
  assert.equal(stepText({ textScale: 1 }, 1), 1.1);
  assert.equal(stepText({ textScale: 1 }, -1), 0.9);
  assert.equal(stepText({ textScale: 0.9 }, -1), 0.9, "no step below the smallest");
  assert.equal(stepText({ textScale: 1.2 }, 1), 1.2, "no step above the largest");
});

test("applying preferences writes the attributes and the scale the CSS reads", () => {
  const writes = {};
  const root = {
    dataset: {},
    style: { setProperty: (name, value) => (writes[name] = value) },
  };
  const applied = applyPrefs({ contrast: "high", density: "compact", motion: "reduce", textScale: 1.2 }, root);
  assert.equal(root.dataset.contrast, "high");
  assert.equal(root.dataset.density, "compact");
  assert.equal(root.dataset.motion, "reduce");
  assert.equal(writes["--text-scale"], "1.2");
  assert.equal(applied.textScale, 1.2);
});

// ---- goal --------------------------------------------------------------

test("days and months are named in local time", () => {
  assert.equal(dayKey(at(2026, 10, 12)), "2026-11-12");
  assert.equal(monthKey(at(2026, 10, 12)), "2026-11");
});

test("a goal is whole cents and zero clears it", () => {
  assert.equal(setGoal({}, 2500).goal, 2500);
  assert.equal(setGoal({ goal: 2500 }, 0).goal, 0);
  assert.equal(setGoal({}, -3).goal, 0);
  assert.equal(setGoal({}, "nonsense").goal, 0);
});

test("an attempt counts as tried, and an accepted one as applied too", () => {
  const now = at(2026, 10, 12);
  const tried = recordAttempt(null, false, now);
  assert.deepEqual(todayTotals(tried, now), { saved: 0, tries: 1, applied: 0 });
  const accepted = recordAttempt(tried, true, now);
  assert.deepEqual(todayTotals(accepted, now), { saved: 0, tries: 2, applied: 1 });
});

test("the month total adds only this month's earnings", () => {
  let activity = recordEarning(null, 500, at(2026, 10, 2));
  activity = recordEarning(activity, 250, at(2026, 10, 12));
  activity = recordEarning(activity, 900, at(2026, 9, 30));
  assert.equal(monthTotal(activity, at(2026, 10, 12)), 750);
});

test("a wallet read twice does not count the same earning twice", () => {
  const entries = [
    { id: "e_1", amount: 400, at: at(2026, 10, 12) },
    { id: "e_2", amount: 600, at: at(2026, 10, 12) },
  ];
  const first = syncEarnings(null, entries, at(2026, 10, 12));
  assert.equal(first.added, 2);
  assert.equal(monthTotal(first, at(2026, 10, 12)), 1000);
  const again = syncEarnings(first, entries, at(2026, 10, 12));
  assert.equal(again.added, 0);
  assert.equal(monthTotal(again, at(2026, 10, 12)), 1000);
});

test("the streak counts back from today, or from yesterday before today starts", () => {
  const now = at(2026, 10, 12);
  let activity = null;
  activity = recordAttempt(activity, false, at(2026, 10, 10));
  activity = recordAttempt(activity, false, at(2026, 10, 11));
  activity = recordAttempt(activity, false, at(2026, 10, 12));
  assert.equal(streak(activity, now), 3);
  // Nothing yet today still reads as the run that ended yesterday.
  assert.equal(streak(activity, at(2026, 10, 13)), 3);
  // A missed day ends the run.
  assert.equal(streak(activity, at(2026, 10, 14)), 0);
});

test("goal progress reports what is on the meter and what is left", () => {
  const now = at(2026, 10, 12);
  let activity = setGoal({}, 1000);
  activity = recordEarning(activity, 400, now);
  const progress = goalProgress(activity, now);
  assert.equal(progress.set, true);
  assert.equal(progress.saved, 400);
  assert.equal(progress.left, 600);
  assert.equal(progress.ratio, 0.4);
  assert.equal(goalProgress({}, now).set, false);
});

test("an activity record keeps only named days and whole figures", () => {
  const clean = sanitizeActivity({
    goal: 100,
    days: { "2026-11-12": { saved: 25.7, tries: -2, applied: "3" }, "not-a-day": { saved: 9 } },
    seen: ["e_1", 7],
  });
  assert.deepEqual(Object.keys(clean.days), ["2026-11-12"]);
  assert.deepEqual(clean.days["2026-11-12"], { saved: 26, tries: 0, applied: 3 });
  assert.deepEqual(clean.seen, ["e_1"]);
});

// ---- watch list --------------------------------------------------------

function product(over) {
  return Object.assign(
    { storeId: "target", storeName: "Target", title: "Canvas Tote Bag", price: 2000, currency: "USD", at: 1 },
    over || {}
  );
}

test("a watched product is one row per store and title", () => {
  assert.equal(watchId(product()), watchId(product({ title: "  canvas   tote bag " })));
  assert.equal(watchId({ storeId: "", title: "x" }), null);
  const first = addWatch(null, product());
  assert.equal(first.duplicate, false);
  const second = addWatch(first.watch, product({ price: 1800 }));
  assert.equal(second.duplicate, true);
  assert.equal(second.watch.items.length, 1, "the same product is not listed twice");
  assert.equal(second.watch.items[0].price, 1800);
  assert.equal(second.watch.items[0].saved, 2000, "the price it was first saved at is kept");
});

test("a price below the saved price reads as a drop", () => {
  const { watch } = addWatch(null, product({ price: 2000 }));
  const cheap = { watch: addWatch(watch, product({ price: 1500 })).watch };
  assert.equal(priceMove(cheap.watch.items[0]), 500);
  assert.equal(priceMove(watch.items[0]), 0);
});

test("removing a row can be put back where it was", () => {
  let watch = addWatch(null, product({ title: "One" })).watch;
  watch = addWatch(watch, product({ title: "Two" })).watch;
  const target = watch.items[1];
  const removed = removeWatch(watch, target.id);
  assert.equal(removed.watch.items.length, 1);
  assert.equal(removed.index, 1);
  const back = restoreWatch(removed.watch, removed.removed, removed.index);
  assert.deepEqual(
    back.items.map((item) => item.title),
    ["Two", "One"]
  );
});

test("the watch list drops rows with no readable price", () => {
  const clean = cleanWatch({
    items: [product(), product({ price: 0 }), product({ title: "" })],
  });
  assert.equal(clean.items.length, 1);
});

// ---- store bookmarks ---------------------------------------------------

test("a note is kept per store and an empty note removes it", () => {
  let books = setNote({}, "target", "  Free shipping over $35  ");
  assert.equal(books.notes.target, "Free shipping over $35");
  books = setNote(books, "target", "   ");
  assert.equal(books.notes.target, undefined);
});

test("pinning toggles, caps, and only takes a store id", () => {
  let books = togglePin({}, "target");
  assert.deepEqual(books.pins, ["target"]);
  books = togglePin(books, "target");
  assert.deepEqual(books.pins, []);
  for (let i = 0; i < MAX_PINS + 3; i += 1) books = togglePin(books, "store" + i);
  assert.equal(books.pins.length, MAX_PINS);
  assert.deepEqual(togglePin({}, "Not A Store!").pins, []);
});

test("recent searches are newest first, without duplicates", () => {
  let books = pushRecent({}, "nike");
  books = pushRecent(books, "target");
  books = pushRecent(books, "Nike");
  assert.deepEqual(books.recents, ["Nike", "target"]);
  assert.deepEqual(pushRecent(books, "x").recents, ["Nike", "target"], "a one-letter search is not remembered");
});

// ---- insights ----------------------------------------------------------

const ENTRIES = [
  { id: "e1", storeId: "target", storeName: "Target", amount: 500, currency: "USD", at: at(2026, 10, 2) },
  { id: "e2", storeId: "target", storeName: "Target", amount: 300, currency: "USD", at: at(2026, 10, 10) },
  { id: "e3", storeId: "nike", storeName: "Nike", amount: 200, currency: "USD", at: at(2026, 9, 20) },
  { id: "s1", storeId: "sponsored", storeName: "Advertiser", amount: 9000, currency: "USD", sponsored: true, at: at(2026, 10, 11) },
];

test("the best store is a shop, not an advertiser", () => {
  assert.deepEqual(bestStore({ entries: ENTRIES }), { name: "Target", amount: 800, currency: "USD" });
  assert.equal(bestStore({ entries: [] }), null);
});

test("the top category comes from the catalog and skips sponsored credits", () => {
  const categories = { target: "General", nike: "Fashion" };
  assert.deepEqual(topCategory({ entries: ENTRIES }, (id) => categories[id]), { name: "General", amount: 800 });
});

test("this month counts the month's entries and nothing older", () => {
  assert.equal(monthEarned({ entries: ENTRIES }, at(2026, 10, 12)), 800 + 9000);
});

test("the CSV quotes what a spreadsheet would otherwise split", () => {
  const csv = toCsv({
    entries: [
      { storeName: 'Smith, Jones "Co"', status: "pending", amount: 1234, currency: "USD", at: at(2026, 10, 12) },
    ],
  });
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "date,store,status,amount,currency");
  assert.match(lines[1], /"Smith, Jones ""Co""",pending,12\.34,USD$/);
});

test("the summary says what the panel knows", () => {
  const text = summaryText({
    goal: { set: true, goal: 5000, saved: 2000 },
    month: 800,
    today: 500,
    streak: 3,
    best: { name: "Target" },
    watch: 2,
  });
  assert.match(text, /Monthly goal: 20\.00 of 50\.00/);
  assert.match(text, /This month: 8\.00/);
  assert.match(text, /Best store: Target/);
  assert.match(text, /Watched products: 2/);
});

// ---- keyboard ----------------------------------------------------------

test("shortcuts fire on a key press, not while typing or with a modifier", () => {
  assert.equal(actionFor({ key: "g" }), "focus-goal");
  assert.equal(actionFor({ key: "/" }), "focus-search");
  assert.equal(actionFor({ key: "?" }), "help");
  assert.equal(actionFor({ key: "g", target: { tagName: "INPUT" } }), null);
  assert.equal(actionFor({ key: "w", target: { tagName: "TEXTAREA" } }), null);
  assert.equal(actionFor({ key: "p", ctrlKey: true }), null);
  assert.equal(actionFor({ key: "Escape", target: { tagName: "INPUT" } }), "escape");
  assert.equal(actionFor({ key: "q" }), null);
  assert.ok(SHORTCUTS.length >= 5);
});

// ---- expiring codes ----------------------------------------------------

test("a code that ends this week is counted and listed first", () => {
  const now = at(2026, 10, 12);
  const soon = normalizeCode({ code: "ENDSOON", expires: new Date(now + 2 * DAY).toISOString() });
  const later = normalizeCode({ code: "ENDSLATER", expires: new Date(now + 30 * DAY).toISOString() });
  const forever = normalizeCode({ code: "NEVER" });
  assert.equal(daysLeft(soon, now), 2);
  assert.equal(daysLeft(forever, now), null);
  assert.deepEqual(
    endingSoon([later, soon, forever], 7, now).map((coupon) => coupon.code),
    ["ENDSOON"]
  );
});
