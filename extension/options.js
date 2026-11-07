const DEFAULTS = {
  feedUrl: "",
  feedAuth: "bearer",
  feedUser: "",
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
  syncAuthFields();
}

// Basic auth (Oxylabs style) needs a username; a bearer token does not.
function syncAuthFields() {
  const basic = byId("feed-auth").value === "basic";
  byId("feed-user-field").hidden = !basic;
  byId("feed-key-label").textContent = basic ? "Source password" : "Source token";
  byId("feed-key").placeholder = basic ? "Your Oxylabs password" : "Bearer token";
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
  const settings = collect();
  const granted = await ensureFeedHost(settings.feedUrl);
  await chrome.storage.local.set({ settings });
  const saved = byId("saved");
  saved.hidden = false;
  setTimeout(() => {
    saved.hidden = true;
  }, 2000);
  return granted;
}

async function load() {
  const stored = await chrome.storage.local.get("settings");
  const settings = Object.assign({}, DEFAULTS, stored.settings || {});
  settings.enabled = Object.assign({}, DEFAULTS.enabled, settings.enabled || {});
  fill(settings);
}

byId("feed-auth").addEventListener("change", syncAuthFields);

byId("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const granted = await save();
  if (!granted) {
    const saved = byId("saved");
    saved.textContent = "Saved, but access to that source host was denied.";
    saved.hidden = false;
  } else {
    byId("saved").textContent = "Saved";
  }
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

  const reply = await chrome.runtime.sendMessage({ type: "source:test" });
  result.className = "test-line " + (reply && reply.ok ? "ok" : "bad");
  result.textContent = (reply && reply.message) || "No answer from the extension worker.";
  button.disabled = false;
  button.textContent = "Test connection";
});

load();
