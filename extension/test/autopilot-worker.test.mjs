// The autopilot's page pass, driven through the real service worker: a cart
// page gets the store's own clip controls pressed and the product's price
// recorded, and the watch list follows the price the page showed.
//
//   node --test extension/test/autopilot-worker.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fake-chrome.mjs";

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

test("a cart page presses the store's clip controls before any code is tried", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });

  const sent = [];
  fake.answerWith((message) => {
    sent.push(message.type);
    if (message.type === "page:scan") {
      return {
        product: { key: "target|widget", title: "Widget", price: 1999, currency: "USD" },
        clipCount: 2,
      };
    }
    if (message.type === "page:clip") return { ok: true };
    if (message.type === "coupon:probe") return { hasField: false };
    return null;
  });

  fake.fireTabUpdate(7, { status: "complete" }, { id: 7, url: "https://www.target.com/cart" });
  await settle();
  await settle();

  assert.ok(sent.indexOf("page:scan") !== -1, "the page is read");
  assert.ok(sent.indexOf("page:clip") !== -1, "the store's own clip controls are pressed");
  assert.ok(
    sent.indexOf("page:clip") < sent.indexOf("coupon:probe"),
    "clipping happens before the code pass probes the promo field"
  );

  const price = await fake.send({ type: "price:get", key: "target|widget" });
  assert.equal(price.current, 1999, "the product's own price is recorded for the history");
});

test("a product page records its price without pressing anything", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });

  const sent = [];
  fake.answerWith((message) => {
    sent.push(message.type);
    if (message.type === "page:scan") {
      return {
        product: { key: "target|gadget", title: "Gadget", price: 4999, currency: "USD" },
        clipCount: 3,
      };
    }
    return null;
  });

  fake.fireTabUpdate(8, { status: "complete" }, { id: 8, url: "https://www.target.com/p/gadget/123" });
  await settle();
  await settle();

  assert.ok(sent.indexOf("page:scan") !== -1);
  assert.equal(sent.indexOf("page:clip"), -1, "clip controls belong to a basket, not a product page");
  assert.equal(sent.indexOf("coupon:probe"), -1, "no code pass outside a checkout");
});

test("a watched product's row follows the price the page showed", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });

  await fake.chrome.storage.local.set({
    priceWatch: {
      items: [
        {
          id: "target|widget",
          storeId: "target",
          storeName: "Target",
          title: "Widget",
          currency: "USD",
          price: 2499,
          saved: 2499,
          url: "https://www.target.com/p/widget/123",
          at: Date.now(),
        },
      ],
    },
  });

  await fake.send({
    type: "price:record",
    product: { key: "target|widget", storeId: "target", title: "Widget", price: 1999, currency: "USD" },
  });

  const watch = (await fake.chrome.storage.local.get("priceWatch")).priceWatch;
  assert.equal(watch.items[0].price, 1999, "the row shows the price seen most recently");
  assert.equal(watch.items[0].saved, 2499, "the price it was saved at is untouched, so the move is measured against it");
});

test("a product nobody watches writes nothing to the watch list", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });

  await fake.send({
    type: "price:record",
    product: { key: "target|other", storeId: "target", title: "Other", price: 999, currency: "USD" },
  });

  const stored = await fake.chrome.storage.local.get("priceWatch");
  assert.equal(stored.priceWatch, undefined);
});
