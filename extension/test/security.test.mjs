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
import { currentAccount, signIn, signUp } from "../src/lib/accounts.js";
import { MAX_ADS_PER_DAY, MAX_ADS_PER_TAB, MAX_UNITS_PER_SLOT, unitsOfSlot } from "../src/lib/ad-value.js";
import { TERMS_VERSION } from "../src/lib/terms.js";
import { normalizeOffer as normalizeSponsorOffer } from "../src/partners/sponsor-offers.js";

// Every test here drives a profile that has opened the panel and agreed to the
// terms, because nothing — including ad value — is credited before that.
const AGREED = { terms: { version: TERMS_VERSION, at: Date.UTC(2026, 10, 12) } };

const PERSON = {
  fullName: "Guard Tester",
  email: "guard.tester@example.com",
  phone: "+1 555 010 1234",
  dob: "1991-06-01",
  password: "guardpass123",
};

// What a content script now sends: one entry per slot it hid, with the shape it
// had on screen. A standard rectangle is worth one unit at the base rate.
function slots(count, shape) {
  return Array.from({ length: count }, () => Object.assign({ width: 300, height: 250 }, shape));
}

async function boot(t, seed) {
  const fake = await loadWorker(Object.assign({}, AGREED, seed));
  t.after(() => {
    delete globalThis.chrome;
  });
  return fake;
}

test("nothing is credited before the terms are agreed", async (t) => {
  const fake = await boot(t, { terms: undefined });
  const page = { id: fake.chrome.runtime.id, tab: { id: 21 }, url: "https://shop.test/" };

  const reply = await fake.send({ type: "ads:report", slots: slots(4) }, page);
  assert.equal(reply.error, "refused");
  assert.equal(fake.store.ads, undefined, "nothing was credited");
});

test("a sponsored offer only ever opens a real web address", () => {
  assert.equal(normalizeSponsorOffer({ id: "a", url: "javascript:alert(1)", reward: 50 }), null);
  assert.equal(normalizeSponsorOffer({ id: "b", url: "http:not-an-address", reward: 50 }), null);
  assert.equal(normalizeSponsorOffer({ id: "c", url: "", reward: 50 }), null);
  const fine = normalizeSponsorOffer({ id: "d", url: "https://ads.example.com/offer", reward: 50 });
  assert.equal(fine.url, "https://ads.example.com/offer");
});

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

  const reported = await fake.send({ type: "ads:report", slots: slots(4) }, page);
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

  const huge = await fake.send({ type: "ads:report", slots: slots(100000) }, page);
  assert.match(String(huge.error), /more slots/i);

  const junk = await fake.send({ type: "ads:report", slots: ["nope", 12, null, {}] }, page);
  assert.equal(junk.error, undefined, "a slot with no shape is still a slot");
  assert.equal(junk.total, 1, "only the one object counted");

  const none = await fake.send({ type: "ads:report", slots: ["nope", 12, null] }, page);
  assert.match(String(none.error), /no slots/i);

  const fine = await fake.send({ type: "ads:report", slots: slots(5) }, page);
  assert.equal(fine.total, 6, "five more slots on top of the one");
  assert.equal(fine.value, 3, "six slots at the default rate still read a few cents");
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

test("a content script message with no tab is refused", async (t) => {
  const fake = await boot(t);
  const claimed = { id: fake.chrome.runtime.id, url: "https://shop.test/" };
  const reply = await fake.send({ type: "ads:report", slots: slots(5) }, claimed);
  assert.equal(reply.error, "refused");
  assert.equal(fake.store.ads, undefined, "nothing was credited");
});

test("a page cannot mint ad value past the ceilings", async (t) => {
  const fake = await boot(t);
  const first = { id: fake.chrome.runtime.id, tab: { id: 7 }, url: "https://shop.test/" };
  const page = (id) => ({ id: fake.chrome.runtime.id, tab: { id }, url: "https://shop.test/" });

  let reply = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    reply = await fake.send({ type: "ads:report", slots: slots(200) }, first);
  }
  assert.equal(reply.total, MAX_ADS_PER_TAB, "one tab is capped for the session");

  // Four more tabs, each still asking for more than it may add.
  for (let tab = 8; tab < 12; tab += 1) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      reply = await fake.send({ type: "ads:report", slots: slots(200) }, page(tab));
    }
  }
  assert.equal(reply.total, MAX_ADS_PER_DAY, "the day stops at its ceiling");

  // A new day starts again: the ceiling is per day, not for ever.
  const key = Object.keys(fake.store).find((name) => /adBlock$/.test(name));
  assert.equal(typeof key, "string");
  fake.store[key] = Object.assign({}, fake.store[key], { day: "1999-1-1", dayCount: 9000 });
  reply = await fake.send({ type: "ads:report", slots: slots(50) }, page(99));
  assert.equal(reply.today, 50);
  assert.equal(reply.total, MAX_ADS_PER_DAY + 50);
});

test("one slot cannot claim to be worth more than the ceiling", async (t) => {
  const fake = await boot(t);
  const page = { id: fake.chrome.runtime.id, tab: { id: 41 }, url: "https://shop.test/" };

  // A slot that says it is a full-screen, hour-long video is worth the ceiling
  // and no more, whatever the page claims.
  const claimed = await fake.send(
    { type: "ads:report", slots: slots(5, { width: 5000, height: 5000, video: true, seconds: 3600 }) },
    page
  );
  assert.equal(claimed.total, 5);
  // The largest and longest slot the formula can produce is two units, well under
  // the ceiling, so five of them are worth 6 cents at the default pack rate.
  assert.ok(unitsOfSlot({ width: 5000, height: 5000, video: true, seconds: 3600 }) <= MAX_UNITS_PER_SLOT);
  assert.equal(claimed.value, 6);
});

