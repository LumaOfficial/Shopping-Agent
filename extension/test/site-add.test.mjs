// Whether a page the shopper found is a shop we can cover: the evidence that
// adds it, and the evidence that deliberately does not.
//
//   node --test extension/test/site-add.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { ADDED_CATEGORY, decideSite, platformLabel } from "../src/lib/site-add.js";

test("store markup beside a cart is enough to cover a site", () => {
  const verdict = decideSite(
    { name: "Nimbus Outfitters", structured: { store: true }, cart: true },
    "nimbus.example"
  );
  assert.equal(verdict.add, true);
  assert.equal(verdict.name, "Nimbus Outfitters");
  assert.equal(verdict.category, ADDED_CATEGORY);
  assert.deepEqual(verdict.evidence, ["store markup", "cart"]);
});

test("a known storefront platform adds a page that names no store", () => {
  const verdict = decideSite({ platform: "shopify", cart: true }, "brand.example");
  assert.equal(verdict.add, true);
  assert.equal(verdict.name, "brand.example");
  assert.deepEqual(verdict.evidence, ["Shopify", "cart"]);
});

test("product markup with a real offer is a shop, platform or not", () => {
  const verdict = decideSite(
    { structured: { product: true, offer: true }, addToCart: true },
    "kettle.example"
  );
  assert.equal(verdict.add, true, "product + offer + add to cart is shop evidence");
});

test("a blog with a lone cart link is not a shop", () => {
  const verdict = decideSite({ structured: {}, cart: true }, "blog.example");
  assert.equal(verdict.add, false);
  assert.equal(verdict.name, null);
  assert.match(verdict.reason, /not enough storefront data/i);
});

test("a page with nothing on it says so instead of guessing", () => {
  const verdict = decideSite({ structured: {} }, "plain.example");
  assert.equal(verdict.add, false);
  assert.match(verdict.reason, /no storefront data/i);
});

test("the platform names the panel prints", () => {
  assert.equal(platformLabel("wix"), "Wix");
  assert.equal(platformLabel("salesforce"), "Salesforce Commerce");
  assert.equal(platformLabel("made-up"), "made-up");
});
