import { withDefaults } from "./src/lib/settings.js";
import { money } from "./src/lib/format.js";
import { currentAccount, hasAccounts, signOut } from "./src/lib/accounts.js";
import { endpoint } from "./src/lib/guard.js";
import { consentLine, readConsent, termsUrl } from "./src/lib/terms.js";
import { TOUR_KEY, TOUR_VERSION } from "./src/lib/tutorial.js";
import { detectPlatform, platformLine } from "./src/lib/platform.js";
import {
  applyProfile,
  createVault,
  openProfile,
  pushVault,
  readVault,
  sealProfile,
  writeVault,
} from "./src/lib/backup.js";
import { groupRecoveryKey, normalizeRecoveryKey } from "./src/lib/vault.js";

const byId = (id) => document.getElementById(id);

// Settings come in three levels so a shopper who only wants to save money never
// has to read a feed or payout field. Simple is the default; the chosen level is
// remembered on this device.
const LEVELS = ["simple", "advanced", "developer"];

function rememberedLevel() {
  try {
    return localStorage.getItem("settingsLevel") || "simple";
  } catch (_error) {
    return "simple";
  }
}

function showLevel(level, focus) {
  const active = LEVELS.includes(level) ? level : "simple";
  LEVELS.forEach((name) => {
    byId("tab-" + name).setAttribute("aria-selected", String(name === active));
    byId("panel-" + name).hidden = name !== active;
  });
  try {
    localStorage.setItem("settingsLevel", active);
  } catch (_error) {
    // Storage blocked: the page just opens on Simple next time.
  }
  if (focus) byId("tab-" + active).focus();
}

// The Simple level shows the balance and one tap. Every provider detail —
// endpoint, account, Tango Card ids — stays under Developer.
function renderSimpleWallet(stats) {
  const wallet = stats.wallet || {};
  byId("simple-wallet").textContent = money(wallet.available || 0, wallet.currency);
}

function fill(settings) {
  byId("catalog-url").value = settings.catalogUrl;
  byId("toggle-refresh").checked = settings.autoRefresh !== false;
  byId("feed-url").value = settings.feedUrl;
  byId("feed-auth").value = settings.feedAuth;
  byId("feed-user").value = settings.feedUser;
  byId("feed-key").value = settings.feedKey;
  byId("cashback-template").value = settings.cashbackTemplate;
  byId("cashback-site").value = settings.cashbackSiteId;
  byId("payout-url").value = settings.payoutUrl;
  byId("payout-platform").value = settings.payoutPlatform;
  byId("payout-platform-key").value = settings.payoutPlatformKey;
  byId("payout-account").value = settings.payoutAccount;
  byId("payout-customer").value = settings.payoutCustomer;
  byId("payout-utid").value = settings.payoutUtid;
  byId("payout-key").value = settings.payoutKey;
  byId("sponsor-url").value = settings.sponsorUrl;
  byId("sponsor-key").value = settings.sponsorKey;
  byId("payout-minimum").value = settings.payoutMinimum ? settings.payoutMinimum / 100 : "";
  byId("price-key").value = settings.priceHistoryKey;
  byId("age-url").value = settings.ageCheckUrl;
  byId("age-token").value = settings.ageCheckToken;
  byId("vault-url").value = settings.backupUrl;
  byId("vault-token").value = settings.backupToken;
  byId("members").value = settings.partnerMembers;
  byId("toggle-coupons").checked = settings.enabled.coupons;
  byId("toggle-cashback").checked = settings.enabled.cashback;
  byId("toggle-price").checked = settings.enabled.priceHistory;
  byId("toggle-clip").checked = settings.enabled.clipOffers;
  byId("toggle-tracking").checked = settings.enabled.priceTracking;
  byId("toggle-adblock").checked = settings.enabled.adBlock !== false;
  syncAuthFields();
}

// Basic auth (Oxylabs style) needs a username; a bearer token does not.
function syncAuthFields() {
  const basic = byId("feed-auth").value === "basic";
  byId("feed-user-field").hidden = !basic;
  byId("feed-key-label").textContent = basic ? "Source password" : "Source token";
  byId("feed-key").placeholder = basic ? "Your provider password" : "Bearer token";
}

