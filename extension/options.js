import { withDefaults } from "./src/lib/settings.js";
import { money } from "./src/lib/format.js";

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

async function save() {
  const stored = await chrome.storage.local.get("settings");
  const settings = withDefaults(Object.assign({}, stored.settings, collect()));
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
  const payoutGranted = await ensureHost(settings.payoutUrl);
  const sponsorGranted = await ensureHost(settings.sponsorUrl);
  await ensureHost(settings.ageCheckUrl);
  await chrome.storage.local.set({ settings });
  if (!(granted && payoutGranted && sponsorGranted)) {
    return { ok: false, message: "Saved, but access to that source host was denied." };
  }
  return { ok: true };
}

async function load() {
  const stored = await chrome.storage.local.get("settings");
  fill(withDefaults(stored.settings));
  showLevel(rememberedLevel());
  loadData();
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
}

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
  await chrome.runtime.sendMessage({ type: "data:clear" }).catch(() => null);
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

load();
