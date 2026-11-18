// The page's product detector: which pages count as a product page, and the
// price it reads from one. Runs in a small hand-built page, because the content
// script is a classic script with no exports.
//
//   node --test extension/test/page-scan.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/content/page-scan.js", import.meta.url), "utf8");

function priceSpan(text, attrs) {
  const el = {
    tagName: "SPAN",
    id: "",
    className: "",
    isConnected: true,
    innerText: text,
    textContent: text,
  };
  el.getAttribute = (name) => (name in attrs ? String(attrs[name]) : null);
  el.closest = () => null;
  el.getClientRects = () => [{ width: 80, height: 20 }];
  el.getBoundingClientRect = () => ({ width: 80, height: 20 });
  return el;
}

function page({ elements = {}, pathname = "/", search = "", title = "" }) {
  const window = {
    getComputedStyle: () => ({ display: "block", visibility: "visible", textDecorationLine: "none" }),
    URL,
  };
  const document = {
    title,
    querySelectorAll: (selector) => elements[selector] || [],
    querySelector: (selector) => (elements[selector] || [])[0] || null,
  };
  const context = {
    window,
    document,
    location: {
      href: "https://shop.example" + pathname + search,
      pathname,
      search,
      origin: "https://shop.example",
    },
    URL,
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    Array,
    String,
    Number,
    Object,
    Math,
    JSON,
    parseFloat,
    isFinite,
    setTimeout,
    console,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return window.PageScan;
}

test("a catalogue that keeps the product id in the query is read as a product page", () => {
  const scan = page({
    elements: { '[data-testid="price"]': [priceSpan("$49.99", {})] },
    pathname: "/x/y",
    search: "?sku=abc",
    title: "Kettle",
  });
  const product = scan.product();
  assert.equal(product && product.price, 4999);
  assert.equal(product.currency, "USD");
  assert.equal(product.key, "https://shop.example/x/y");
});

test("the same price element on an article is not a product", () => {
  const scan = page({
    elements: { '[data-testid="price"]': [priceSpan("$49.99", {})] },
    pathname: "/blog/post",
    title: "How to pour",
  });
  assert.equal(scan.product(), null);
});

test("a price range is not read as the product's price", () => {
  const scan = page({
    elements: { '[data-testid="product-price"]': [priceSpan("$10.00 \u2013 $20.00", {})] },
    pathname: "/product/kettle",
    title: "Kettle",
  });
  assert.equal(scan.product(), null, "a range is not a figure to watch");
});
