// The autopilot's rules: when a page counts as a checkout, which codes a pass
// may enter, and what the panel is allowed to say about the result.
//
//   node --test extension/test/autopilot.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { AUTOPILOT_LIMIT, autopilotMessage, autopilotQueue, looksLikeCheckout } from "../src/lib/autopilot.js";
import { DEFAULTS, sanitizeSettings } from "../src/lib/settings.js";

test("a checkout is recognised by its path, not by a word in a query", () => {
  assert.equal(looksLikeCheckout("https://www.target.com/checkout"), true);
  assert.equal(looksLikeCheckout("https://www.target.com/cart"), true);
  assert.equal(looksLikeCheckout("https://www.target.com/basket/summary"), true);
  assert.equal(looksLikeCheckout("https://www.target.com/order/payment"), true);
  assert.equal(looksLikeCheckout("https://shop.example.com/en/payment"), true);

  // A product slug or a query string that happens to say "order" is not a cart.
  assert.equal(looksLikeCheckout("https://www.target.com/p/order-of-the-phoenix/123"), false);
  assert.equal(looksLikeCheckout("https://www.target.com/search?q=checkout"), false);
  assert.equal(looksLikeCheckout("https://www.target.com/cartoon-shirts"), false);
  assert.equal(looksLikeCheckout("not a url"), false);
  assert.equal(looksLikeCheckout(""), false);
});

test("a pass enters live codes, best source first, and never a refused one", () => {
  const codes = [
    { code: "SAVE10", source: "verified" },
    { code: "FALL20", source: "feed" },
    { code: "save10", source: "page" },
    { code: "OLD5", source: "feed", expires: "2020-01-01T00:00:00.000Z" },
    { code: "DEAD1", source: "feed" },
    { code: "", source: "feed" },
  ];

  const queue = autopilotQueue(codes, ["dead1"]);
  assert.deepEqual(queue.map((coupon) => coupon.code), ["SAVE10", "FALL20"], "the refused code is skipped and the duplicate collapses");
  assert.ok(queue.length <= AUTOPILOT_LIMIT);
});

test("a pass is capped so a checkout never sees a queue of attempts", () => {
  const codes = Array.from({ length: 9 }, (_unused, index) => ({ code: "CODE" + index, source: "feed" }));
  assert.equal(autopilotQueue(codes).length, AUTOPILOT_LIMIT);
  assert.equal(autopilotQueue(codes, [], 1).length, 1);
  assert.equal(autopilotQueue([], []).length, 0);
  assert.equal(autopilotQueue(null, null).length, 0);
});

test("the panel prints what the store answered, and no figure it did not confirm", () => {
  assert.deepEqual(autopilotMessage({ status: "applied", code: "SAVE10", message: "10% off applied" }), {
    tone: "ok",
    text: "SAVE10 entered at checkout — 10% off applied",
  });
  assert.equal(autopilotMessage({ status: "no-field" }).tone, "wait");
  assert.match(autopilotMessage({ status: "rejected", tried: 2 }).text, /Tried 2 codes/);
  assert.match(autopilotMessage({ status: "rejected", tried: 1 }).text, /Tried 1 code at checkout/);
  assert.match(autopilotMessage({ status: "none" }).text, /No code is known/);
  assert.doesNotMatch(autopilotMessage({ status: "rejected", tried: 3 }).text, /\$/, "no invented saving");
});

test("the switch is a boolean setting, on unless it is turned off", () => {
  assert.equal(DEFAULTS.autopilot, true);
  assert.equal(sanitizeSettings({}).autopilot, true);
  assert.equal(sanitizeSettings({ autopilot: false }).autopilot, false);
  assert.equal(sanitizeSettings({ autopilot: "off" }).autopilot, true, "a non-boolean falls back to the shipped default");
});