function collect() {
  return {
    catalogUrl: byId("catalog-url").value.trim(),
    autoRefresh: byId("toggle-refresh").checked,
    feedUrl: byId("feed-url").value.trim(),
    feedAuth: byId("feed-auth").value === "basic" ? "basic" : "bearer",
    feedUser: byId("feed-user").value.trim(),
    feedKey: byId("feed-key").value.trim(),
    cashbackTemplate: byId("cashback-template").value.trim(),
    cashbackSiteId: byId("cashback-site").value.trim(),
    payoutUrl: byId("payout-url").value.trim(),
    payoutPlatform: byId("payout-platform").value.trim(),
    payoutPlatformKey: byId("payout-platform-key").value.trim(),
    payoutAccount: byId("payout-account").value.trim(),
    payoutCustomer: byId("payout-customer").value.trim(),
    payoutUtid: byId("payout-utid").value.trim(),
    payoutKey: byId("payout-key").value.trim(),
    payoutMinimum: toMinor(byId("payout-minimum").value, 500),
    sponsorUrl: byId("sponsor-url").value.trim(),
    sponsorKey: byId("sponsor-key").value.trim(),
    priceHistoryKey: byId("price-key").value.trim(),
    ageCheckUrl: byId("age-url").value.trim(),
    ageCheckToken: byId("age-token").value.trim(),
    backupUrl: byId("vault-url").value.trim(),
    backupToken: byId("vault-token").value.trim(),
    partnerMembers: byId("members").value.trim(),
    enabled: {
      coupons: byId("toggle-coupons").checked,
      cashback: byId("toggle-cashback").checked,
      priceHistory: byId("toggle-price").checked,
      clipOffers: byId("toggle-clip").checked,
      priceTracking: byId("toggle-tracking").checked,
      adBlock: byId("toggle-adblock").checked,
    },
  };
}

// The minimum is typed in dollars and stored in minor units, like every other
// amount in the extension.
function toMinor(value, fallback) {
  const dollars = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!isFinite(dollars) || dollars <= 0) return fallback;
  return Math.round(dollars * 100);
}

