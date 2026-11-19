// A cleared 18+ check lets the wallet cash out any balance from three cents,
// whatever payout minimum Settings holds. Without a verdict the Settings
// minimum still applies. These tests drive the real service worker through the
// messages the panel sends.
//
//   node --test extension/test
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fake-chrome.mjs";
import { liveScan } from "./frames.mjs";
import { signUp } from "../src/lib/accounts.js";

const PERSON = {
  fullName: "Payout Tester",
  email: "payout.tester@example.com",
  phone: "+1 555 010 1234",
  dob: "1990-04-12",
  password: "testing12345",
};

function availableWallet(cents) {
  const at = Date.now();
  return {
    entries: [
      {
        id: "e_test",
        storeId: "target",
        storeName: "Target",
        rate: 5,
        total: 1000,
        base: cents,
        boost: 0,
        amount: cents,
        currency: "USD",
        status: "available",
        at,
        confirmAt: null,
      },
    ],
    payouts: [],
  };
}

async function setup(t, cents) {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  const signed = await signUp(PERSON);
  assert.equal(signed.ok, true, "signup should succeed");
  const reply = await fake.send({ type: "settings:set", settings: { payoutMinimum: 500 } });
  assert.equal(reply.ok, true);
  fake.store["acct:" + signed.account.id + ":cashback"] = availableWallet(cents);
  return fake;
}

test("an unverified account still needs the Settings minimum", async (t) => {
  const fake = await setup(t, 4);

  const wallet = await fake.send({ type: "cashback:wallet" });
  assert.equal(wallet.ageVerified, false);
  assert.equal(wallet.minimum, 500, "the $5.00 minimum applies before the check");
});

test("a verified account cashes out a four-cent balance", async (t) => {
  const fake = await setup(t, 4);

  const verified = await fake.send({ type: "age:local", stats: liveScan() });
  assert.equal(verified.ok, true, "a live face should verify");

  const wallet = await fake.send({ type: "cashback:wallet" });
  assert.equal(wallet.ageVerified, true);
  assert.equal(wallet.minimum, 3, "a verified account cashes out from three cents");

  const cashed = await fake.send({ type: "cashback:cashout" });
  assert.equal(cashed.ok, true);
  assert.equal(cashed.payout.amount, 4, "the whole four cents is paid out");
});
