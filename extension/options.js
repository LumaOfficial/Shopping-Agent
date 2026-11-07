const DEFAULTS = {
  feedUrl: "",
  feedKey: "",
  cashbackTemplate: "",
  cashbackSiteId: "",
  priceHistoryKey: "",
  partnerMembers: "",
  enabled: { coupons: true, cashback: true, priceHistory: true },
};

const byId = (id) => document.getElementById(id);

function fill(settings) {
  byId("feed-url").value = settings.feedUrl;
  byId("feed-key").value = settings.feedKey;
  byId("cashback-template").value = settings.cashbackTemplate;
  byId("cashback-site").value = settings.cashbackSiteId;
  byId("price-key").value = settings.priceHistoryKey;
  byId("members").value = settings.partnerMembers;
  byId("toggle-coupons").checked = settings.enabled.coupons;
  byId("toggle-cashback").checked = settings.enabled.cashback;
  byId("toggle-price").checked = settings.enabled.priceHistory;
}

function collect() {
  return {
    feedUrl: byId("feed-url").value.trim(),
    feedKey: byId("feed-key").value.trim(),
    cashbackTemplate: byId("cashback-template").value.trim(),
    cashbackSiteId: byId("cashback-site").value.trim(),
    priceHistoryKey: byId("price-key").value.trim(),
    partnerMembers: byId("members").value.trim(),
    enabled: {
      coupons: byId("toggle-coupons").checked,
      cashback: byId("toggle-cashback").checked,
      priceHistory: byId("toggle-price").checked,
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

async function load() {
  const stored = await chrome.storage.local.get("settings");
  const settings = Object.assign({}, DEFAULTS, stored.settings || {});
  settings.enabled = Object.assign({}, DEFAULTS.enabled, settings.enabled || {});
  fill(settings);
}

document.getElementById("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = collect();
  const granted = await ensureFeedHost(settings.feedUrl);
  if (!granted) {
    byId("saved").textContent = "Saved, but access to that feed host was denied.";
    byId("saved").hidden = false;
    return;
  }
  await chrome.storage.local.set({ settings });
  const saved = byId("saved");
  saved.textContent = "Saved";
  saved.hidden = false;
  setTimeout(() => {
    saved.hidden = true;
  }, 2000);
});

load();