// Fetching a user-supplied host needs an optional host permission.
async function ensureHost(endpoint) {
  if (!endpoint) return true;
  let origin;
  try {
    origin = new URL(endpoint.replace("{store}", "example")).origin + "/*";
  } catch {
    return true;
  }
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

// Platform credentials only ever travel to the payout proxy, so that endpoint
// must be HTTPS. Nothing is stored while it is not.
function payoutEndpointInsecure(settings) {
  const key = String(settings.payoutPlatformKey || "").trim();
  const url = String(settings.payoutUrl || "").trim();
  return Boolean(key) && !/^https:\/\//i.test(url);
}

// A face frame leaves the browser for this address, so it travels encrypted
// unless the relay is on this machine.
function ageEndpointInsecure(settings) {
  const url = String(settings.ageCheckUrl || "").trim();
  if (!url) return false;
  if (/^https:\/\//i.test(url)) return false;
  return !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url);
}

// Addresses the extension contacts, in the words the fields use, so a refused
// address is named rather than silently dropped on save.
const ENDPOINT_FIELDS = [
  { key: "feedUrl", label: "the coupon feed" },
  { key: "catalogUrl", label: "the published savings list" },
  { key: "cashbackTemplate", label: "the tracked link template" },
  { key: "payoutUrl", label: "the payout proxy" },
  { key: "sponsorUrl", label: "the sponsor service" },
  { key: "ageCheckUrl", label: "the age check relay" },
  { key: "backupUrl", label: "the sync endpoint" },
];

async function save() {
  const stored = await chrome.storage.local.get("settings");
  const typed = collect();
  const refused = ENDPOINT_FIELDS.find((field) => typed[field.key] && !endpoint(typed[field.key]));
  if (refused) {
    return {
      ok: false,
      message:
        "Use an https:// address for " +
        refused.label +
        ". Plain HTTP, credentials inside the address and any other scheme are refused, so nothing travels in the clear.",
    };
  }
  const settings = withDefaults(Object.assign({}, stored.settings, typed));
  if (payoutEndpointInsecure(settings)) {
    return {
      ok: false,
      message: "Use an https:// payout proxy address — platform credentials are only sent encrypted.",
    };
  }
  if (ageEndpointInsecure(settings)) {
    return {
      ok: false,
      message: "Use an https:// age check relay address — the relay token is only sent encrypted.",
    };
  }
  const granted = await ensureHost(settings.feedUrl);
  const catalogGranted = await ensureHost(settings.catalogUrl);
  const payoutGranted = await ensureHost(settings.payoutUrl);
  const sponsorGranted = await ensureHost(settings.sponsorUrl);
  await ensureHost(settings.ageCheckUrl);
  await ensureHost(settings.backupUrl);
  await chrome.storage.local.set({ settings });
  if (!(granted && catalogGranted && payoutGranted && sponsorGranted)) {
    return { ok: false, message: "Saved, but access to that source host was denied." };
  }
  return { ok: true };
}

// What the worker actually holds for the savings list: which list, how many
// offers, when it was read, and whether the hourly pass is on. Nothing here is
// assumed — it is read back over the worker's own message.
async function renderFreshness() {
  const line = byId("refresh-status");
  const report = await chrome.runtime.sendMessage({ type: "catalog:status" }).catch(() => null);
  if (!report) {
    line.textContent = "Could not read the savings list.";
    return;
  }
  const parts = [
    report.count + " store offers from " + (report.source === "published" ? "your published list" : "the bundled list"),
    "updated " + (report.updated || "with this version"),
    report.auto ? "re-checked hourly" : "checked when the panel opens",
  ];
  if (report.error) parts.push(report.error);
  line.textContent = parts.join(" \u00b7 ") + ".";
  byId("toggle-refresh").checked = Boolean(report.auto);
}

byId("refresh-now").addEventListener("click", async () => {
  const button = byId("refresh-now");
  button.disabled = true;
  button.textContent = "Updating\u2026";
  await chrome.runtime.sendMessage({ type: "catalog:refresh" }).catch(() => null);
  button.disabled = false;
  button.textContent = "Update now";
  await renderFreshness();
});

// Replaying writes the tour's start state; an open panel picks it up through
// chrome.storage.onChanged, and a closed one opens with it next time.
byId("replay-tour").addEventListener("click", async () => {
  await chrome.storage.local.set({
    [TOUR_KEY]: { version: TOUR_VERSION, done: false, step: 0, at: Date.now(), reason: "replay" },
  });
  byId("refresh-status").textContent = "The tour opens the next time you open the panel.";
});

// The switch takes effect as soon as it is flipped, rather than waiting for the
// form's Save button.
byId("toggle-refresh").addEventListener("change", async () => {
  const outcome = await save();
  if (outcome.ok) await renderFreshness();
});

async function load() {
  const stored = await chrome.storage.local.get("settings");
  fill(withDefaults(stored.settings));
  showLevel(rememberedLevel());
  loadData();
  renderFreshness();
  renderVault();
  // #payouts deep-links here, so land on the one level that holds the payout
  // fields.
  if (location.hash === "#payouts") {
    showLevel("developer");
    byId("payouts").scrollIntoView({ block: "start" });
  }
  detectPayout(true);
}

// A read-only check that the payout proxy is live. The address typed in the
// field is saved first (so the host permission comes from this gesture); the
// automatic check on load only probes what was already saved.
let detectingPayout = false;

async function detectPayout(useStored) {
  if (detectingPayout) return;
  const button = byId("detect-payout");
  const result = byId("payout-result");

  if (useStored) {
    const stored = await chrome.storage.local.get("settings");
    if (!String(withDefaults(stored.settings).payoutUrl || "").trim()) {
      result.hidden = true;
      return;
    }
  } else {
    if (!byId("payout-url").value.trim()) {
      result.hidden = true;
      return;
    }
    const outcome = await save();
    if (!outcome.ok) {
      result.hidden = false;
      result.className = "test-line bad";
      result.textContent = outcome.message;
      return;
    }
  }

  detectingPayout = true;
  button.disabled = true;
  button.textContent = "Detecting…";
  result.hidden = false;
  result.className = "test-line wait";
  result.textContent = "Checking the payout service…";

  const reply = await chrome.runtime.sendMessage({ type: "payout:detect" }).catch(() => null);
  result.className = "test-line " + (reply && reply.ok ? "ok" : "bad");
  result.textContent = (reply && reply.message) || "No answer from the extension worker.";
  button.disabled = false;
  button.textContent = "Detect payout service";
  detectingPayout = false;
}

byId("detect-payout").addEventListener("click", () => detectPayout(false));
byId("payout-url").addEventListener("change", () => detectPayout(false));

async function loadData() {
  const [stats, settings] = await Promise.all([
    chrome.runtime.sendMessage({ type: "stats:get" }).catch(() => null),
    chrome.storage.local.get("settings").then((stored) => withDefaults(stored.settings)),
  ]);

  if (!stats) {
    byId("data-stats").textContent = "Could not read local data.";
    return;
  }

  const savings = stats.savings || { total: 0, count: 0 };
  byId("data-stats").textContent =
    stats.saved +
    " saved code" +
    (stats.saved === 1 ? "" : "s") +
    " · " +
    stats.verified +
    " verified code" +
    (stats.verified === 1 ? "" : "s") +
    " · " +
    stats.products +
    " product" +
    (stats.products === 1 ? "" : "s") +
    " tracked · " +
    savings.count +
    " confirmed application" +
    (savings.count === 1 ? "" : "s") +
    " worth $" +
    ((savings.total || 0) / 100).toFixed(2) +
    " in total drops." +
    (stats.wallet
      ? " Cashback wallet: " +
        money(stats.wallet.available || 0, stats.wallet.currency) +
        " available, " +
        money(stats.wallet.pending || 0, stats.wallet.currency) +
        " pending, " +
        money(stats.wallet.paid || 0, stats.wallet.currency) +
        " paid out."
      : "");

  const list = byId("site-list");
  const sites = settings.enabledSites || [];
  list.hidden = !sites.length;
  list.textContent = sites.length ? "Enabled on: " + sites.join(", ") : "";

  renderSimpleWallet(stats);
  renderSecurity(settings);
}

// The security section states what is true on this device right now. Every line
// it fills in is read back from storage, not assumed.
async function renderSecurity(settings) {
  const configured = [
    settings.feedUrl,
    settings.catalogUrl,
    settings.cashbackTemplate,
    settings.payoutUrl,
    settings.sponsorUrl,
    settings.ageCheckUrl,
  ].filter(Boolean).length;
  byId("guard-endpoints").textContent = configured
    ? "All " + configured + " of your endpoints use HTTPS (or a listener on this machine). Plain HTTP on the open internet is refused."
    : "None configured yet, so nothing leaves this device.";

  const [signedIn, accounts] = await Promise.all([currentAccount(), hasAccounts()]);
  byId("guard-device").textContent =
    (accounts
      ? signedIn
        ? "Signed in as " + signedIn.email + " on this device."
        : "An account exists on this device and is signed out."
      : "No account on this device yet.") +
    " \u00b7 " +
    platformLine(detectPlatform());
  byId("guard-signout").disabled = !signedIn;
}

byId("guard-signout").addEventListener("click", async () => {
  await signOut();
  const status = byId("guard-status");
  status.textContent = "Signed out";
  status.hidden = false;
  await loadData();
  setTimeout(() => {
    status.hidden = true;
  }, 2400);
});

// Settings opens in its own tab, so "Back" closes that tab. Where the page is
// shown without a tab to close it returns to the savings panel instead, so the
// shopper is never stuck on this screen.
async function goBack() {
  try {
    const tab = chrome.tabs && chrome.tabs.getCurrent ? await chrome.tabs.getCurrent() : null;
    if (tab && tab.id != null && chrome.tabs.remove) {
      await chrome.tabs.remove(tab.id);
      return;
    }
  } catch (_error) {
    // No tab to close — fall through to the panel.
  }
  window.close();
  setTimeout(() => {
    location.href = chrome.runtime.getURL("sidepanel.html");
  }, 150);
}

byId("back").addEventListener("click", goBack);

byId("feed-auth").addEventListener("change", syncAuthFields);

byId("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const outcome = await save();
  const saved = byId("saved");
  saved.textContent = outcome.ok ? "Saved" : outcome.message;
  saved.hidden = false;
  setTimeout(() => {
    saved.hidden = true;
  }, 2400);
});

