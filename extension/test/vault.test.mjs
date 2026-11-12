// What a wiped, reset or replaced device gets back — and what nobody else can
// open. Every test drives the shipped modules: the real WebCrypto, the real
// worker behind the stubbed chrome API, and the same calls the settings page
// makes.
//
//   node --test extension/test/vault.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fake-chrome.mjs";
import {
  ITERATIONS,
  groupRecoveryKey,
  looksLikeCode,
  newRecoveryKey,
  normalizeRecoveryKey,
  open,
  recoveryKeyLooksValid,
  seal,
} from "../src/lib/vault.js";
import {
  applyProfile,
  collectProfile,
  createVault,
  openProfile,
  pushVault,
  readVault,
  sealProfile,
} from "../src/lib/backup.js";
import { TERMS_VERSION } from "../src/lib/terms.js";

const AGREED = { terms: { version: TERMS_VERSION, at: Date.UTC(2026, 10, 12) } };
// A cheap round count keeps the suite quick; the shape sealed and opened is the
// one the extension uses, and the default count is only a header value.
const FAST = { iterations: 2048 };

const PROFILE = {
  accounts: {
    acct_1: {
      id: "acct_1",
      fullName: "Guard Tester",
      email: "guard.tester@example.com",
      createdAt: 1,
      password: { salt: "aa", iterations: ITERATIONS, hash: "bb" },
    },
  },
  "acct:acct_1:cashback": { available: 4200, pending: 0, paid: 0, lifetime: 4200 },
  "acct:acct_1:saved": { target: [{ code: "SAVE10", at: 1 }] },
  settings: {
    catalogUrl: "https://offers.example.com/catalog.json",
    feedUser: "operator",
    feedKey: "feed-token",
    payoutKey: "payout-token",
    backupToken: "sync-token",
    enabledSites: ["amazon.com"],
  },
};

async function boot(t, seed) {
  const fake = await loadWorker(Object.assign({}, AGREED, seed));
  t.after(() => {
    delete globalThis.chrome;
  });
  return fake;
}

function b64url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function waitFor(check, budget) {
  const until = Date.now() + (budget || 4000);
  while (Date.now() < until) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timed out waiting for the sealed copy");
}

test("a sealed code opens with its own key and with nothing else", async () => {
  const key = newRecoveryKey();
  assert.equal(recoveryKeyLooksValid(key), true);
  assert.equal(groupRecoveryKey(key).split("-").length, 8);
  assert.equal(looksLikeCode("not a code"), false);

  const code = await seal({ hello: "world" }, key, FAST);
  assert.equal(looksLikeCode(code), true);
  assert.deepEqual(await open(code, key), { hello: "world" });

  // A different key of the same strength opens nothing at all.
  await assert.rejects(() => open(code, newRecoveryKey()), /does not open/);
});

test("a key read off paper still opens it", async () => {
  const key = newRecoveryKey();
  const code = await seal({ amount: 4200 }, key, FAST);
  const asWritten = normalizeRecoveryKey(key)
    .toLowerCase()
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/(.{4})/g, "$1 ");
  assert.equal(normalizeRecoveryKey(asWritten), normalizeRecoveryKey(key));
  assert.deepEqual(await open(code, asWritten), { amount: 4200 });
});

test("a damaged code, a wrong-shaped key and a hostile round count are refused", async () => {
  const key = newRecoveryKey();
  const code = await seal({ amount: 1 }, key, FAST);

  // One character of the ciphertext flipped: the tag no longer verifies, so it
  // reads as a wrong key rather than as a partial restore.
  const last = code.slice(-1) === "A" ? "B" : "A";
  const edited = code.slice(0, -1) + last;
  await assert.rejects(() => open(edited, key), /does not open|damaged|not a backup code/);

  await assert.rejects(() => seal({}, "SHORT-KEY", FAST), /right length/);
  await assert.rejects(() => seal({}, key, { iterations: 9000000 }), /rounds/);

  // A hand-made envelope claiming an hour of stretching is dropped before the
  // browser is asked to do it.
  const crafted =
    "LUMA1." +
    b64url(
      JSON.stringify({
        v: 1,
        kdf: "PBKDF2-SHA-256",
        iter: 5000000,
        cipher: "AES-256-GCM",
        salt: "AAAA",
        iv: "AAAA",
        ct: "AAAA",
      })
    );
  await assert.rejects(() => open(crafted, key), /damaged/);
});

test("a code from another product is not a profile", async () => {
  const key = newRecoveryKey();
  const code = await seal({ app: "something-else", v: 1, data: {} }, key, FAST);
  await assert.rejects(() => openProfile(code, key), /not a backup of this extension/);
});

