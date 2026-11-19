// The shop list behind the deals ranking: what is kept, what is ignored, and the
// weights the feed reads. Nothing here touches a page or a network.
//
//   node --test extension/test/store-affinity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSignals,
  cleanAffinity,
  noteVisit,
} from "../src/lib/store-affinity.js";

const HOUR = 60 * 60 * 1000;

test("a stored record keeps only a bounded list of real shops", () => {
  const clean = cleanAffinity({
    visits: {
      Target: { count: 2, last: 10 },
      "best buy": { count: 1, last: 5 },
      "bad id!": { count: 9, last: 99 },
      nike: { count: 0, last: 3 },
      amazon: { count: "lots", last: "soon" },
    },
  });
  // A row whose count is not a number is dropped rather than counted as one.
  assert.deepEqual(Object.keys(clean.visits), ["target"]);
  assert.equal(clean.visits.target.count, 2);

  const many = { visits: {} };
  for (let i = 0; i < 60; i += 1) many.visits["shop" + i] = { count: 1, last: i };
  assert.equal(Object.keys(cleanAffinity(many).visits).length, 40, "the list is capped");
  assert.equal(cleanAffinity(many).visits.shop59.count, 1, "the most recent are kept");
});

test("junk in storage reads as an empty record", () => {
  [null, undefined, 3, "x", [], { visits: "no" }].forEach((raw) => {
    assert.deepEqual(cleanAffinity(raw), { visits: {} });
  });
});

test("a reload is not a new shopping trip", () => {
  const first = noteVisit({}, "target", 1000);
  assert.equal(first.changed, true);
  assert.equal(first.affinity.visits.target.count, 1);

  const again = noteVisit(first.affinity, "target", 1000 + HOUR / 2);
  assert.equal(again.changed, false, "inside the gap nothing is written");
  assert.equal(again.affinity.visits.target.count, 1);

  const later = noteVisit(first.affinity, "target", 1000 + HOUR * 2);
  assert.equal(later.changed, true);
  assert.equal(later.affinity.visits.target.count, 2);
});

test("an unknown or malformed shop is ignored", () => {
  [null, "", "not a store", "a/shop"].forEach((id) => {
    const step = noteVisit({}, id, 1000);
    assert.equal(step.changed, false);
    assert.deepEqual(step.affinity, { visits: {} });
  });
});

test("a pinned shop outweighs a visited one, and both lift their categories", () => {
  const signals = buildSignals({
    pins: ["nike"],
    affinity: { visits: { target: { count: 5, last: 1 } } },
    watch: [{ storeId: "sephora" }],
  });
  assert.equal(signals.stores.nike, 3);
  assert.equal(signals.stores.target, 2, "a shop's weight stops at two");
  assert.equal(signals.stores.sephora, 2);
  assert.ok(signals.categories.shoes > 0, "a shoe shop lifts the shoes category");
  assert.ok(signals.categories.beauty > 0);
  assert.equal(signals.categories.shoes, 2, "a category never outranks its shop");
});

test("with nothing known there are no signals", () => {
  const signals = buildSignals({});
  assert.deepEqual(signals, { stores: {}, categories: {} });
  assert.deepEqual(buildSignals(), { stores: {}, categories: {} });
});
