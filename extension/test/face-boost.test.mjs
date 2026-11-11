// The face check decides money: a verdict stored against the account is what
// unlocks the 3% boost on new earnings. These tests drive the real service
// worker through the messages the panel sends, and the real on-device detector
// through frames drawn in memory — no browser, no camera.
//
//   node --test extension/test
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fake-chrome.mjs";
import { liveScan, noFaceScan, stillPhotoScan } from "./frames.mjs";
import { signIn, signOut, signUp } from "../src/lib/accounts.js";
import { BOOST_RATE } from "../src/lib/age-verify.js";

const FEED = "https://feed.test/offers/{store}";
const TRACK = "https://go.test/click?u={url}";
const RELAY = "https://relay.test/verify";

const PERSON = {
  fullName: "Scan Tester",
  email: "scan.tester@example.com",
  phone: "+1 555 010 9999",
  dob: "1990-04-12",
  password: "testing12345",
};

// A feed that publishes a 5% rate for every store, and a relay that estimates
// 24 when asked — the two ways a verdict can arrive.
function stubNetwork(t, routes) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    const body = (routes && routes[href]) || {
      cashback: { rate: "5%", trackingUrl: "https://go.test/track" },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  t.after(() => {
    globalThis.fetch = original;
  });
}

async function setup(t, settings, routes) {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  stubNetwork(t, routes);
  const signed = await signUp(PERSON);
  assert.equal(signed.ok, true, "signup should succeed");
  const reply = await fake.send({
    type: "settings:set",
    settings: Object.assign({ feedUrl: FEED, cashbackTemplate: TRACK }, settings || {}),
  });
  assert.equal(reply.ok, true);
  return { fake, account: signed.account };
}

const firstEntry = (wallet) => wallet.entries[0];

test("an account that has not been face-checked earns the plain rate", async (t) => {
  const { fake } = await setup(t);

  const status = await fake.send({ type: "age:status" });
  assert.equal(status.state, "none");

  const activated = await fake.send({ type: "cashback:activate", url: "https://www.target.com/cart", total: 10000 });
  assert.equal(activated.ok, true);
  assert.equal(activated.tracked, true);
  const entry = firstEntry(activated.wallet);
  assert.equal(entry.base, 500, "$100 at 5% is $5.00");
  assert.equal(entry.boost, 0, "no boost without a verdict");
  assert.equal(entry.amount, 500);
  assert.equal(activated.wallet.ageVerified, false);
});

test("an on-device face scan unlocks the boost on the next earning only", async (t) => {
  const { fake } = await setup(t);

  // Before the check: a full-price earning.
  const before = await fake.send({ type: "cashback:activate", url: "https://www.target.com/cart", total: 10000 });
  assert.equal(firstEntry(before.wallet).boost, 0);

  // The scan itself, measured from two frames of a person in front of the camera.
  const verified = await fake.send({ type: "age:local", stats: liveScan() });
  assert.equal(verified.ok, true, "a live face should verify");
  assert.equal(verified.state, "verified");
  assert.equal(verified.provider, "On-device check");
  assert.equal((await fake.send({ type: "age:status" })).state, "verified");

  // After the check: the same cart earns the boost.
  const after = await fake.send({ type: "cashback:activate", url: "https://www.bestbuy.com/cart", total: 10000 });
  const boosted = firstEntry(after.wallet);
  assert.equal(boosted.base, 500);
  assert.equal(boosted.boost, 15, "3% of 500 is 15 cents");
  assert.equal(boosted.amount, 515);
  assert.equal(after.wallet.ageVerified, true);
  assert.equal(after.wallet.boost, BOOST_RATE);

  // The earning recorded before the check keeps its original figure.
  const earlier = after.wallet.entries.find((entry) => entry.storeName === "Target");
  assert.equal(earlier.boost, 0);
  assert.equal(earlier.amount, 500);
});

test("the boost is a percentage of the base and stays in whole cents", async (t) => {
  const { fake } = await setup(t);

  await fake.send({ type: "age:local", stats: liveScan() });
  const activated = await fake.send({ type: "cashback:activate", url: "https://www.walmart.com/cart", total: 1234 });
  const entry = firstEntry(activated.wallet);
  assert.equal(entry.base, 62, "$12.34 at 5% is 61.7 cents, rounded to 62");
  assert.equal(entry.boost, 2, "3% of 62 is 1.86, rounded to 2");
  assert.equal(entry.amount, 64);
});

test("a relay verdict carries the same boost", async (t) => {
  const { fake } = await setup(t, { ageCheckUrl: RELAY }, {
    [RELAY]: { verdict: "over", estimate: 24, provider: "Relay Check", reference: "ref_1" },
  });

  const verified = await fake.send({ type: "age:verify", image: "data:image/jpeg;base64,AAAA" });
  assert.equal(verified.ok, true);
  assert.equal(verified.state, "verified");

  const activated = await fake.send({ type: "cashback:activate", url: "https://www.target.com/cart", total: 10000 });
  assert.equal(firstEntry(activated.wallet).boost, 15);
});

test("a frame with no face is refused and the next earning is unboosted", async (t) => {
  const { fake } = await setup(t);

  const refused = await fake.send({ type: "age:local", stats: noFaceScan() });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /no face/i, "the refusal names the reason");
  assert.equal((await fake.send({ type: "age:status" })).state, "none");

  const activated = await fake.send({ type: "cashback:activate", url: "https://www.target.com/cart", total: 10000 });
  assert.equal(firstEntry(activated.wallet).boost, 0);
});

test("a still photo is refused and the next earning is unboosted", async (t) => {
  const { fake } = await setup(t);

  const refused = await fake.send({ type: "age:local", stats: stillPhotoScan() });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /still picture/i);
  assert.equal((await fake.send({ type: "age:status" })).state, "none");

  const activated = await fake.send({ type: "cashback:activate", url: "https://www.target.com/cart", total: 10000 });
  assert.equal(firstEntry(activated.wallet).boost, 0);
});

test("the boost belongs to the account that was checked, not the browser", async (t) => {
  const { fake, account } = await setup(t);

  await fake.send({ type: "age:local", stats: liveScan() });
  const mine = await fake.send({ type: "cashback:activate", url: "https://www.target.com/cart", total: 10000 });
  assert.equal(firstEntry(mine.wallet).boost, 15);

  await signOut();
  const other = await signUp(Object.assign({}, PERSON, { email: "someone.else@example.com" }));
  assert.equal(other.ok, true);

  const theirStatus = await fake.send({ type: "age:status" });
  assert.equal(theirStatus.state, "none", "the second account starts unverified");

  const theirs = await fake.send({ type: "cashback:activate", url: "https://www.bestbuy.com/cart", total: 10000 });
  assert.equal(firstEntry(theirs.wallet).boost, 0, "nobody else's check boosts this account");

  // The verified account still holds its own verdict and its own boosted earning.
  const back = await signIn(PERSON.email, PERSON.password);
  assert.equal(back.ok, true);
  const wallet = await fake.send({ type: "cashback:wallet" });
  assert.equal(wallet.ageVerified, true);
  assert.equal(firstEntry(wallet).boost, 15);
  assert.equal(firstEntry(wallet).storeName, "Target");
  assert.ok(fake.store["acct:" + account.id + ":cashback"], "the earning is stored under the verified account");
});
