// One definition of the stored settings, shared by the service worker (which
// reads them) and the options page (which writes them).
export const DEFAULTS = {
  feedUrl: "",
  feedAuth: "bearer",
  feedUser: "",
  feedKey: "",
  cashbackTemplate: "",
  cashbackSiteId: "",
  payoutUrl: "",
  payoutKey: "",
  payoutAccount: "",
  payoutCustomer: "",
  payoutUtid: "",
  payoutMinimum: 500,
  priceHistoryKey: "",
  partnerMembers: "",
  enabledSites: [],
  enabled: {
    coupons: true,
    cashback: true,
    priceHistory: true,
    clipOffers: true,
    priceTracking: true,
  },
};

export function withDefaults(stored) {
  const settings = Object.assign({}, DEFAULTS, stored || {});
  settings.enabled = Object.assign({}, DEFAULTS.enabled, (stored && stored.enabled) || {});
  settings.enabledSites = Array.isArray(settings.enabledSites) ? settings.enabledSites : [];
  return settings;
}

export async function readSettings() {
  const stored = await chrome.storage.local.get("settings");
  return withDefaults(stored.settings);
}

export async function writeSettings(settings) {
  await chrome.storage.local.set({ settings: withDefaults(settings) });
}
