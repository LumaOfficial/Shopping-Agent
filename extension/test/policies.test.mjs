// The store-facing paperwork and the gate it describes. Opera reads the package
// as the disclosure: the terms, the privacy page and the support page ship with
// it, they must name the same version as the gate the panel checks, and the
// background work they describe as gated must actually wait for agreement.
//
//   node --test extension/test/policies.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { acceptTerms, readConsent, TERMS_UPDATED, TERMS_VERSION } from "../src/lib/terms.js";
import { loadWorker } from "./fake-chrome.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const read = (file) => readFile(join(root, file), "utf8");
const escape = (text) => text.replace(/\./g, "\\.");

const panel = await read("sidepanel.html");
const options = await read("options.html");
const terms = await read("terms.html");
const privacy = await read("privacy.html");
const support = await read("support.html");
const adGuard = await read("src/content/ad-guard.js");
const consent = await read("src/content/consent.js");

test("the privacy and support pages ship and are one link away from the panel", () => {
  // Opera: the disclosure has to be reachable from the product, and a support
  // page has to be relevant to the extension. Both are pages inside the package,
  // so they open with no network call at all.
  assert.match(panel, /href="privacy\.html"/, "the gate card links the privacy page");
  assert.match(panel, /href="terms\.html"/, "the gate card links the terms");
  assert.match(options, /href="privacy\.html"/);
  assert.match(options, /href="support\.html"/);
  assert.match(options, /href="terms\.html"/);
  assert.match(terms, /href="privacy\.html"/);
  assert.match(privacy, /href="terms\.html"/);
  assert.match(support, /href="privacy\.html"/);
});

test("the privacy page names the same version and date as the gate", () => {
  // A policy that lags the terms is the finding a reviewer files as a misleading
  // disclosure, so the two are asserted against the one constant.
  assert.match(privacy, new RegExp("Version " + escape(TERMS_VERSION)));
  assert.ok(privacy.includes("Last updated 12 November 2026"), "the date the terms record");
  assert.equal(TERMS_UPDATED, "2026-11-12");
  assert.match(privacy, new RegExp("currently\\s+" + escape(TERMS_VERSION)), "the accepted version");

  // The facts that make the policy specific rather than boilerplate.
  assert.match(privacy, /never reads or sends your password fields, card numbers/i);
  assert.match(privacy, /no analytics, telemetry, fingerprinting/i);
  assert.match(privacy, /salted PBKDF2-SHA-256 hash/);
  assert.match(privacy, /With no relay configured/);
});

test("the support page is about this extension, not a link farm", () => {
  assert.match(support, /<h1>Support<\/h1>/);
  assert.match(support, /Opening the panel/);
  assert.match(support, /When something does nothing/);
  // Opera: promotional links must be few and useful. The pages it links are the
  // documents that ship beside it.
  const external = support.match(/href="https?:/g) || [];
  assert.deepEqual(external, [], "the support page loads nothing from outside the package");
});

test("the page-script gate reads the same version as the panel", () => {
  // The version lives in two places because a content script is a classic script;
  // this is the assertion that keeps them from drifting.
  const literal = (consent.match(/TERMS_VERSION = "([^"]+)"/) || [])[1];
  assert.equal(literal, TERMS_VERSION);
  assert.match(consent, /typeof record\.at === "number"/, "a timestamp is required");
});

test("nothing is blocked, hidden or credited before the terms are agreed", async () => {
  const manifest = JSON.parse(await read("manifest.json"));

  // The static ruleset starts disabled; the worker turns it on only for a
  // profile that has agreed and left ad blocking on.
  assert.equal(manifest.declarative_net_request.rule_resources[0].enabled, false);
  const worker = await read("src/background/service-worker.js");
  assert.match(worker, /readConsent/, "the worker reads the gate");
  assert.match(worker, /disableRulesetIds: \["ads"\]/, "it can turn the ruleset off again");

  // The ad-slot script asks the gate file before it touches a page, and the gate
  // file runs before it.
  assert.match(adGuard, /SavingsConsent/, "the slot script waits for the gate");
  const scripts = manifest.content_scripts[0].js;
  assert.ok(
    scripts.indexOf("src/content/consent.js") < scripts.indexOf("src/content/ad-guard.js"),
    "the gate file loads before the script that asks it"
  );
});

// The worker turns the ruleset on and off as the gate moves; these drive the
// real worker and read the calls it made.
async function until(fake, count) {
  for (let attempt = 0; attempt < 100 && fake.rulesets.length < count; attempt += 1) {
    await new Promise((done) => setTimeout(done, 10));
  }
  return fake.rulesets.slice();
}

test("the blocking ruleset follows the gate and the switch", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });

  const opening = await until(fake, 1);
  assert.deepEqual(opening[0], { disableRulesetIds: ["ads"] }, "off before any agreement");

  // Agreeing is a deliberate tap: it writes the record, and the ruleset follows.
  await acceptTerms();
  const agreed = await until(fake, 2);
  assert.deepEqual(agreed[agreed.length - 1], { enableRulesetIds: ["ads"] });

  // Turning ad blocking off puts it back, without withdrawing agreement.
  await fake.send({ type: "settings:set", settings: { enabled: { adBlock: false } } });
  const switchedOff = await until(fake, 3);
  assert.deepEqual(switchedOff[switchedOff.length - 1], { disableRulesetIds: ["ads"] });
});

test("an agreed profile with ad blocking off starts unblocked", async (t) => {
  const fake = await loadWorker({
    terms: { version: TERMS_VERSION, at: Date.UTC(2026, 10, 12) },
    settings: { enabled: { adBlock: false } },
  });
  t.after(() => {
    delete globalThis.chrome;
  });

  const calls = await until(fake, 1);
  assert.deepEqual(calls[0], { disableRulesetIds: ["ads"] });
});

test("a fresh profile reads back no consent", async (t) => {
  const store = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return key in store ? { [key]: store[key] } : {};
        },
      },
    },
  };
  t.after(() => {
    delete globalThis.chrome;
  });

  assert.equal(await readConsent(), null);
  store.terms = { version: "1.0", at: 1 };
  assert.equal(await readConsent(), null, "an old version is not agreement");
});

test("every packaged page closes the markup it opens", async () => {
  // The terms page shipped an extra </article> that a browser hid and a reviewer
  // would read as a sloppy package. Counting is enough to catch it.
  for (const page of ["terms.html", "privacy.html", "support.html", "sidepanel.html", "options.html"]) {
    const html = await read(page);
    for (const tag of ["article", "section", "div"]) {
      const open = (html.match(new RegExp("<" + tag + "[\\s>]", "g")) || []).length;
      const close = (html.match(new RegExp("</" + tag + ">", "g")) || []).length;
      assert.equal(open, close, `${page}: <${tag}> opens ${open} and closes ${close}`);
    }
  }
});
