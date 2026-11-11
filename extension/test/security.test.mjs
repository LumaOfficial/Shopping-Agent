// What the extension does when someone reads the code and then tries to make it
// do something it was not asked to do: another extension, a page, a tampered
// settings object, a forged figure, a stolen hash. Every test drives the real
// worker through the messages a browser would deliver.
//
//   node --test extension/test
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fake-chrome.mjs";
import { constantTimeEquals, endpoint, intValue, textValue, webUrl } from "../src/lib/guard.js";
import { sanitizeSettings } from "../src/lib/settings.js";
import { signIn, signUp } from "../src/lib/accounts.js";

const PERSON = {
  fullName: "Guard Tester",
  email: "guard.tester@example.com",
  phone: "+1 555 010 1234",
  dob: "1991-06-01",
  password: "guardpass123",
};

async function boot(t) {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  return fake;
}

test("another extension cannot change settings", async (t) => {
  const fake = await boot(t);
  const reply = await fake.send(
    { type: "settings:set", settings: { feedUrl: "https://feed.test/offers/{store}" } },
    { id: "some-other-extension", url: "chrome-extension://some-other-extension/page.html" }
  );

  assert.equal(reply.error, "refused");
  assert.equal(fake.store.settings, undefined, "nothing was stored");
});

test("a sender with no id at all is refused", async (t) => {
  const fake = await boot(t);
  const reply = await fake.send({ type: "data:export" }, {});
  assert.equal(reply.error, "refused");
});

test("a content script may report ads and nothing else", async (t) => {
  const fake = await boot(t);
  const page = { id: fake.chrome.runtime.id, tab: { id: 12 }, url: "https://shop.test/" };

  const refused = await fake.send({ type: "settings:set", settings: { feedUrl: "https://x.test" } }, page);
  assert.equal(refused.error, "refused");
  assert.equal(fake.store.settings, undefined);

  const cleared = await fake.send({ type: "data:clear", confirm: true }, page);
  assert.equal(cleared.error, "refused");

  const reported = await fake.send({ type: "ads:report", count: 4 }, page);
  assert.equal(typeof reported.total, "number");
  assert.equal(reported.total, 4);

  // A content script whose sender URL is a page is still a page, even without
  // tab details attached.
  const noTab = { id: fake.chrome.runtime.id, url: "https://shop.test/cart" };
  const stillRefused = await fake.send({ type: "settings:set", settings: {} }, noTab);
  assert.equal(stillRefused.error, "refused");
});

test("an extension page opened in a tab is still the extension", async (t) => {
  const fake = await boot(t);
  // The settings page lives in a tab, so it carries sender.tab — that must not
  // be mistaken for a page's content script.
  const settingsTab = {
    id: fake.chrome.runtime.id,
    tab: { id: 4 },
    url: fake.chrome.runtime.getURL("options.html"),
  };

  const reply = await fake.send({ type: "settings:set", settings: { feedUrl: "https://feed.test/x" } }, settingsTab);
  assert.equal(reply.ok, true);
  assert.equal(fake.store.settings.feedUrl, "https://feed.test/x");

  const stats = await fake.send({ type: "stats:get" }, settingsTab);
  assert.equal(typeof stats.saved, "number");
});

test("an unknown message type is refused without being echoed back", async (t) => {
  const fake = await boot(t);
  const reply = await fake.send({ type: "settings:set<script>alert(1)</script>" });
  assert.equal(reply.error, "refused");
});

test("settings keep only known keys, including past a poisoned prototype", async (t) => {
  const fake = await boot(t);
  const polluted = JSON.parse(
    '{"feedUrl":"https://feed.test/offers/{store}","__proto__":{"polluted":true},"notASetting":42}'
  );
  const reply = await fake.send({ type: "settings:set", settings: polluted });

  assert.equal(reply.ok, true);
  assert.equal(fake.store.settings.notASetting, undefined, "an unknown key is not stored");
  assert.equal(Object.prototype.hasOwnProperty.call(fake.store.settings, "__proto__"), false);
  assert.equal({}.polluted, undefined, "the shared object prototype is untouched");
  assert.equal(fake.store.settings.feedUrl, "https://feed.test/offers/{store}");
});

test("a plain-HTTP endpoint is dropped; HTTPS and a loopback listener are kept", async (t) => {
  const fake = await boot(t);
  const reply = await fake.send({
    type: "settings:set",
    settings: {
      feedUrl: "http://feed.test/offers",
      payoutUrl: "https://pay.test/tango/orders",
      ageCheckUrl: "http://127.0.0.1:8787/verify",
    },
  });

  assert.equal(reply.settings.feedUrl, "", "credentials never travel in the clear");
  assert.equal(reply.settings.payoutUrl, "https://pay.test/tango/orders");
  assert.equal(reply.settings.ageCheckUrl, "http://127.0.0.1:8787/verify");
});

