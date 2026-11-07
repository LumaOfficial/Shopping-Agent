import { withDefaults } from "./src/lib/settings.js";

const byId = (id) => document.getElementById(id);

function fill(settings) {
  byId("feed-url").value = settings.feedUrl;
  byId("feed-auth").value = settings.feedAuth;
  byId("feed-user").value = settings.feedUser;
  byId("feed-key").value = settings.feedKey;
  byId("cashback-template").value = settings.cashbackTemplate;
  byId("cashback-site").value = settings.cashbackSiteId;
  byId("price-key").value = settings.priceHistoryKey;
  byId("members").value = settings.partnerMembers;
  byId("toggle-coupons").checked = settings.enabled.coupons;
  byId("toggle-cashback").checked = settings.enabled.cashback;
  byId("toggle-price").checked = settings.enabled.priceHistory;
  byId("toggle-clip").checked = settings.enabled.clipOffers;
  byId("toggle-tracking").checked = settings.enabled.priceTracking;
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
    priceHistoryKey: byId("price-key").value.trim(),
    partnerMembers: byId("members").value.trim(),
    enabled: {
      coupons: byId("toggle-coupons").checked,
      cashback: byId("toggle-cashback").checked,
      priceHistory: byId("toggle-price").checked,
      clipOffers: byId("toggle-clip").checked,
      priceTracking: byId("toggle-tracking").checked,
    },
  };
}

// Fetching a user-supplied feed host needs an optional host permission.
async function ensureFeedHost(feedUrl) {
  if (!feedUrl) return true;
  let origin;
  try {
    origin = new URL(feedUrl.replace("{store}", "example")).origin + "/*";
  } catch {
    return true;
  }
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

async function save() {
  const stored = await chrome.storage.local.get("settings");
  const settings = withDefaults(Object.assign({}, stored.settings, collect()));
  const granted = await ensureFeedHost(settings.feedUrl);
  await chrome.storage.local.set({ settings });
  return granted;
}

async function load() {
  const stored = await chrome.storage.local.get("settings");
  fill(withDefaults(stored.settings));
  loadData();
}

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
    " in total drops.";

  const list = byId("site-list");
  const sites = settings.enabledSites || [];
  list.hidden = !sites.length;
  list.textContent = sites.length ? "Enabled on: " + sites.join(", ") : "";
}

byId("feed-auth").addEventListener("change", syncAuthFields);

byId("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const granted = await save();
  const saved = byId("saved");
  saved.textContent = granted ? "Saved" : "Saved, but access to that source host was denied.";
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

  const granted = await save();
  if (!granted) {
    result.className = "test-line bad";
    result.textContent = "Access to that source host was denied, so it cannot be tested.";
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
    "Delete the codes you saved, the codes you verified, and the prices tracked on this device?"
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

load();
