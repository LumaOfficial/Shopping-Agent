// Service worker: the only place that talks to Partner Platform endpoints.
// The side panel asks it for codes, and it records what actually worked so the
// same code is offered again next time. There is no bundled offer data — codes
// come from the operator's authorized feed, from what the shopper saved, or
// from codes the store itself published on the page.
import { resolveStore } from "../lib/stores.js";
import { partnerSummary } from "../lib/copy.js";
import { getOffers, feedEndpoint, feedHeaders, sourceLabel } from "../partners/offers-feed.js";
import { buildCashbackLink } from "../partners/cashback-network.js";
import { getPriceHistory } from "../partners/price-history.js";
import { readSettings, writeSettings } from "../lib/settings.js";
import { mergeCodes, cleanCode } from "../lib/codes.js";

const FEED_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFIED = 40;
const MAX_SAVED = 60;
const MAX_DEAD = 60;
const MAX_POINTS = 120;
const MAX_PRODUCTS = 300;
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

const CONTENT_FILES = [
  "src/content/coupon-engine.js",
  "src/content/page-scan.js",
  "src/content/content.js",
];

const feedCache = new Map();

async function readMap(key) {
  const stored = await chrome.storage.local.get(key);
  return stored[key] || {};
}

async function writeMap(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

function cachedOffers(store, settings, refresh) {
  const cached = feedCache.get(store.id);
  if (!refresh && cached && Date.now() - cached.at < FEED_TTL_MS) return Promise.resolve(cached.payload);
  return getOffers(store, settings).then((payload) => {
    feedCache.set(store.id, { at: Date.now(), payload });
    return payload;
  });
}

async function resolveSite(url, options) {
  const settings = await readSettings();
  const store = resolveStore(url, settings.enabledSites);
  if (!store) return { store: null };

  const [verified, saved, dead] = await Promise.all([
    readMap("verified"),
    readMap("saved"),
    readMap("dead"),
  ]);

  const feed = settings.enabled.coupons
    ? await cachedOffers(store, settings, options && options.refresh)
    : { status: "off", coupons: [], cashback: null, fetchedAt: null, error: null };

  const codes = mergeCodes(
    (verified[store.id] || []).map((entry) => Object.assign({}, entry, { source: "verified" })),
    feed.coupons,
    (saved[store.id] || []).map((entry) => Object.assign({}, entry, { source: "saved" }))
  );

  let cashback = null;
  if (settings.enabled.cashback && feed.cashback) {
    cashback = {
      rate: feed.cashback.rate || null,
      url: buildCashbackLink(url, feed.cashback, settings),
    };
  }

  const keepa = settings.enabled.priceHistory ? await getPriceHistory(url, settings) : null;

  return {
    store: {
      id: store.id,
      name: store.name,
      category: store.category,
      custom: Boolean(store.custom),
    },
    codes,
    feed: {
      configured: Boolean(settings.feedUrl),
      status: feed.status,
      label: settings.feedUrl ? sourceLabel(settings.feedUrl) : null,
      fetchedAt: feed.fetchedAt,
      error: feed.error || null,
    },
    cashback,
    keepa,
    // Codes the shopper reported as not working on this store.
    dead: (dead[store.id] || []).map((entry) => entry.code),
    features: settings.enabled,
    counts: {
      saved: (saved[store.id] || []).length,
      verified: (verified[store.id] || []).length,
    },
    footer: partnerSummary(settings.partnerMembers),
  };
}

async function saveCode(storeId, input, title) {
  const code = cleanCode(input);
  if (!storeId || !code) return { ok: false, error: "That does not look like a code." };
  const saved = await readMap("saved");
  const entries = (saved[storeId] || []).filter((entry) => entry.code !== code);
  entries.unshift({ code, title: String(title || "").trim().slice(0, 120) || null, at: Date.now() });
  saved[storeId] = entries.slice(0, MAX_SAVED);
  await writeMap("saved", saved);
  return { ok: true, code };
}

async function deleteCode(storeId, input) {
  const code = cleanCode(input);
  const saved = await readMap("saved");
  const entries = (saved[storeId] || []).filter((entry) => entry.code !== code);
  if (entries.length) saved[storeId] = entries;
  else delete saved[storeId];
  await writeMap("saved", saved);
  return { ok: true };
}

// Codes the shopper reported as not working. They stay on this device, are
// filtered out of the list and are never retried by "Try all".
async function markDead(storeId, input, restore) {
  const code = cleanCode(input);
  if (!storeId || !code) return { ok: false };
  const dead = await readMap("dead");
  const entries = (dead[storeId] || []).filter((entry) => entry.code !== code);
  if (!restore) entries.unshift({ code, at: Date.now() });
  if (entries.length) dead[storeId] = entries.slice(0, MAX_DEAD);
  else delete dead[storeId];
  await writeMap("dead", dead);
  return { ok: true, dead: entries.map((entry) => entry.code) };
}

// Codes the shopper's own store accepted — the only codes known to work.
async function recordVerified(storeId, input, saving) {
  const code = cleanCode(input);
  if (!storeId || !code) return { ok: false };

  const verified = await readMap("verified");
  const entries = (verified[storeId] || []).filter((entry) => entry.code !== code);
  entries.unshift({ code, at: Date.now() });
  verified[storeId] = entries.slice(0, MAX_VERIFIED);
  await writeMap("verified", verified);

  // Only a total the page itself confirmed becomes a savings figure.
  const cents = Math.round(Number(saving || 0) * 100);
  const savings = (await chrome.storage.local.get("savings")).savings || { total: 0, count: 0 };
  savings.count += 1;
  if (isFinite(cents) && cents > 0) savings.total += cents;
  savings.updatedAt = Date.now();
  await chrome.storage.local.set({ savings });

  return { ok: true, savings };
}

async function recordPrice(product) {
  if (!product || !product.key || typeof product.price !== "number") return null;
  const prices = await readMap("prices");
  const key = String(product.key);
  const entry = prices[key] || {
    title: product.title || "",
    storeId: product.storeId || null,
    currency: product.currency || "USD",
    points: [],
  };
  entry.title = product.title || entry.title;
  entry.storeId = product.storeId || entry.storeId;
  entry.currency = product.currency || entry.currency;

  const last = entry.points[entry.points.length - 1];
  const changed = !last || last[1] !== product.price;
  const stale = !last || Date.now() - last[0] > 60 * 60 * 1000;
  if (changed || stale) entry.points.push([Date.now(), product.price]);
  entry.points = entry.points.slice(-MAX_POINTS);
  entry.seenAt = Date.now();
  prices[key] = entry;

  // Keep storage bounded: drop the products not seen for longest.
  const keys = Object.keys(prices);
  if (keys.length > MAX_PRODUCTS) {
    keys
      .sort((a, b) => (prices[a].seenAt || 0) - (prices[b].seenAt || 0))
      .slice(0, keys.length - MAX_PRODUCTS)
      .forEach((stale_key) => delete prices[stale_key]);
  }

  await writeMap("prices", prices);
  return summarizePrice(entry);
}

function summarizePrice(entry) {
  const points = entry.points || [];
  if (!points.length) return null;
  const cutoff = Date.now() - NINETY_DAYS;
  const recent = points.filter((point) => point[0] >= cutoff);
  const pool = recent.length ? recent : points;
  const current = points[points.length - 1][1];
  const low = Math.min.apply(null, pool.map((point) => point[1]));
  const high = Math.max.apply(null, pool.map((point) => point[1]));
  return {
    title: entry.title || "",
    currency: entry.currency || "USD",
    current,
    low,
    high,
    points: pool.length,
    firstAt: points[0][0],
    lastAt: points[points.length - 1][0],
    atLow: current <= low,
    windowDays: Math.max(1, Math.round((Date.now() - points[0][0]) / (24 * 60 * 60 * 1000))),
  };
}

async function getPrice(key) {
  const prices = await readMap("prices");
  const entry = prices[String(key || "")];
  return entry ? summarizePrice(entry) : null;
}

// Validates the operator's authorized data source: it either answers with the
// expected offer shape or the reason it did not. Nothing is scraped here — the
// endpoint is whatever access the operator is entitled to.
async function testSource() {
  const settings = await readSettings();
  if (!settings.feedUrl) {
    return { ok: false, message: "No authorized source configured yet. Add its endpoint in Settings." };
  }

  try {
    const response = await fetch(feedEndpoint(settings.feedUrl, "target"), {
      headers: feedHeaders(settings),
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        message: "Authorization rejected (HTTP " + response.status + "). Check the credentials for this source.",
      };
    }
    if (!response.ok) return { ok: false, message: "Source answered HTTP " + response.status + "." };

    const payload = await response.json();
    const stores = payload && payload.stores
      ? Object.keys(payload.stores).length
      : Array.isArray(payload)
        ? payload.length
        : payload && (payload.coupons || payload.cashback)
          ? 1
          : 0;

    feedCache.clear();
    return {
      ok: true,
      storeCount: stores,
      message:
        "Connected — " +
        (stores ? stores + " store offers available." : "the source answered, but no store offers were found."),
    };
  } catch (error) {
    return { ok: false, message: "Could not reach the source: " + String((error && error.message) || error) };
  }
}

async function activateCashback(url) {
  const store = resolveStore(url, (await readSettings()).enabledSites);
  if (!store) return { ok: false, reason: "unsupported" };

  const settings = await readSettings();
  const offers = await cachedOffers(store, settings, false);
  const link = buildCashbackLink(url, offers.cashback, settings);
  if (!link) return { ok: false, reason: "unconfigured" };

  await chrome.tabs.create({ url: link });
  return { ok: true, url: link };
}

// Lets the shopper use the extension on a store that is not in the catalog.
// The panel asks for the origin permission first (it needs the user gesture);
// this registers a persistent content script for future visits and injects the
// same scripts into the tab that is already open.
async function enableSite(url, tabId) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    return { ok: false, error: "This tab is not a web page." };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { ok: false, error: "Only http and https pages can be enabled." };
  }

  const host = parsed.hostname.toLowerCase();
  const id = "site_" + host.replace(/[^a-z0-9]/g, "_").slice(0, 60);

  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
    if (!existing.length) {
      await chrome.scripting.registerContentScripts([
        {
          id,
          matches: [parsed.origin + "/*"],
          js: CONTENT_FILES,
          runAt: "document_idle",
          allFrames: true,
          persistAcrossSessions: true,
        },
      ]);
    }
  } catch (error) {
    return { ok: false, error: "Chrome refused the content script: " + String((error && error.message) || error) };
  }

  const settings = await readSettings();
  if (settings.enabledSites.indexOf(host) === -1) {
    settings.enabledSites.push(host);
    await writeSettings(settings);
  }

  if (typeof tabId === "number") {
    try {
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: CONTENT_FILES });
    } catch (_error) {
      // The registration still covers the next page load.
    }
  }

  return { ok: true, host };
}

