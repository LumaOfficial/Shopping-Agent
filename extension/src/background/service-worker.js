// Service worker: the only place that talks to Partner Platform endpoints.
// The side panel asks it for offers and records codes that actually applied, so
// a code that worked once is offered again next time.
import { resolveStore } from "../lib/stores.js";
import { partnerSummary } from "../lib/copy.js";
import { getOffers, feedEndpoint, feedHeaders, sourceLabel } from "../partners/offers-feed.js";
import { buildCashbackLink } from "../partners/cashback-network.js";
import { getPriceHistory } from "../partners/price-history.js";

const DEFAULTS = {
  feedUrl: "",
  feedAuth: "bearer",
  feedUser: "",
  feedKey: "",
  sourceCheckedAt: 0,
  cashbackTemplate: "",
  cashbackSiteId: "",
  priceHistoryKey: "",
  partnerMembers: "",
  enabled: { coupons: true, cashback: true, priceHistory: true },
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFIED = 40;
const cache = new Map();

async function readSettings() {
  const stored = await chrome.storage.local.get("settings");
  const settings = Object.assign({}, DEFAULTS, stored.settings || {});
  settings.enabled = Object.assign({}, DEFAULTS.enabled, settings.enabled || {});
  return settings;
}

async function readVerified() {
  const stored = await chrome.storage.local.get("verified");
  return stored.verified || {};
}

// Codes the shopper's own store accepted — the only codes known to work.
function withVerified(storeId, offers, verified) {
  const remembered = verified[storeId] || [];
  const known = new Set(offers.coupons.map((coupon) => coupon.code.toUpperCase()));
  const extra = remembered
    .filter((entry) => entry && entry.code && !known.has(entry.code.toUpperCase()))
    .map((entry) => ({ code: entry.code, title: "Worked on this store before", verified: true }));
  return extra.concat(offers.coupons);
}

async function resolveSite(url, options) {
  const store = resolveStore(url);
  if (!store) return { store: null };

  const refresh = options && options.refresh;
  const cached = cache.get(url);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.payload;

  const settings = await readSettings();
  const verified = await readVerified();

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
      coupons: withVerified(store.id, offers, verified),
      source: offers.source,
      note: offers.note,
      cashback,
    },
    source: {
      kind: offers.source,
      label: settings.feedUrl ? sourceLabel(settings.feedUrl) : "Demo catalog",
      fetchedAt: offers.fetchedAt || Date.now(),
      note: offers.note || "",
    },
    price,
    footer: partnerSummary(settings.partnerMembers),
  };

  cache.set(url, { at: Date.now(), payload });
  return payload;
}

async function recordVerified(storeId, code) {
  if (!storeId || !code) return { ok: false };
  const stored = await chrome.storage.local.get("verified");
  const verified = stored.verified || {};
  const entries = (verified[storeId] || []).filter(
    (entry) => entry.code.toUpperCase() !== code.toUpperCase()
  );
  entries.unshift({ code, at: Date.now() });
  verified[storeId] = entries.slice(0, MAX_VERIFIED);
  await chrome.storage.local.set({ verified });
  cache.clear();
  return { ok: true };
}

// Validates the operator's authorized data source: it either answers with the
// expected offer shape or the reason it did not. Nothing is scraped here — the
// endpoint is whatever access the operator is entitled to.
async function testSource() {
  const settings = await readSettings();
  if (!settings.feedUrl) {
    return { ok: false, message: "No authorized source configured yet. Add its endpoint below." };
  }

  try {
    const response = await fetch(feedEndpoint(settings.feedUrl, "target"), {
      headers: feedHeaders(settings),
    });
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        message: "Authorization rejected (HTTP " + response.status + "). Check the credentials for this source.",
      };
    }
    if (!response.ok) {
      return { ok: false, message: "Source answered HTTP " + response.status + "." };
    }

    const payload = await response.json();
    const stores = payload && payload.stores
      ? Object.keys(payload.stores).length
      : Array.isArray(payload)
        ? payload.length
        : 0;
    const checkedAt = Date.now();
    await chrome.storage.local.set({ settings: Object.assign({}, settings, { sourceCheckedAt: checkedAt }) });
    cache.clear();
    return {
      ok: true,
      storeCount: stores,
      checkedAt,
      message:
        "Connected — " +
        (stores ? stores + " store offers available." : "the source answered, but no store offers were found."),
    };
  } catch (error) {
    return { ok: false, message: "Could not reach the source: " + String((error && error.message) || error) };
  }
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
    case "verified:record":
      return recordVerified(message.storeId, message.code);
    case "settings:get":
      return readSettings();
    case "source:test":
      return testSource();
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

chrome.runtime.onInstalled.addListener(function () {
  // Toolbar click opens the side panel — the whole UI lives there.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function (error) {
    console.warn("[savings] side panel setup failed:", error);
  });
});