byId("test-source").addEventListener("click", async () => {
  const button = byId("test-source");
  const result = byId("test-result");
  button.disabled = true;
  button.textContent = "Testing…";
  result.hidden = false;
  result.className = "test-line wait";
  result.textContent = "Contacting the source…";

  const outcome = await save();
  if (!outcome.ok) {
    result.className = "test-line bad";
    result.textContent = outcome.message;
    button.disabled = false;
    button.textContent = "Test connection";
    return;
  }

  const reply = await chrome.runtime.sendMessage({ type: "source:test" }).catch(() => null);
  result.className = "test-line " + (reply && reply.ok ? "ok" : "bad");
  result.textContent = (reply && reply.message) || "No answer from the extension worker.";
  button.disabled = false;
  button.textContent = "Test connection";
});

byId("export-data").addEventListener("click", async () => {
  const status = byId("data-status");
  const dump = await chrome.runtime.sendMessage({ type: "data:export" }).catch(() => null);
  if (!dump) {
    status.textContent = "Export failed.";
    status.hidden = false;
    return;
  }
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "savings-backup.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  status.textContent = "Exported";
  status.hidden = false;
  setTimeout(() => {
    status.hidden = true;
  }, 2400);
});

byId("clear-data").addEventListener("click", async () => {
  const status = byId("data-status");
  const confirmed = window.confirm(
    "Delete the codes you saved, the codes you verified, the prices tracked on this device and the cashback wallet?"
  );
  if (!confirmed) return;
  // The worker only clears on a request that says it was confirmed, so no other
  // message can empty the figures by itself.
  await chrome.runtime.sendMessage({ type: "data:clear", confirm: true }).catch(() => null);
  status.textContent = "Cleared";
  status.hidden = false;
  await loadData();
  setTimeout(() => {
    status.hidden = true;
  }, 2400);
});

