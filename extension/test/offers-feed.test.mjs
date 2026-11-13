// The authorized offer source: the payload shapes it may answer with, the
// storewide offers it may publish, and the two Settings tests that prove a
// pasted account works before the panel trusts it.
//
//   node --test extension/test/offers-feed.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fake-chrome.mjs";
import { readFeed } from "../src/partners/offers-feed.js";

const FEED = "https://feed.test/offers/{store}";

function stubNetwork(t, routes) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    const match = Object.keys(routes).find((prefix) => href.indexOf(prefix) === 0);
    if (!match) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(routes[match]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = original;
  });
}

function settingsSender(fake) {
  return { id: fake.chrome.runtime.id, url: fake.chrome.runtime.getURL("options.html") };
}

async function setup(t, settings, routes) {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  stubNetwork(t, routes);
  const reply = await fake.send(
    {
      type: "settings:set",
      settings: Object.assign({ feedUrl: FEED }, settings || {}),
    },
    settingsSender(fake)
  );
  assert.equal(reply.ok, true, "settings should save");
  return fake;
}

test("an Oxylabs async envelope is unwrapped to the store's own payload", () => {
  const inner = JSON.stringify({
    coupons: [{ code: "SAVE10", title: "10% off your order" }],
    deals: [
      { title: "Middle-earth bundle", detail: "Now $7.49, was $79.98", url: "https://gog.test/deal/1" },
      { title: "Unsafe row", url: "http://insecure.test/deal" },
    ],
  });
  const read = readFeed({ results: [{ status_code: 200, content: inner }] }, "gog");

  assert.equal(read.entry !== null, true, "the envelope is not mistaken for an empty answer");
  assert.equal(read.coupons.length, 1);
  assert.equal(read.coupons[0].code, "SAVE10");
  assert.equal(read.offers.length, 2);
  assert.equal(read.offers[0].kind, "deal");
  assert.equal(read.offers[0].url, "https://gog.test/deal/1");
  assert.equal(read.offers[1].url, null, "a plain-http link is dropped, not followed");
});

test("a feed's storewide offers sit beside the savings list, each with its source", async (t) => {
  const fake = await setup(t, {}, {
    "https://feed.test/offers/target": {
      deals: [{ title: "Live: 20% off the weekly ad", detail: "Today only", url: "https://target.test/sale" }],
    },
  });

  const reply = await fake.send({ type: "site:resolve", url: "https://www.target.com/" });
  assert.equal(reply.store.id, "target");
  const fromFeed = reply.offers.filter((offer) => offer.source === "feed");
  const fromCatalog = reply.offers.filter((offer) => offer.source === "catalog");
  assert.equal(fromFeed.length, 1, "the connected source fills the savings list");
  assert.equal(fromFeed[0].title, "Live: 20% off the weekly ad");
  assert.ok(fromCatalog.length > 0, "the bundled list still shows");
  assert.equal(reply.feed.status, "ok");
});

test("the price key is checked with the provider's own token endpoint", async (t) => {
  const fake = await setup(t, { priceHistoryKey: "key-123" }, {
    "https://api.keepa.com/token": { tokensLeft: 4200 },
  });

  const reply = await fake.send({ type: "price:test" }, settingsSender(fake));
  assert.equal(reply.ok, true);
  assert.match(reply.message, /4,200 tokens left/);

  const cleared = await fake.send(
    { type: "settings:set", settings: { priceHistoryKey: "" } },
    settingsSender(fake)
  );
  assert.equal(cleared.ok, true);
  const missing = await fake.send({ type: "price:test" }, settingsSender(fake));
  assert.equal(missing.ok, false);
  assert.match(missing.message, /No product API key/);
});
