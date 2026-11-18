// The promo-field detector: which boxes on a cart page are offered a code, and
// which are deliberately left alone. The content script is a classic script, so
// it runs in a small hand-built page with only the elements it looks for.
//
//   node --test extension/test/coupon-field.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/content/coupon-engine.js", import.meta.url), "utf8");

function input(attrs) {
  const el = {
    tagName: "INPUT",
    type: attrs.type || "text",
    id: attrs.id || "",
    name: attrs.name || "",
    className: attrs.className || "",
    disabled: Boolean(attrs.disabled),
    readOnly: Boolean(attrs.readOnly),
    isConnected: true,
    form: null,
    parentElement: null,
  };
  el.getAttribute = (name) => (name in attrs ? String(attrs[name]) : null);
  el.getBoundingClientRect = () => ({ width: 220, height: 34 });
  return el;
}

function engine(fields) {
  const window = {
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1", clip: "auto" }),
  };
  const context = {
    window,
    document: { querySelectorAll: () => fields },
    HTMLInputElement: function () {},
    HTMLTextAreaElement: function () {},
    Event: function (type) {
      this.type = type;
    },
    KeyboardEvent: function (type) {
      this.type = type;
    },
    setTimeout,
    Array,
    String,
    Number,
    Object,
    console,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return window.CouponEngine;
}

test("a combined discount-or-gift-card box still takes the code", () => {
  const combined = input({ placeholder: "Discount code or gift card" });
  const fields = engine([combined]).findFields();
  assert.equal(fields.length, 1);
  assert.equal(fields[0], combined);
});

test("a plain 'Enter code' box is found", () => {
  const plain = input({ placeholder: "Enter code" });
  const fields = engine([plain]).findFields();
  assert.equal(fields.length, 1);
  assert.equal(fields[0], plain);
});

test("a gift-card-only box is left alone", () => {
  const gift = input({ placeholder: "Gift card number" });
  assert.equal(engine([gift]).findFields().length, 0);
});

test("a zip code box is not a promo field", () => {
  const zip = input({ name: "zip", placeholder: "Zip code" });
  assert.equal(engine([zip]).findFields().length, 0);
});

test("the box that names a coupon outranks a generic code box", () => {
  const generic = input({ placeholder: "Enter code" });
  const promo = input({ placeholder: "Promo code" });
  const fields = engine([generic, promo]).findFields();
  assert.equal(fields[0], promo);
  assert.equal(fields.length, 2);
});