LEVELS.forEach((name) => {
  byId("tab-" + name).addEventListener("click", () => showLevel(name, true));
});

// ---- backup and recovery -------------------------------------------------
// All of it runs on this page: the profile is sealed and opened with the
// browser's own WebCrypto, so no key and no plaintext passes through the worker
// and nothing is written until a code has actually opened.
function whenText(value) {
  const at = Date.parse(String(value || ""));
  if (!isFinite(at)) return "";
  return new Date(at).toLocaleString();
}

function vaultSay(text, kind) {
  const line = byId("vault-result");
  line.textContent = text;
  line.className = "test-line" + (kind ? " " + kind : "");
  line.hidden = false;
}

function showRecoveryKey(record) {
  const block = byId("vault-key");
  block.textContent = groupRecoveryKey(record.recoveryKey);
  block.hidden = false;
}

async function renderVault() {
  const [record, stored] = await Promise.all([readVault(), chrome.storage.local.get("settings")]);
  const settings = withDefaults(stored.settings);
  byId("vault-show").hidden = !record;
  const status = byId("vault-status");
  if (!record) {
    status.textContent =
      "No recovery key yet, so this device holds the only copy of everything above.";
    return;
  }
  const parts = ["Recovery key created " + (whenText(record.createdAt) || "on this device")];
  if (record.lastPushAt) parts.push("sealed copy sent " + whenText(record.lastPushAt));
  else if (record.lastSealedAt) parts.push("sealed " + whenText(record.lastSealedAt));
  else parts.push("no sealed copy made yet");
  if (record.lastError) parts.push("last send failed: " + record.lastError);
  if (!settings.backupUrl) parts.push("no sync endpoint, so a saved copy is the only one off this device");
  status.textContent = parts.join(" \u00b7 ") + ".";
}

function dayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function saveFile(text, name) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// The file is the code plus the few lines a person needs years later, when the
// extension is long uninstalled and only this text is left.
function vaultFile(code) {
  return [
    "Luma Pay Shopping Agent \u2014 encrypted backup",
    "Sealed " + new Date().toISOString() + " on this device.",
    "This needs the recovery key from the same profile. Without it nothing in this file can be read or restored.",
    "",
    code,
    "",
  ].join("\n");
}