test("the ad rate is the operator's, and the default is three cents per five", async (t) => {
  const fake = await boot(t);
  const page = { id: fake.chrome.runtime.id, tab: { id: 51 }, url: "https://shop.test/" };
  const settingsPage = { id: fake.chrome.runtime.id, url: fake.chrome.runtime.getURL("options.html") };

  const reported = await fake.send({ type: "ads:report", slots: slots(5) }, page);
  assert.equal(reported.value, 3, "five plain slots are worth the default pack");
  assert.match(reported.rateLabel, /\$0\.03 per 5 ads/);

  const raised = await fake.send({ type: "settings:set", settings: { adRateCents: 25 } }, settingsPage);
  assert.equal(raised.settings.adRateCents, 25);
  const stats = await fake.send({ type: "ads:stats" }, settingsPage);
  assert.equal(stats.value, 25, "the same five slots follow the rate that is set");

  const impossible = await fake.send({ type: "settings:set", settings: { adRateCents: 100000 } }, settingsPage);
  assert.equal(impossible.settings.adRateCents, 3, "an impossible rate falls back to the default");
});

test("the panel is handed settings without credentials", async (t) => {
  const fake = await boot(t);
  fake.store.settings = {
    ageCheckUrl: "https://age.test/verify",
    ageCheckToken: "relay-token",
    feedUrl: "https://feed.test/offers/{store}",
    feedKey: "feed-secret",
  };

  const panel = await fake.send({ type: "settings:get" });
  assert.equal(panel.ageCheckToken, "");
  assert.equal(panel.feedKey, "");
  assert.equal(panel.ageCheckUrl, "https://age.test/verify", "the address is not a credential");

  const settingsPage = { id: fake.chrome.runtime.id, url: fake.chrome.runtime.getURL("options.html") };
  const full = await fake.send({ type: "settings:get" }, settingsPage);
  assert.equal(full.feedKey, "feed-secret");
  assert.equal(full.ageCheckToken, "relay-token");
});

test("Firefox's moz-extension:// pages are the extension's own", async (t) => {
  const fake = await boot(t);
  fake.store.settings = {
    ageCheckUrl: "https://age.test/verify",
    ageCheckToken: "relay-token",
    feedUrl: "https://feed.test/offers/{store}",
    feedKey: "feed-secret",
  };

  // Firefox serves the extension from moz-extension://<uuid>/, so the page test
  // cannot be keyed on Chromium's scheme or the settings page reads nothing back.
  const id = fake.chrome.runtime.id;
  fake.chrome.runtime.getURL = (path) => "moz-extension://4f1a9c7e-0f2b/" + path;

  const panel = await fake.send({ type: "settings:get" });
  assert.equal(panel.feedKey, "", "the panel still sees only public settings");

  const settingsPage = { id, url: "moz-extension://4f1a9c7e-0f2b/options.html" };
  const full = await fake.send({ type: "settings:get" }, settingsPage);
  assert.equal(full.feedKey, "feed-secret");
  assert.equal(full.ageCheckToken, "relay-token");

  const someoneElse = { id, url: "moz-extension://another-addon/page.html" };
  const refused = await fake.send({ type: "settings:get" }, someoneElse);
  assert.equal(refused.feedKey, "", "a different moz-extension origin is not ours");
});

test("a session that has aged out signs nobody in", async (t) => {
  const fake = await boot(t);
  const day = 24 * 60 * 60 * 1000;
  await signUp(Object.assign({}, PERSON, { email: "aged@example.com" }));
  assert.equal(Boolean(await currentAccount()), true);

  fake.store.session = Object.assign({}, fake.store.session, {
    at: Date.now() - 8 * day,
    startedAt: Date.now() - 8 * day,
  });
  assert.equal(await currentAccount(), null, "unused for a week");
  assert.equal(fake.store.session, undefined, "and the stale session is removed");

  await signIn("aged@example.com", PERSON.password);
  fake.store.session = Object.assign({}, fake.store.session, {
    at: Date.now(),
    startedAt: Date.now() - 31 * day,
  });
  assert.equal(await currentAccount(), null, "older than the month a session may live");
});

test("an obvious password is refused before it is hashed", async (t) => {
  const fake = await boot(t);
  for (const password of ["password", "11111111", "qwertyui", "1234567890"]) {
    const reply = await signUp(Object.assign({}, PERSON, { email: "weak@example.com", password }));
    assert.equal(reply.ok, false, password);
    assert.match(reply.error, /predictable/);
  }
  assert.equal(fake.store.accounts, undefined, "nothing was stored");
});

test("the on-device age check cannot stand in for a configured relay", async (t) => {
  const fake = await boot(t);
  fake.store.settings = { ageCheckUrl: "https://age.test/verify" };
  const reply = await fake.send({
    type: "age:local",
    stats: { brightness: 120, faceFound: true, faceShare: 0.4, aspect: 1, fill: 0.9, contrast: 40 },
  });
  assert.equal(reply.ok, false);
  assert.match(String(reply.error), /configured/i);
  assert.equal(fake.store.ageCheck, undefined, "no verdict was written");
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