test("the copy carries the account and the wallet, and leaves the machine's own keys and the credentials", async (t) => {
  await boot(t, Object.assign({ session: { accountId: "acct_1" }, signInGuard: { x: { tries: 3 } } }, PROFILE));
  const record = await createVault();
  const sealed = await sealProfile(record.recoveryKey, null, FAST);
  const payload = await openProfile(sealed.code, record.recoveryKey);

  assert.equal(payload.data.accounts.acct_1.email, "guard.tester@example.com");
  assert.equal(payload.data["acct:acct_1:cashback"].available, 4200);
  assert.equal(payload.data["acct:acct_1:saved"].target[0].code, "SAVE10");
  assert.equal(payload.data.terms.version, TERMS_VERSION);

  // A session belongs to the browser it was opened in, and a code that carried
  // its own recovery key would protect nothing.
  assert.equal(payload.data.session, undefined);
  assert.equal(payload.data.signInGuard, undefined);
  assert.equal(payload.data.vault, undefined);

  // Preferences travel; credentials do not, which is what the settings page and
  // the privacy policy both promise.
  assert.equal(payload.data.settings.catalogUrl, "https://offers.example.com/catalog.json");
  assert.equal(payload.data.settings.enabledSites[0], "amazon.com");
  assert.equal(payload.data.settings.feedKey, "");
  assert.equal(payload.data.settings.feedUser, "");
  assert.equal(payload.data.settings.payoutKey, "");
  assert.equal(payload.data.settings.backupToken, "");

  // No plaintext anywhere in the code that leaves the device.
  assert.equal(sealed.code.includes("guard.tester@example.com"), false);
  assert.equal(sealed.code.includes("4200"), false);
});

test("restoring puts the account and the wallet back and keeps this device's credentials", async (t) => {
  await boot(t, PROFILE);
  const record = await createVault();
  const sealed = await sealProfile(record.recoveryKey, null, FAST);

  // A new device: empty, with one credential of its own already entered.
  await boot(t, { settings: { feedKey: "device-only-key" } });
  const applied = await applyProfile(await openProfile(sealed.code, record.recoveryKey));
  assert.equal(applied.accounts, 1);

  const restored = (await chrome.storage.local.get(null)) || {};
  assert.equal(restored.accounts.acct_1.email, "guard.tester@example.com");
  assert.equal(restored["acct:acct_1:cashback"].available, 4200);
  assert.equal(restored.settings.catalogUrl, "https://offers.example.com/catalog.json");
  // The code never held a credential, so the one already on this device survives.
  assert.equal(restored.settings.feedKey, "device-only-key");
});

test("a crafted payload cannot plant a session or a recovery key", async (t) => {
  await boot(t, {});
  const applied = await applyProfile({
    app: "luma-pay-savings",
    v: 1,
    data: {
      session: { accountId: "acct_9" },
      signInGuard: { x: { tries: 1 } },
      vault: { recoveryKey: "MADE-UP" },
      "acct:acct_1:cashback": { available: 99 },
    },
  });
  assert.equal(applied.keys, 1);
  const stored = (await chrome.storage.local.get(null)) || {};
  assert.equal(stored.session, undefined);
  assert.equal(stored.signInGuard, undefined);
  assert.equal(stored.vault, undefined);
  assert.equal(stored["acct:acct_1:cashback"].available, 99);
});

test("nothing leaves without an address, and the endpoint only ever receives a sealed code", async (t) => {
  await boot(t, PROFILE);
  const record = await createVault();
  const calls = [];
  const real = globalThis.fetch;
  // The stub stays for the rest of this file: a settle timer may fire after the
  // test and must not reach a real host.
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  t.after(() => {
    if (!calls.length) globalThis.fetch = real;
  });

  const quiet = await pushVault(record, { backupUrl: "" });
  assert.equal(quiet.skipped, true);
  assert.equal(calls.length, 0, "no address means no request");

  const sent = await pushVault(record, {
    backupUrl: "https://sync.example.com/v1/vault",
    backupToken: "sync-token",
  });
  assert.equal(sent.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://sync.example.com/v1/vault");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.authorization, "Bearer sync-token");

  const body = JSON.parse(calls[0].options.body);
  assert.ok(body.code.startsWith("LUMA1."));
  assert.equal(body.code.includes("guard.tester@example.com"), false);
  const inside = await openProfile(body.code, record.recoveryKey);
  assert.equal(inside.data.accounts.acct_1.email, "guard.tester@example.com");
  // The relay, or anyone who reads what it keeps, cannot open it.
  await assert.rejects(() => openProfile(body.code, newRecoveryKey()), /does not open/);
});

test("an earning and the hourly alarm both send a fresh sealed copy", async (t) => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  const fake = await boot(t, PROFILE);
  await createVault();

  await chrome.storage.local.set({
    settings: { backupUrl: "https://sync.example.com/v1/vault", backupToken: "sync-token", autoRefresh: false },
  });
  // The copy has its own timer, so it stays current even with the savings list
  // on manual refresh.
  await waitFor(() => fake.alarms.some((alarm) => alarm.name === "luma-vault"));

  await fake.fireAlarm("luma-vault");
  await waitFor(() => calls.length >= 1);
  assert.ok(JSON.parse(calls[0].options.body).code.startsWith("LUMA1."));

  // Money arrives: the wallet key changes, which is the moment the copy matters.
  await chrome.storage.local.set({ "acct:acct_1:cashback": { available: 1234, pending: 0, paid: 0 } });
  await waitFor(() => calls.length >= 2, 8000);
  const record = await readVault();
  const opened = await openProfile(JSON.parse(calls[1].options.body).code, record.recoveryKey);
  assert.equal(opened.data["acct:acct_1:cashback"].available, 1234);
});

test("a profile with no recovery key seals nothing", async (t) => {
  await boot(t, PROFILE);
  assert.equal(await readVault(), null);
  const payload = await collectProfile();
  assert.equal(payload.app, "luma-pay-savings");
  assert.equal(payload.data.settings.feedKey, "");
});
