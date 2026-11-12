// The checkout filler: which field gets what, and which field is deliberately
// left empty. A mistake here types a card number into an expiry box, so the
// field the number lands in is asserted, not assumed.
//
// The content script is a classic script with no exports, so it runs in a small
// hand-built page: the elements it looks for, and nothing else.
//
//   node --test extension/test/card-fill.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/content/card-fill.js", import.meta.url), "utf8");

class Event {
  constructor(type) {
    this.type = type;
  }
}
class InputEvent extends Event {}

class HTMLInputElement {
  get value() {
    return this._value === undefined ? "" : this._value;
  }
  set value(next) {
    this._value = String(next);
  }
}
class HTMLSelectElement extends HTMLInputElement {}

function field(tag, attrs) {
  const el = tag === "SELECT" ? new HTMLSelectElement() : new HTMLInputElement();
  el.tagName = tag;
  el.type = attrs.type || "text";
  el.id = attrs.id || "";
  el.disabled = Boolean(attrs.disabled);
  el.readOnly = Boolean(attrs.readOnly);
  el.options = attrs.options || [];
  el.labelText = attrs.text || "";
  el.events = [];
  el.attrs = attrs;
  el.getAttribute = (name) => (name in attrs ? String(attrs[name]) : null);
  el.getClientRects = () => [{ width: 200, height: 30 }];
  el.focus = () => {};
  el.dispatchEvent = (event) => {
    el.events.push(event.type);
    return true;
  };
  Object.defineProperty(el, "textContent", { get: () => el.labelText });
  return el;
}

function page(fields) {
  const window = { HTMLInputElement, HTMLSelectElement };
  const context = {
    window,
    document: { querySelectorAll: () => fields },
    Event,
    InputEvent,
    Array,
    String,
    Number,
    Object,
    console,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { cardFill: window.CardFill, fields };
}

const CARD = { brand: "visa", number: "4242424242424242", expMonth: 9, expYear: 2029, holder: "Ada Lovelace" };

test("the number, the expiry and the name go into their own fields", () => {
  const number = field("INPUT", { autocomplete: "cc-number" });
  const expiry = field("INPUT", { autocomplete: "cc-exp" });
  const name = field("INPUT", { autocomplete: "cc-name" });
  const cvc = field("INPUT", { autocomplete: "cc-csc" });
  const { cardFill } = page([number, expiry, name, cvc]);

  const result = cardFill.fill(CARD);
  assert.deepEqual(Array.from(result.filled), ["number", "expiry", "name"]);
  assert.equal(number.value, "4242 4242 4242 4242", "grouped the way the card is printed");
  assert.equal(expiry.value, "09/29");
  assert.equal(name.value, "Ada Lovelace");

  // The security code is never stored, so nothing may be written into its field.
  assert.equal(cvc.value, "");
  assert.equal(cvc.events.length, 0, "the CVC field is not even focused");
  assert.equal(result.hasCvc, true, "the panel is told the shopper has to type it");

  // A page that listens for typing has to see the same events a keystroke makes.
  assert.deepEqual(Array.from(number.events), ["input", "change"]);
});

test("a separate month and year pair is filled from the right lists", () => {
  const number = field("INPUT", { name: "cardNumber" });
  const month = field("SELECT", {
    autocomplete: "cc-exp-month",
    options: [
      { value: "", textContent: "Month" },
      { value: "8", textContent: "08" },
      { value: "9", textContent: "09" },
    ],
  });
  const year = field("SELECT", {
    autocomplete: "cc-exp-year",
    options: [
      { value: "28", textContent: "2028" },
      { value: "29", textContent: "2029" },
    ],
  });
  const { cardFill } = page([number, month, year]);

  const result = cardFill.fill(CARD);
  assert.deepEqual(Array.from(result.filled), ["number", "expiry"]);
  assert.equal(month.value, "9");
  assert.equal(year.value, "29");
});

test("a four-digit expiry field is given four digits", () => {
  const number = field("INPUT", { autocomplete: "cc-number" });
  const expiry = field("INPUT", { autocomplete: "cc-exp", placeholder: "MM / YYYY", maxlength: "7" });
  const { cardFill } = page([number, expiry]);

  cardFill.fill(CARD);
  assert.equal(expiry.value, "09/2029");
});

test("a page with no card field is reported as missing, not filled blind", () => {
  const search = field("INPUT", { name: "q", type: "search" });
  const { cardFill } = page([search]);

  const result = cardFill.fill(CARD);
  assert.deepEqual(Array.from(result.filled), []);
  assert.deepEqual(Array.from(result.missing), ["number", "expiry"]);
  assert.equal(search.value, "");
});

test("a hidden duplicate is not filled", () => {
  const visible = field("INPUT", { autocomplete: "cc-number" });
  const hidden = field("INPUT", { autocomplete: "cc-number", disabled: true });
  const { cardFill } = page([hidden, visible]);

  cardFill.fill(CARD);
  assert.equal(hidden.value, "");
  assert.equal(visible.value, "4242 4242 4242 4242");
});