async function sealAndSave(record) {
  const sealed = await sealProfile(record.recoveryKey);
  saveFile(vaultFile(sealed.code), "luma-backup-" + dayStamp() + ".luma");
  await writeVault(Object.assign({}, record, { lastSealedAt: sealed.sealedAt }));
  return sealed;
}

byId("vault-create").addEventListener("click", async () => {
  const existing = await readVault();
  if (
    existing &&
    !window.confirm(
      "This replaces the recovery key on this device, and copies sealed with the old key stop opening. Continue?"
    )
  ) {
    return;
  }
  const record = await createVault();
  showRecoveryKey(record);
  const sealed = await sealAndSave(record);
  vaultSay(
    "Recovery key created and a sealed copy of " +
      sealed.keys +
      " parts of your profile saved. Write the key down somewhere that survives this device.",
    "ok"
  );
  await renderVault();
});

byId("vault-show").addEventListener("click", async () => {
  const record = await readVault();
  if (!record) return vaultSay("There is no recovery key on this device yet.", "bad");
  showRecoveryKey(record);
});

byId("vault-save").addEventListener("click", async () => {
  const record = await readVault();
  if (!record) return vaultSay("Create a recovery key first \u2014 a copy is sealed with it.", "bad");
  const sealed = await sealAndSave(record);
  vaultSay(
    "Sealed copy saved, holding " +
      sealed.keys +
      " parts of your profile. It opens only with your recovery key.",
    "ok"
  );
  await renderVault();
});

byId("vault-copy").addEventListener("click", async () => {
  const record = await readVault();
  if (!record) return vaultSay("Create a recovery key first \u2014 a code is sealed with it.", "bad");
  const sealed = await sealProfile(record.recoveryKey);
  let copied = false;
  try {
    await navigator.clipboard.writeText(sealed.code);
    copied = true;
  } catch (_error) {
    copied = false;
  }
  await writeVault(Object.assign({}, record, { lastSealedAt: sealed.sealedAt }));
  vaultSay(
    copied
      ? "Code copied. It is still locked \u2014 without the recovery key it is noise."
      : "This browser would not let the page reach the clipboard. Use Save an encrypted copy instead.",
    copied ? "ok" : "bad"
  );
  await renderVault();
});

byId("vault-sync").addEventListener("click", async () => {
  const record = await readVault();
  if (!record) return vaultSay("Create a recovery key first \u2014 there is nothing to seal yet.", "bad");
  const outcome = await save();
  if (!outcome.ok) return vaultSay(outcome.message, "bad");
  const stored = await chrome.storage.local.get("settings");
  const settings = withDefaults(stored.settings);
  if (!settings.backupUrl) {
    return vaultSay("Add a sync endpoint above, or use Save an encrypted copy.", "bad");
  }
  vaultSay("Sealing your profile and sending it\u2026", "wait");
  const sent = await pushVault(record, settings);
  vaultSay(
    sent.ok
      ? "Sealed copy sent. The host now holds something only your recovery key opens."
      : "Could not send the sealed copy: " + sent.error,
    sent.ok ? "ok" : "bad"
  );
  await renderVault();
});

// Opening a code is one tap and replacing the profile is a second one, rather
// than a browser dialog: what a code holds is worth reading before it lands, and
// nothing is written until it has actually opened.
let pendingRestore = null;
let pendingRestoreKey = "";

function hideRestoreConfirm() {
  pendingRestore = null;
  pendingRestoreKey = "";
  byId("vault-restore-confirm").hidden = true;
}