async function stats() {
  const [saved, verified, prices, stored] = await Promise.all([
    readMap("saved"),
    readMap("verified"),
    readMap("prices"),
    chrome.storage.local.get("savings"),
  ]);
  const countCodes = (map) =>
    Object.keys(map).reduce((total, key) => total + (map[key] || []).length, 0);
  return {
    saved: countCodes(saved),
    verified: countCodes(verified),
    products: Object.keys(prices).length,
    savings: stored.savings || { total: 0, count: 0 },
  };
}

async function exportData() {
  const [saved, verified, prices, stored, settings] = await Promise.all([
    readMap("saved"),
    readMap("verified"),
    readMap("prices"),
    chrome.storage.local.get("savings"),
    readSettings(),
  ]);
  const safeSettings = Object.assign({}, settings);
  // Credentials stay on the device they were entered on.
  delete safeSettings.feedKey;
  delete safeSettings.feedUser;
  return {
    app: "shopping-agent-savings",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: safeSettings,
    saved,
    verified,
    prices,
    savings: stored.savings || null,
  };
}

async function clearData() {
  await chrome.storage.local.remove(["saved", "verified", "dead", "prices", "savings"]);
  feedCache.clear();
  return { ok: true };
}

async function handle(message, sender) {
  switch (message && message.type) {
    case "site:resolve":
      return resolveSite(message.url);
    case "offers:refresh":
      return resolveSite(message.url, { refresh: true });
    case "cashback:activate":
      return activateCashback(message.url);
    case "verified:record":
      return recordVerified(message.storeId, message.code, message.saving);
    case "codes:save":
      return saveCode(message.storeId, message.code, message.title);
    case "codes:delete":
      return deleteCode(message.storeId, message.code);
    case "codes:dead":
      return markDead(message.storeId, message.code, message.restore);
    case "price:record":
      return recordPrice(message.product);
    case "price:get":
      return getPrice(message.key);
    case "site:enable":
      return enableSite(message.url, sender && sender.tab ? sender.tab.id : message.tabId);
    case "settings:get":
      return readSettings();
    case "settings:set":
      await writeSettings(message.settings);
      feedCache.clear();
      return { ok: true };
    case "source:test":
      return testSource();
    case "stats:get":
      return stats();
    case "data:export":
      return exportData();
    case "data:clear":
      return clearData();
    default:
      return { error: "unknown message: " + (message && message.type) };
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  handle(message, sender)
    .then(sendResponse)
    .catch(function (error) {
      sendResponse({ error: String((error && error.message) || error) });
    });
  return true;
});

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && changes.settings) feedCache.clear();
});

// Toolbar click opens the side panel — the whole UI lives there.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function (error) {
  console.warn("[savings] side panel setup failed:", error);
});

chrome.commands.onCommand.addListener(function (command) {
  if (command !== "open-panel") return;
  chrome.windows.getLastFocused({ populate: false }, function (win) {
    if (win && typeof win.id === "number") {
      chrome.sidePanel.open({ windowId: win.id }).catch(function () {
        /* Chrome only opens it from a user gesture; the command is one. */
      });
    }
  });
});

chrome.runtime.onInstalled.addListener(function () {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {});
});
