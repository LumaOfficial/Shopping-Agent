// The deals feed: partner offers, the product each one pairs with, and the rules
// that keep both honest — a bar is enforced but never printed, and a saving
// appears only where the store publishes a rate.
//
//   node --test extension/test/deals.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEALS_UPDATED,
  PARTNER_DEALS,
  POPULAR_PRODUCTS,
  matchDeals,
  offerFor,
  offerLines,
  productUrl,
  qualifies,
} from "../src/lib/deals.js";
import { STORES, hostsOf } from "../src/lib/stores.js";
import { money } from "../src/lib/format.js";

const storeIds = new Set(STORES.map((store) => store.id));

function allLines(offer) {
  const lines = offerLines(offer);
  return [lines.title, lines.price, lines.savings || "", lines.note, lines.terms].join(" ");
}

test("every deal and product names a store the panel can open", () => {
  const unknownDeals = PARTNER_DEALS.filter((deal) => !storeIds.has(deal.store));
  assert.deepEqual(unknownDeals.map((deal) => deal.id), [], "a deal for an unknown store cannot be shopped");
  const unknownProducts = POPULAR_PRODUCTS.filter((item) => !storeIds.has(item.store));
  assert.deepEqual(unknownProducts.map((item) => item.id), [], "a product for an unknown store cannot be opened");

  const ids = new Set();
  PARTNER_DEALS.forEach((deal) => {
    assert.ok(!ids.has(deal.id), "duplicate deal id: " + deal.id);
    ids.add(deal.id);
    assert.ok(deal.label && deal.note, "every deal says what it is: " + deal.id);
    assert.ok(deal.note.length > 20, "the note is a sentence, not a stub: " + deal.id);
  });
});

test("prices are whole cents and rates stay inside 0-100", () => {
  POPULAR_PRODUCTS.forEach((item) => {
    assert.ok(Number.isInteger(item.price) && item.price > 0, "price in minor units: " + item.id);
    assert.ok(item.popularity >= 0 && item.popularity <= 100, "popularity is a weight: " + item.id);
    assert.ok(item.category && item.q, "a product has a category and a search term: " + item.id);
  });
  PARTNER_DEALS.forEach((deal) => {
    if (deal.percent == null) return;
    assert.ok(deal.percent > 0 && deal.percent <= 100, "a rate is a percentage: " + deal.id);
  });
  assert.match(DEALS_UPDATED, /^\d{4}-\d{2}-\d{2}$/);
});

test("every deal has a product that clears it", () => {
  PARTNER_DEALS.forEach((deal) => {
    const eligible = POPULAR_PRODUCTS.filter((item) => qualifies(item, deal));
    assert.ok(eligible.length > 0, "nothing qualifies for " + deal.id);
  });
});

test("the feed pairs every bundled deal and offers no product twice", () => {
  const offers = matchDeals();
  assert.equal(offers.length, PARTNER_DEALS.length, "each live deal gets a product");

  const seen = new Set();
  offers.forEach((offer) => {
    assert.ok(offer.product.store === offer.deal.store, "pairing stays inside the deal's store");
    assert.ok(offer.price >= offer.deal.minSpend, "the offered product clears the bar: " + offer.deal.id);
    assert.ok(!seen.has(offer.product.id), "product offered twice: " + offer.product.id);
    seen.add(offer.product.id);
  });
});

test("the most popular qualifying product is the one offered", () => {
  const [offer] = matchDeals([PARTNER_DEALS.find((deal) => deal.id === "walmart-laptops")]);
  assert.equal(offer.product.id, "p-macbook-air-walmart", "the best-known laptop that qualifies leads");
});

test("a bar is enforced by the pairing, not negotiated around it", () => {
  const deal = {
    id: "test-laptops",
    store: "walmart",
    label: "Laptop offer",
    note: "A partner offer on laptops.",
    category: "laptop",
    minSpend: 150000,
    percent: null,
    ends: null,
  };
  const [offer] = matchDeals([deal]);
  assert.ok(offer, "the deal still finds a product");
  assert.ok(offer.product.price >= 150000, "only a product over the bar is offered");
  assert.equal(offer.product.id, "p-macbook-pro-walmart");
  assert.ok(offer.savings == null, "no rate published means no invented saving");

  const cheaper = { id: "cheap", store: "walmart", name: "Budget laptop", category: "laptop", price: 49900, popularity: 100, q: "laptop" };
  assert.equal(qualifies(cheaper, deal), false, "a popular product under the bar is still not eligible");
  assert.equal(qualifies(cheaper, Object.assign({}, deal, { minSpend: 0 })), true, "without a bar it is");
});

test("a saving appears only where the store publishes a rate", () => {
  const item = { id: "x", store: "target", name: "Apple iPad Air 11-inch (M3)", category: "tablet", price: 59900, popularity: 90, q: "iPad" };
  const rated = offerFor({ id: "d", store: "target", percent: 5 }, item);
  assert.equal(rated.savings, 2995, "5% of $599.00 in whole cents");
  assert.equal(rated.pay, 56905, "the price after the rate");
  assert.equal(offerLines(rated).savings, "$29.95");

  const unrated = offerFor({ id: "d", store: "target", percent: null }, item);
  assert.equal(unrated.savings, null, "no published rate, no figure");
  assert.equal(unrated.pay, null);
  assert.equal(offerLines(unrated).savings, null);
});

test("an ended deal drops out on its own", () => {
  const deal = Object.assign({}, PARTNER_DEALS.find((entry) => entry.id === "nike-clearance"), {
    ends: "2026-01-02",
  });
  const live = matchDeals([deal], POPULAR_PRODUCTS, Date.parse("2026-01-01T12:00:00Z"));
  assert.equal(live.length, 1, "a deal inside its window is offered");
  const gone = matchDeals([deal], POPULAR_PRODUCTS, Date.parse("2026-02-01T12:00:00Z"));
  assert.equal(gone.length, 0, "a deal past its end date is not");
});

test("the copy never prints the bar the offer sets", () => {
  // What the card can say about an offer comes from offerLines alone, so this is
  // the whole surface a threshold could leak through.
  const withBar = {
    id: "test-bar",
    store: "walmart",
    label: "Laptop offer",
    note: "A partner offer on laptops, applied in the cart.",
    category: "laptop",
    minSpend: 150000,
    percent: null,
    ends: null,
  };
  const text = allLines(matchDeals([withBar])[0]);
  assert.ok(!text.includes("1,500") && !text.includes("1500"), "the threshold is not advertised");
  assert.ok(!text.includes(money(150000)), "nor is the threshold as money");
  assert.match(text, /Store terms apply at checkout/, "the terms are still pointed at");

  matchDeals().forEach((offer) => {
    const lines = allLines(offer);
    if (offer.deal.minSpend > 0) {
      assert.ok(!lines.includes(money(offer.deal.minSpend)), "shipping bar leaked by " + offer.deal.id);
    }
    assert.match(lines, /Store terms apply at checkout/);
  });
});

test("every offered product opens at its own store, over https", () => {
  matchDeals().forEach((offer) => {
    const url = productUrl(offer.product);
    assert.match(url, /^https:\/\//, "only an https address leaves the panel: " + offer.product.id);
    const host = new URL(url).host.replace(/^www\./, "");
    const store = STORES.find((entry) => entry.id === offer.product.store);
    const own = hostsOf(store).some((candidate) => candidate === host || host.endsWith("." + candidate));
    assert.ok(own, offer.product.id + " opens on a host it does not belong to: " + host);
  });
});
