// The savings list and its automatic refresh: the bundled catalog, a published
// one, expiry, and the hourly pass in the real service worker.
//
//   node --test extension/test/catalog.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fake-chrome.mjs";
import { catalogOffers, catalogStatus, normalizeCatalog, CATALOG } from "../src/lib/catalog.js";
import { STORES } from "../src/lib/stores.js";
import { scopedKey, signUp } from "../src/lib/accounts.js";

const PERSON = {
  fullName: "Catalog Tester",
  email: "catalog.tester@example.com",
  phone: "+1 555 010 7777",
  dob: "1991-06-05",
  password: "testing12345",
};

test("the bundled list covers major stores without inventing a code", () => {
  const target = catalogOffers("target");
  assert.ok(target.length > 0, "Target has ways to save");
  assert.ok(target.every((offer) => offer.store === "target"));
  assert.ok(target.every((offer) => offer.kind));
  assert.ok(target.every((offer) => !offer.code), "bundled rows never pretend to be a real code");

  const amazon = catalogOffers("amazon");
  assert.ok(amazon.some((offer) => /coupon/i.test(offer.title)), "Amazon's coupon page is listed");
  assert.ok(catalogStatus().count > 100, "the list is substantial: " + catalogStatus().count);
  assert.match(catalogStatus().updated, /^\d{4}-\d{2}-\d{2}$/);
});

test("every bundled row names a real store, once, with a kind the panel can draw", () => {
  const ids = new Set(STORES.map((store) => store.id));
  const unknown = Array.from(new Set(CATALOG.filter((offer) => !ids.has(offer.store)).map((offer) => offer.store)));
  assert.deepEqual(unknown, [], "a row for a store the panel cannot open is a dead tip");
  const seen = new Set();
  CATALOG.forEach((offer) => {
    const key = offer.store + "|" + offer.kind + "|" + offer.title;
    assert.ok(!seen.has(key), "duplicate row: " + key);
    seen.add(key);
    assert.ok(["coupon", "deal", "member", "outlet", "service"].includes(offer.kind), offer.kind);
    assert.ok(offer.title && offer.detail, "a row needs a title and a detail");
  });
  assert.ok(new Set(CATALOG.map((offer) => offer.store)).size > 300, "the list covers a broad set of shops");
});

test("an offer with an end date drops out on its own", () => {
  const published = normalizeCatalog(
    {
      version: 9,
      updated: "2026-11-01",
      offers: [
        { store: "target", kind: "coupon", title: "Holiday code", code: "HOLIDAY10", ends: "2026-12-25" },
        { store: "target", kind: "deal", title: "Expired row", ends: "2020-01-01" },
        { store: "target", title: "" },
      ],
    },
    Date.parse("2026-11-20T12:00:00Z")
  );
  assert.equal(published.offers.length, 1, "only the live row survives");
  assert.equal(published.offers[0].code, "HOLIDAY10");
  assert.equal(published.version, 9);
});

test("a published list cannot smuggle in a bad host, scheme or title", () => {
  const cleaned = normalizeCatalog(
    [
      { store: "not a store", title: "Row" },
      { store: "target", title: "Row", url: "javascript:alert(1)" },
      { store: "target", title: "Fine", url: "https://www.target.com/coupons" },
    ],
    0
  );
  assert.equal(cleaned.offers.length, 1);
  assert.equal(cleaned.offers[0].url, "https://www.target.com/coupons");
});

test("the worker answers with the store's savings rows and a freshness report", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  assert.equal((await signUp(PERSON)).ok, true);

  const payload = await fake.send({ type: "site:resolve", url: "https://www.target.com/cart" });
  assert.equal(payload.store.id, "target");
  assert.ok(Array.isArray(payload.offers) && payload.offers.length > 0, "rows arrive with the store");
  assert.ok(payload.offers.every((offer) => offer.store === "target"));
  assert.equal(payload.store.home, "https://target.com");
  assert.equal(payload.catalog.source, "starter");
  assert.equal(payload.catalog.auto, true);
  assert.ok(payload.catalog.checkedAt > 0);

  const report = await fake.send({ type: "catalog:status" });
  assert.equal(report.auto, true);
  assert.equal(report.source, "starter");
  assert.ok(report.count > 0);
  assert.equal(report.error, null);

  const refreshed = await fake.send({ type: "catalog:refresh" });
  assert.equal(refreshed.source, "starter");
});

test("turning automatic refresh off is honoured by the report", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  assert.equal((await signUp(PERSON)).ok, true);
  await fake.send({ type: "settings:set", settings: { autoRefresh: false } });
  const report = await fake.send({ type: "catalog:status" });
  assert.equal(report.auto, false);
});

test("the hourly pass drops codes whose date has passed", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  assert.equal((await signUp(PERSON)).ok, true);
  await fake.send({ type: "settings:set", settings: { autoRefresh: true } });

  const key = await scopedKey("saved");
  fake.store[key] = {
    target: [
      { code: "OLDCODE", title: "Last season", expires: "2020-01-01T00:00:00.000Z", at: 1 },
      { code: "STILLOK", title: "Live now", expires: "2099-01-01T00:00:00.000Z", at: 2 },
    ],
  };

  await fake.fireAlarm("luma-refresh");
  assert.deepEqual(
    fake.store[key].target.map((entry) => entry.code),
    ["STILLOK"],
    "the expired row is gone and the live one stays"
  );
});

test("installing the extension asks for the hourly pass", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  assert.equal(fake.alarms.length, 0);
  fake.listeners.onInstalled.forEach((fn) => fn({ reason: "install" }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  const alarm = fake.alarms.find((entry) => entry.name === "luma-refresh");
  assert.ok(alarm, "a refresh alarm was created");
  assert.equal(alarm.options.periodInMinutes, 60);
});
