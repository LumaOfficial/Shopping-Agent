// The gate the panel opens on. Agreement has to be a deliberate act that
// survives a restart, and a record that is not exactly a versioned acceptance
// must not read back as consent — otherwise anything that can write storage
// hands itself the features the gate is there for.
//
//   node --test extension/test/terms.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createFakeChrome } from "./fake-chrome.mjs";
import {
  acceptTerms,
  consentLine,
  readConsent,
  TERMS_UPDATED,
  TERMS_VERSION,
  withdrawConsent,
} from "../src/lib/terms.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function withChrome(t) {
  const fake = createFakeChrome();
  globalThis.chrome = fake.chrome;
  t.after(() => {
    delete globalThis.chrome;
  });
  return fake;
}

test("a fresh profile has not agreed to anything", async (t) => {
  withChrome(t);
  assert.equal(await readConsent(), null);
});

test("agreement is stored with the version and the moment it was given", async (t) => {
  const fake = withChrome(t);
  const at = Date.UTC(2026, 10, 12, 9, 30);

  const record = await acceptTerms(at);
  assert.deepEqual(record, { version: TERMS_VERSION, at });
  assert.deepEqual(await readConsent(), record);
  assert.deepEqual(fake.store.terms, record);
});

test("only an exact, versioned acceptance counts as consent", async (t) => {
  const fake = withChrome(t);
  const now = Date.now();

  const notConsent = [
    true,
    "yes",
    {},
    { version: TERMS_VERSION },
    { at: now },
    { version: "0.9", at: now },
    { version: TERMS_VERSION, at: "12 November" },
    { version: TERMS_VERSION, at: 0 },
  ];

  for (const record of notConsent) {
    fake.store.terms = record;
    assert.equal(await readConsent(), null, JSON.stringify(record));
  }
});

test("a new version of the terms asks again", async (t) => {
  const fake = withChrome(t);
  await acceptTerms();
  assert.ok(await readConsent());

  fake.store.terms = { version: "0.0-older", at: Date.now() };
  assert.equal(await readConsent(), null, "an older acceptance is not agreement to this version");
});

test("withdrawing removes the record", async (t) => {
  const fake = withChrome(t);
  await acceptTerms();
  await withdrawConsent();
  assert.equal(fake.store.terms, undefined);
  assert.equal(await readConsent(), null);
});

test("the settings page can say what was agreed", async (t) => {
  withChrome(t);
  assert.match(consentLine(null), /Not accepted yet/);

  const at = Date.UTC(2026, 10, 12);
  const line = consentLine({ version: TERMS_VERSION, at });
  assert.match(line, /Accepted on this device on 2026-11-12/);
  assert.match(line, new RegExp(TERMS_VERSION.replace(/\./g, "\\.")));
});

test("the packaged terms match the version the gate checks, and the box starts empty", async () => {
  const html = await readFile(join(root, "terms.html"), "utf8");
  const panel = await readFile(join(root, "sidepanel.html"), "utf8");

  assert.match(html, new RegExp("Version " + TERMS_VERSION.replace(/\./g, "\\.")));
  assert.ok(html.includes("Last updated 12 November 2026"), "the date the module records");
  assert.equal(TERMS_UPDATED, "2026-11-12");
  // There is deliberately no shortened version: a summary that leaves a detail out is a
  // second account of the agreement someone could later rely on, so the numbered sections
  // are the only reading of the Terms and the contents list has to reach all of them.
  assert.equal(html.includes('id="summary"'), false, "no shortened version of the Terms ships");
  for (let n = 1; n <= 30; n += 1) {
    assert.ok(html.includes('<section id="s' + n + '"'), "section " + n + " is present");
    assert.ok(html.includes('href="#s' + n + '"'), "section " + n + " is in the contents list");
  }
  assert.equal((html.match(/<section id="s\d+"/g) || []).length, 30, "no extra numbered section");
  assert.match(panel, /<input id="terms-agree" type="checkbox" \/>/, "no checked attribute");
  assert.match(panel, /id="terms-accept" type="button" disabled/, "agreement needs the tick first");
  assert.match(panel, /href="terms.html"/, "the full document is one link away");
});
