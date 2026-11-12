// The card vault: what is refused before anything is stored, what the stored
// record actually contains, and what a wrong PIN can and cannot reach.
//
//   node --test extension/test/cards.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  addCard,
  cardBrand,
  createVault,
  forgetAll,
  groupNumber,
  listCards,
  lock,
  passesLuhn,
  pinProblem,
  removeCard,
  revealCard,
  unlock,
  validateCard,
  vaultStatus,
} from "../src/lib/cards.js";

// A fixed date, so "expired" means the same thing whenever the tests run.
const NOW = Date.UTC(2026, 10, 12);
const CARD = { number: "4242 4242 4242 4242", holder: "Ada Lovelace", expiry: "09/29" };
const PIN = "483920";

function area(store) {
  return {
    async get(key) {
      const names = key === null || typeof key === "undefined" ? Object.keys(store) : [].concat(key);
      const out = {};
      names.forEach((name) => {
        if (Object.prototype.hasOwnProperty.call(store, name)) out[name] = store[name];
      });
      return out;
    },
    async set(values) {
      Object.assign(store, values);
    },
    async remove(key) {
      [].concat(key).forEach((name) => delete store[name]);
    },
  };
}

// Storage only: chrome.storage.session is deliberately absent, which is also the
// case in a private window. The key then lives in this worker's memory only.
function withStore(store) {
  globalThis.chrome = { storage: { local: area(store) } };
  return store;
}

test("card numbers are checked before anything is stored", () => {
  assert.equal(passesLuhn("4242 4242 4242 4242"), true);
  assert.equal(passesLuhn("4242424242424241"), false, "one digit short of valid");
  assert.equal(passesLuhn("4242"), false, "too short to be a card");

  assert.equal(cardBrand("4242424242424242"), "visa");
  assert.equal(cardBrand("5555555555554444"), "mastercard");
  assert.equal(cardBrand("378282246310005"), "amex");
  assert.equal(cardBrand("6011111111111117"), "discover");
  assert.equal(cardBrand("9999"), "card");
  assert.equal(groupNumber("378282246310005"), "3782 822463 10005", "amex is grouped 4-6-5");
  assert.equal(groupNumber("4242424242424242"), "4242 4242 4242 4242");

  assert.equal(validateCard({ ...CARD, number: "4242424242424241" }, NOW).ok, false);
  assert.equal(validateCard({ ...CARD, holder: "A" }, NOW).ok, false);
  assert.equal(validateCard({ ...CARD, expiry: "13/29" }, NOW).ok, false);
  assert.equal(validateCard({ ...CARD, expiry: "09/25" }, NOW).error, "That card has expired.");
  // A card is good through the last day of the month it expires in.
  assert.equal(validateCard({ ...CARD, expiry: "11/26" }, NOW).ok, true);
  assert.equal(validateCard(CARD, NOW).ok, true);
});

test("a PIN has to be long enough and not one digit repeated", () => {
  assert.match(pinProblem("123"), /at least/);
  assert.match(pinProblem("111111"), /repeated/);
  assert.equal(pinProblem(PIN), "");
});

test("a saved card is sealed on disk and opens only with the PIN", async () => {
  const store = withStore({});
  await lock();

  const made = await createVault(PIN);
  assert.equal(made.ok, true);

  const added = await addCard(CARD, NOW);
  assert.equal(added.ok, true);
  assert.equal(added.card.last4, "4242");
  assert.equal(added.card.brandName, "Visa");

  // The whole record, as storage holds it: no number, in any spelling.
  const raw = JSON.stringify(store.cardVault);
  assert.ok(!raw.includes("4242424242424242"), "the number is not stored in the clear");
  assert.ok(!raw.includes("4242 4242 4242 4242"), "nor with its spaces");

  const listed = await listCards();
  assert.equal(listed.cards.length, 1);
  assert.equal(listed.cards[0].id, added.card.id);

  const revealed = await revealCard(added.card.id);
  assert.equal(revealed.ok, true);
  assert.equal(revealed.card.number, "4242424242424242");
  assert.equal(revealed.card.expYear, 2029);

  // Locking takes the key away; nothing opens until the PIN comes back.
  await lock();
  const status = await vaultStatus();
  assert.equal(status.configured, true);
  assert.equal(status.unlocked, false);
  assert.equal(status.count, 1);
  assert.equal((await listCards()).ok, false);
  assert.equal((await revealCard(added.card.id)).reason, "locked");
  assert.equal((await addCard(CARD, NOW)).reason, "locked");

  assert.equal((await unlock("000001")).reason, "wrong-pin");
  assert.equal((await unlock(PIN)).ok, true);
  assert.equal((await revealCard(added.card.id)).card.number, "4242424242424242");
});

test("a tampered record does not open", async () => {
  const store = withStore({});
  await forgetAll();
  await createVault(PIN);
  const added = await addCard(CARD, NOW);
  assert.equal(added.ok, true);

  // One flipped character in the sealed box is a different tag, and GCM says so.
  const box = store.cardVault.cards[0].box;
  box.ct = box.ct.slice(0, -2) + (box.ct.slice(-2) === "AA" ? "BB" : "AA");
  const revealed = await revealCard(added.card.id);
  assert.equal(revealed.ok, false);
  assert.equal(revealed.reason, "damaged");
});

test("the same card is not saved twice, and a removal frees the slot", async () => {
  withStore({});
  await forgetAll();
  await createVault(PIN);
  const first = await addCard(CARD, NOW);
  assert.equal(first.ok, true);

  const again = await addCard({ ...CARD, number: "4242424242424242", nickname: "Travel" }, NOW);
  assert.equal(again.reason, "duplicate");

  const removed = await removeCard(first.card.id);
  assert.equal(removed.ok, true);
  assert.equal(removed.count, 0);
  assert.equal((await removeCard(first.card.id)).reason, "missing");
});

test("too many wrong PINs pause unlocking, and forgetting clears the vault", async () => {
  withStore({});
  await forgetAll();
  await createVault(PIN);
  await lock();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reply = await unlock("918273");
    assert.equal(reply.ok, false);
    assert.notEqual(reply.reason, "bad-pin", "a six-digit PIN is checked, not refused up front");
  }
  // The sixth try is refused before the PIN is even stretched.
  const pause = await unlock(PIN);
  assert.equal(pause.ok, false);
  assert.match(pause.error, /Too many wrong PINs/);

  // Forgetting needs no PIN: a shopper locked out of their own vault must not be
  // left holding it, and nothing is recoverable either way.
  const cleared = await forgetAll();
  assert.equal(cleared.ok, true);
  const status = await vaultStatus();
  assert.equal(status.configured, false);
  assert.equal(status.count, 0);
});