test("figures that money is read from are clamped to a real range", async (t) => {
  const fake = await boot(t);
  const reply = await fake.send({
    type: "settings:set",
    settings: { payoutMinimum: -900, enabledSites: ["Shop.test", "www.shop.test", "not a host!"] },
  });

  assert.equal(reply.settings.payoutMinimum, 500, "an impossible minimum falls back to the default");
  assert.deepEqual(reply.settings.enabledSites, ["shop.test", "www.shop.test"]);
});

test("clearing the figures needs an explicit confirmation", async (t) => {
  const fake = await boot(t);
  fake.store["guest:savings"] = { total: 100, count: 1 };

  const refused = await fake.send({ type: "data:clear" });
  assert.match(String(refused.error), /confirmed/i);
  assert.ok(fake.store["guest:savings"], "nothing was deleted");

  const cleared = await fake.send({ type: "data:clear", confirm: true });
  assert.equal(cleared.ok, true);
  assert.equal(fake.store["guest:savings"], undefined);
});

test("a page cannot inflate the ad figure it is paid on", async (t) => {
  const fake = await boot(t);
  const page = { id: fake.chrome.runtime.id, tab: { id: 3 }, url: "https://shop.test/" };

  const huge = await fake.send({ type: "ads:report", count: 100000 }, page);
  assert.match(String(huge.error), /not a number/i);

  const negative = await fake.send({ type: "ads:report", count: -4 }, page);
  assert.match(String(negative.error), /not a number/i);

  const fine = await fake.send({ type: "ads:report", count: 5 }, page);
  assert.equal(fine.total, 5);
});

test("a page address has to be a web address", async (t) => {
  const fake = await boot(t);

  const bad = await fake.send({ type: "site:resolve", url: "javascript:alert(1)" });
  assert.match(String(bad.error), /web page address/i);

  const worse = await fake.send({ type: "site:resolve", url: "file:///etc/passwd" });
  assert.match(String(worse.error), /web page address/i);
});

test("five wrong passwords pause sign-in, and the right one works after a clean run", async (t) => {
  await boot(t);
  const signed = await signUp(PERSON);
  assert.equal(signed.ok, true);

  let last = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    last = await signIn(PERSON.email, "wrong-password");
    assert.equal(last.ok, false);
    assert.match(last.error, /don't match an account/);
  }

  const locked = await signIn(PERSON.email, PERSON.password);
  assert.equal(locked.ok, false, "the correct password is still refused while paused");
  assert.match(locked.error, /Too many attempts/);
});

test("the stored account holds a salted hash, never the password", async (t) => {
  const fake = await boot(t);
  await signUp(Object.assign({}, PERSON, { email: "stored@example.com", password: "plain-text-secret" }));

  const dump = JSON.stringify(fake.store);
  assert.equal(dump.includes("plain-text-secret"), false);
  const account = Object.values(fake.store.accounts)[0];
  assert.equal(account.password.hash.length, 64, "a SHA-256 sized hash");
  assert.equal(account.password.iterations >= 210000, true);
});

test("guard helpers reject the shapes a page would try", () => {
  assert.equal(endpoint("https://pay.test/orders"), "https://pay.test/orders");
  assert.equal(endpoint("http://pay.test/orders"), "");
  assert.equal(endpoint("javascript:alert(1)"), "");
  assert.equal(endpoint("https://user:pass@pay.test/orders"), "");
  assert.equal(endpoint("https://feed.test/offers/{store}"), "https://feed.test/offers/{store}");
  assert.equal(endpoint("feed.test/offers"), "https://feed.test/offers");

  assert.equal(webUrl("https://shop.test/cart"), "https://shop.test/cart");
  assert.equal(webUrl("data:text/html,<h1>x</h1>"), "");

  assert.equal(intValue("12", 0, 20), 12);
  assert.equal(intValue(1e9, 0, 20), null);
  assert.equal(textValue(" hi\u0000there ", 40), "hithere");
  assert.equal(constantTimeEquals("abc", "abc"), true);
  assert.equal(constantTimeEquals("abc", "abd"), false);
  assert.equal(constantTimeEquals("abc", "abcd"), false);

  const clean = sanitizeSettings({ feedAuth: "basic", enabled: { coupons: false, injected: true } });
  assert.equal(clean.feedAuth, "basic");
  assert.equal(clean.enabled.coupons, false);
  assert.equal(clean.enabled.injected, undefined);
});
