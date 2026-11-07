// Service worker: the only place that talks to Partner Platform endpoints.
// Content script and popup both ask it the same question, so the page and the
// toolbar always show identical data.
import { resolveStore } from "../lib/stores.js";
import { partnerSummary } from "../lib/copy.js";
import { getOffers } from "../partners/offers-feed.js";
import { buildCashbackLink } from "../partners/cashback-network.js";
import { getPriceHistory } from "../partners/price-history.js";

const DEFAULTS = {
  feedUrl: "",
  feedKey: "",
  cashbackTemplate: "",
  cashbackSiteId: "",
  priceHistoryKey: "",
  partnerMembers: "",
  enabled: { coupons: true, cashback: true, priceHistory: true },
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

async function readSettings() {
  const stored = await chrome.storage.local.get("settings");
  const settings = Object.assign({}, DEFAULTS, stored.settings || {});
  settings.enabled = Object.assign({}, DEFAULTS.enabled, settings.enabled || {});
  return settings;
}

async function resolveSite(url, options) {
  const store = resolveStore(url);
  if (!store) return { store: null };

  const refresh = options && options.refresh;
  const cached = cache.get(url);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.payload;

  const settings = await readSettings();

  const offers = settings.enabled.coupons
    ? await getOffers(store, settings)
    : { coupons: [], cashback: null, source: "off", note: "" };

  let cashback = null;
  if (settings.enabled.cashback && offers.cashback) {
    cashback = {
      rate: offers.cashback.rate || null,
      url: buildCashbackLink(url, offers.cashback, settings),
    };
  }

  const price = settings.enabled.priceHistory ? await getPriceHistory(url, settings) : null;

  const payload = {
    store: { id: store.id, name: store.name, category: store.category },
    offers: {
      coupons: offers.coupons,
      source: offers.source,
      note: offers.note,
      cashback,
    },
    price,
    footer: partnerSummary(settings.partnerMembers),
  };

  cache.set(url, { at: Date.now(), payload });
  return payload;
}

async function activateCashback(url) {
  const store = resolveStore(url);
  if (!store) return { ok: false, reason: "unsupported" };

  const settings = await readSettings();
  const offers = await getOffers(store, settings);
  const link = buildCashbackLink(url, offers.cashback, settings);
  if (!link) return { ok: false, reason: "unconfigured" };

  await chrome.tabs.create({ url: link });
  return { ok: true, url: link };
}

async function handle(message) {
  switch (message && message.type) {
    case "site:resolve":
      return resolveSite(message.url);
    case "offers:refresh":
      cache.delete(message.url);
      return resolveSite(message.url, { refresh: true });
    case "cashback:activate":
      return activateCashback(message.url);
    case "settings:get":
      return readSettings();
    default:
      return { error: "unknown message: " + (message && message.type) };
  }
}

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  handle(message)
    .then(sendResponse)
    .catch(function (error) {
      sendResponse({ error: String((error && error.message) || error) });
    });
  return true;
});