byId("vault-restore").addEventListener("click", async () => {
  const code = byId("vault-code").value.trim();
  const key = byId("vault-restore-key").value.trim();
  hideRestoreConfirm();
  if (!code) return vaultSay("Paste the sealed code first.", "bad");
  if (!key) return vaultSay("Type the recovery key that goes with it.", "bad");

  let payload;
  try {
    payload = await openProfile(code, key);
  } catch (error) {
    return vaultSay(String((error && error.message) || error), "bad");
  }

  pendingRestore = payload;
  pendingRestoreKey = normalizeRecoveryKey(key);
  const accounts = payload.data.accounts && typeof payload.data.accounts === "object"
    ? Object.keys(payload.data.accounts).length
    : 0;
  byId("vault-restore-summary").textContent =
    "This code opens: " +
    Object.keys(payload.data).length +
    " parts of a profile" +
    (accounts ? ", including " + accounts + " account" + (accounts === 1 ? "" : "s") : "") +
    (whenText(payload.sealedAt) ? ", sealed " + whenText(payload.sealedAt) : "") +
    ". Replacing puts all of it here and signs this device out.";
  byId("vault-restore-confirm").hidden = false;
  vaultSay("Code opened. Nothing has been written yet.", "ok");
});

byId("vault-restore-cancel").addEventListener("click", () => {
  hideRestoreConfirm();
  vaultSay("Nothing was restored.", "");
});

byId("vault-restore-go").addEventListener("click", async () => {
  if (!pendingRestore) return hideRestoreConfirm();
  const payload = pendingRestore;
  const key = pendingRestoreKey;
  const applied = await applyProfile(payload);
  await signOut();
  // The device keeps sealing with the key it was restored with, so the copy that
  // survived the wipe is the one that keeps being updated: the same piece of
  // paper, the same endpoint from the restored settings, no second key to lose.
  if (key) {
    await writeVault({
      v: 1,
      recoveryKey: key,
      createdAt: applied.at || new Date().toISOString(),
      lastSealedAt: payload.sealedAt || null,
      lastPushAt: null,
      lastError: "",
    });
  }
  hideRestoreConfirm();
  byId("vault-code").value = "";
  byId("vault-restore-key").value = "";
  byId("vault-key").hidden = true;
  vaultSay(
    "Restored " +
      applied.keys +
      " parts of your profile" +
      (applied.accounts
        ? " and " + applied.accounts + " account" + (applied.accounts === 1 ? "" : "s")
        : "") +
      ". Sign in with the password you used before \u2014 the same account, balance and codes are back.",
    "ok"
  );
  await load();
});


// One tap, no provider details: the worker issues a plain virtual Visa, and any
// setup stays in Developer rather than sending the shopper there.
byId("simple-cashout").addEventListener("click", async () => {
  const button = byId("simple-cashout");
  const result = byId("simple-cashout-result");
  button.disabled = true;
  button.textContent = "Getting your virtual Visa…";
  result.hidden = false;
  result.className = "test-line wait";
  result.textContent = "Sorting your virtual Visa…";

  const reply = await chrome.runtime.sendMessage({ type: "cashback:cashout", simple: true }).catch(() => null);

  button.disabled = false;
  button.textContent = "Get a virtual Visa";

  const wallet = (reply && reply.wallet) || {};
  const totals = wallet.balances || {};
  const currency = wallet.currency || "USD";
  const minimum = wallet.minimum || 0;

  if (reply && reply.ok) {
    result.className = "test-line ok";
    result.textContent = reply.preview
      ? "Preview card ready — no cash value. Connect a reward service under Developer for a real card."
      : "Your virtual Visa is ready — redeem it from the panel.";
  } else if ((totals.available || 0) < minimum) {
    result.className = "test-line wait";
    result.textContent =
      "You have " +
      money(totals.available || 0, currency) +
      " cashable — a card needs " +
      money(minimum, currency) +
      ". The rest keeps adding up as stores confirm your orders.";
  } else if (reply && reply.reason === "not-connected") {
    result.className = "test-line wait";
    result.textContent = "Virtual Visa rewards open once a reward service is connected on this device.";
  } else {
    result.className = "test-line bad";
    result.textContent =
      (reply && reply.error) || "The virtual Visa did not go through. Try again in a moment.";
  }
  loadData();
});

// What the panel asked the shopper to agree to, and the way back to it. The
// document ships inside the extension, so this opens a packaged page.
async function renderTerms() {
  byId("terms-status").textContent = consentLine(await readConsent());
}

byId("terms-link").addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: termsUrl() });
});

renderTerms();
load();
