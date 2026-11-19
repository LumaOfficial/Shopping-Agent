// The verified cash-out floor is three cents: a balance below it stays in the
// wallet even when the 18+ check has cleared. Its own file so the worker's
// one-payout-at-a-time guard is fresh.
//
//   node --test extension/test
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fake-chrome.mjs";
import { liveScan } from "./frames.mjs";
import { signUp } from "../src/lib/accounts.js";

const PERSON = {
  fullName: "Floor Tester",
  email: "floor.tester@example.com",
  phone: "+1 555 010 5678",
  dob: "1990-04-12",
  password: "testing12345",
};

test("a verified account still cannot cash out less than three cents", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  const signed = await signUp(PERSON);
  assert.equal(signed.ok, true, "signup should succeed");
  await fake.send({ type: "settings:set", settings: { payoutMinimum: 500 } });

  const at = Date.now();
  fake.store["acct:" + signed.account.id + ":cashback"] = {
    entries: [
      {
        id: "e_test",
        storeId: "target",
        storeName: "Target",
        rate: 5,
        total: 1000,
        base: 2,
        boost: 0,
        amount: 2,
        currency: "USD",
        status: "available",
        at,
        confirmAt: null,
      },
    ],
    payouts: [],
  };

  await fake.send({ type: "age:local", stats: liveScan() });
  const refused = await fake.send({ type: "cashback:cashout" });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "below-minimum");
});
