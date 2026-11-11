// Service worker: the only place that talks to Partner Platform endpoints.
// The side panel asks it for codes, and it records what actually worked so the
// same code is offered again next time. There is no bundled offer data — codes
// come from the operator's authorized feed, from what the shopper saved, or
// from codes the store itself published on the page.
import "../lib/compat.js";
import { resolveStore } from "../lib/stores.js";
import { partnerSummary } from "../lib/copy.js";
import { getOffers, feedEndpoint, feedHeaders, sourceLabel } from "../partners/offers-feed.js";
import { buildCashbackLink } from "../partners/cashback-network.js";
import { getPriceHistory } from "../partners/price-history.js";
import {
  normalizeWallet,
  settle,
  estimate,
  addEarning,
  addSponsoredEarning,
  balances,
  payOut,
  walletCurrency,
  normalizeCurrency,
} from "../partners/cashback-ledger.js";
import { getSponsoredOffers, claimOffer, sponsorConfigured } from "../partners/sponsor-offers.js";
import { payoutConfigured, payoutHost, detectPayoutService, requestVirtualCard, requestSimpleVisa, requestPreviewCard } from "../partners/cashback-payout.js";
import { readSettings, writeSettings } from "../lib/settings.js";
import { siteHost } from "../lib/site-request.js";
import { decideSite } from "../lib/site-add.js";
import { mergeCodes, cleanCode } from "../lib/codes.js";
import { normalizeRecord, addAds, summaryOf } from "../lib/ad-value.js";
import { scopedKey, scopePrefix } from "../lib/accounts.js";
import {
  BOOST_RATE,
  canCashOut,
  checkAge,
  isVerified,
  normalizeStatus,
  relayConfigured,
  relayHost,
} from "../lib/age-verify.js";
import { LOCAL_PROVIDER, judgeLocal } from "../lib/age-local.js";

const FEED_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFIED = 40;
const MAX_SAVED = 60;
const MAX_DEAD = 60;
const MAX_POINTS = 120;
const MAX_PRODUCTS = 300;
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

const CONTENT_FILES = [
  "src/lib/compat.js",
  "src/content/coupon-engine.js",
  "src/content/page-scan.js",
  "src/content/content.js",
];

const feedCache = new Map();

// Every figure belongs to the signed-in account, so the key carries its prefix.
async function readScoped(key) {
  const name = await scopedKey(key);
  const stored = await chrome.storage.local.get(name);
  return stored[name];
}

async function writeScoped(key, value) {
  await chrome.storage.local.set({ [await scopedKey(key)]: value });
}

async function readMap(key) {
  return (await readScoped(key)) || {};
}

async function writeMap(key, value) {
  await writeScoped(key, value);
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
  const site = siteHost(url);
  if (!store) return { store: null, site };

  // Sites the shopper added on the spot carry the name and category the page
  // itself declared, which is what the panel shows instead of the bare host.
  const added = store.custom ? (await readMap("addedSites"))[store.id] || null : null;
  if (added) {
    store.name = added.name || store.name;
    store.category = added.category || store.category;
  }

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
      // Added on the spot by the panel, so it can be removed again from there.
      removable: Boolean(store.custom),
      evidence: (added && added.evidence) || [],
    },
    site,
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
  const savings = (await readScoped("savings")) || { total: 0, count: 0 };
  savings.count += 1;
  if (isFinite(cents) && cents > 0) savings.total += cents;
  savings.updatedAt = Date.now();
  await writeScoped("savings", savings);

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

// ---- ad blocking ---------------------------------------------------------
// rules/ads.json blocks the ad requests; each page reports the slots it hid,
// and that count is what the panel turns into money.
async function readAdRecord() {
  return normalizeRecord(await readScoped("adBlock"));
}

async function adsSummary() {
  const settings = await readSettings();
  const record = await readAdRecord();
  return Object.assign(summaryOf(record), { enabled: settings.enabled.adBlock !== false });
}

async function reportAds(count) {
  const record = await readAdRecord();
  addAds(record, count);
  await writeScoped("adBlock", record);
  return adsSummary();
}

// The blocking ruleset follows the Settings toggle, so turning it off stops
// ads being blocked as well as counted.
async function syncAdBlock() {
  const rules = chrome.declarativeNetRequest;
  if (!rules || !rules.updateEnabledRulesets) return;
  const settings = await readSettings();
  try {
    await rules.updateEnabledRulesets(
      settings.enabled.adBlock === false
        ? { disableRulesetIds: ["ads"] }
        : { enableRulesetIds: ["ads"] }
    );
  } catch (_error) {
    // A browser without static rulesets still hides the slots on the page.
  }
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

async function activateCashback(url, total, currency) {
  const settings = await readSettings();
  const store = resolveStore(url, settings.enabledSites);
  if (!store) return { ok: false, reason: "unsupported" };

  const offers = await cachedOffers(store, settings, false);
  const link = buildCashbackLink(url, offers.cashback, settings);
  if (!link) return { ok: false, reason: "unconfigured" };

  await chrome.tabs.create({ url: link });

  // The wallet tracks the store's published rate against the cart total the
  // panel last saw on the page, so the figure is one the page actually showed.
  // It stays pending until the return window has passed.
  const wallet = await readWallet();
  const amount = estimate(total, offers.cashback && offers.cashback.rate);
  // The boost rides on this earning from the moment it is recorded: a verified
  // account earns it, an unverified one does not, and nothing already banked
  // changes.
  const boost = isVerified(await readAge()) ? BOOST_RATE : 0;
  const recentlyTracked = wallet.entries.some(
    (entry) => entry.storeId === store.id && Date.now() - entry.at < 10 * 60 * 1000
  );
  let tracked = false;
  if (amount && !recentlyTracked) {
    tracked = Boolean(
      addEarning(wallet, {
        storeId: store.id,
        storeName: store.name,
        total,
        rate: offers.cashback.rate,
        currency: normalizeCurrency(currency),
        boost,
      })
    );
    if (tracked) await writeWallet(wallet);
  }

  return { ok: true, url: link, tracked, wallet: await walletSummary() };
}

// ---- age check ----------------------------------------------------------
// The verdict is the relay's, stored with the account it was reached for. Only
// the outcome, the provider, its reference and the time are kept.
async function readAge() {
  return normalizeStatus(await readScoped("ageCheck"));
}

async function ageStatus() {
  const settings = await readSettings();
  return Object.assign({}, await readAge(), {
    configured: relayConfigured(settings),
    relayHost: relayHost(settings),
    minAge: 18,
    boost: BOOST_RATE,
  });
}

// No provider and no key: the panel measures two frames, the judgement happens
// here so the numbers — not the panel — decide when money unlocks.
async function verifyAgeLocally(message) {
  const verdict = judgeLocal(message && message.stats);
  if (verdict.state !== "verified") {
    return { ok: false, error: verdict.message || "The check did not finish. Try again." };
  }
  const status = normalizeStatus({
    state: "verified",
    provider: LOCAL_PROVIDER,
    reference: "on-device",
    estimate: null,
    checkedAt: Date.now(),
  });
  await writeScoped("ageCheck", status);
  return Object.assign({ ok: true }, status);
}

async function verifyAge(message) {
  const image = String((message && message.image) || "");
  if (!image) return { ok: false, error: "No frame was captured, so nothing was checked." };
  const settings = await readSettings();
  const outcome = await checkAge(settings, image);
  // The frame was handed to the relay and is not kept anywhere.
  if (!outcome.ok) return { ok: false, error: outcome.error, unavailable: Boolean(outcome.unavailable) };
  await writeScoped("ageCheck", outcome.status);
  return Object.assign({ ok: true }, outcome.status);
}

// ---- cashback wallet ----------------------------------------------------
async function readWallet() {
  return normalizeWallet(await readScoped("cashback"));
}

async function writeWallet(wallet) {
  await writeScoped("cashback", wallet);
}

async function walletSummary() {
  const settings = await readSettings();
  const wallet = await readWallet();
  if (settle(wallet)) await writeWallet(wallet);
  const age = await readAge();

  const currency = walletCurrency(wallet);
  return {
    balances: balances(wallet, currency),
    currency,
    minimum: Number(settings.payoutMinimum) || 0,
    mode: payoutConfigured(settings) ? "service" : "unconfigured",
    payoutHost: payoutHost(settings),
    // Cash outs are gated on the age check, so the panel is told here rather
    // than deciding for itself.
    ageVerified: isVerified(age),
    boost: BOOST_RATE,
    entries: wallet.entries.slice(0, 6).map((entry) => ({
      id: entry.id,
      storeName: entry.storeName,
      amount: entry.amount,
      currency: entry.currency,
      status: entry.status,
      at: entry.at,
      base: entry.base || null,
      boost: entry.boost || 0,
    })),
    payouts: wallet.payouts.slice(0, 3),
  };
}

async function cashOut(message) {
  const settings = await readSettings();
  const wallet = await readWallet();
  settle(wallet);

  // A face check that came back over 18 is the only thing that unlocks a payout.
  if (!canCashOut(await readAge())) {
    return { ok: false, reason: "age-unverified", wallet: await walletSummary() };
  }

  const currency = walletCurrency(wallet);
  const totals = balances(wallet, currency);
  const minimum = Number(settings.payoutMinimum) || 0;
  if (!totals.available || totals.available < minimum) {
    return { ok: false, reason: "below-minimum", wallet: await walletSummary() };
  }

  // Only the cashback in this currency is paid out; anything else stays.
  const amount = totals.available;
  const earnings = wallet.entries
    .filter((entry) => entry.status === "available" && normalizeCurrency(entry.currency) === currency)
    .map((entry) => entry.id);

  // The Simple level asks for a virtual Visa with no provider details; Developer
  // settings send the full Tango Card order instead. With nothing connected the
  // balance is issued as a preview card, so the one tap always completes.
  const request = { amount, currency, earnings };
  const connected = Boolean(String(settings.payoutUrl || "").trim());
  const reply = !connected
    ? requestPreviewCard(request)
    : message && message.simple
      ? await requestSimpleVisa(settings, request)
      : await requestVirtualCard(settings, request);
  if (!reply.ok) {
    return { ok: false, reason: reply.reason || "declined", error: reply.error, wallet: await walletSummary() };
  }

  const payout = payOut(wallet, amount, currency, reply.card);
  await writeWallet(wallet);
  return { ok: true, preview: Boolean(reply.preview), payout, wallet: await walletSummary() };
}

// One site, one content script: www.example.com and example.com share their id
// and their codes.
function scriptIdFor(host) {
  return "site_" + host.replace(/[^a-z0-9]/g, "_").slice(0, 60);
}

async function registerSiteScript(host, origin) {
  const id = scriptIdFor(host);
  const matches = [origin + "/*"];
  const bare = "*://" + host + "/*";
  if (matches.indexOf(bare) === -1) matches.push(bare);

  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (!existing.length) {
    await chrome.scripting.registerContentScripts([
      {
        id,
        matches,
        js: CONTENT_FILES,
        runAt: "document_idle",
        allFrames: true,
        persistAcrossSessions: true,
      },
    ]);
  }
  return id;
}

async function unregisterSiteScript(host) {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [scriptIdFor(host)] });
  } catch (_error) {
    // Nothing was registered for this host.
  }
}

// Reading what the page declares about itself, then adding it on the spot or
// leaving it out. Only the page's own evidence counts: schema.org store or
// product markup, a known storefront platform, and a real cart or checkout. The
// panel has already asked for access to this origin, which is the user gesture
// the browser requires.
async function detectSite(url, tabId) {
  const host = siteHost(url);
  if (!host) return { ok: false, reason: "no-site", message: "This tab is not a web page." };

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    return { ok: false, reason: "no-site", message: "This tab is not a web page." };
  }
  if (typeof tabId !== "number") {
    return { ok: false, reason: "no-tab", message: "Open the site's page and check it there." };
  }

  let detection = null;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameId: 0 },
      files: ["src/content/site-detect.js"],
    });
    const [reply] = await chrome.scripting.executeScript({
      target: { tabId, frameId: 0 },
      func: function () {
        return globalThis.SiteDetect ? globalThis.SiteDetect.scan() : null;
      },
    });
    detection = reply && reply.result;
  } catch (error) {
    return {
      ok: false,
      reason: "no-access",
      message: "The browser did not let the panel read this page: " + String((error && error.message) || error),
    };
  }
  if (!detection) return { ok: false, reason: "no-answer", message: "The page did not answer, so nothing was added." };

  const verdict = decideSite(detection, host);
  const settings = await readSettings();
  const added = await readMap("addedSites");

  if (!verdict.add) {
    // A page that cannot prove it is a shop is removed rather than parked in a
    // review queue: the site is not covered and any earlier record of it goes.
    let removed = false;
    if (settings.enabledSites.indexOf(host) !== -1) {
      settings.enabledSites = settings.enabledSites.filter((value) => value !== host);
      await writeSettings(settings);
      removed = true;
    }
    if (added[host]) {
      delete added[host];
      await writeMap("addedSites", added);
      removed = true;
    }
    await unregisterSiteScript(host);
    if (removed) feedCache.clear();
    return { ok: true, action: "removed", store: null, verdict };
  }

  try {
    await registerSiteScript(host, parsed.origin);
  } catch (error) {
    return {
      ok: false,
      reason: "register-failed",
      message: "The browser refused to watch this site: " + String((error && error.message) || error),
    };
  }

  if (settings.enabledSites.indexOf(host) === -1) {
    settings.enabledSites.push(host);
    await writeSettings(settings);
  }
  added[host] = {
    host,
    name: verdict.name,
    category: verdict.category,
    platform: detection.platform || null,
    evidence: verdict.evidence || [],
    addedAt: Date.now(),
  };
  await writeMap("addedSites", added);
  feedCache.clear();

  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: CONTENT_FILES });
  } catch (_error) {
    // The registration still covers the next page load.
  }

  return {
    ok: true,
    action: "added",
    store: { host, name: verdict.name, category: verdict.category },
    verdict,
  };
}

// Takes back a site the shopper added: its content script, its place in the
// enabled list and the profile the page declared. Saved codes stay on the
// device in case the site is added again.
async function removeSite(url) {
  const host = siteHost(url);
  if (!host) return { ok: false, message: "This tab is not a web page." };

  const settings = await readSettings();
  if (settings.enabledSites.indexOf(host) !== -1) {
    settings.enabledSites = settings.enabledSites.filter((value) => value !== host);
    await writeSettings(settings);
  }
  const added = await readMap("addedSites");
  if (added[host]) {
    delete added[host];
    await writeMap("addedSites", added);
  }
  await unregisterSiteScript(host);
  feedCache.clear();
  return { ok: true, host };
}

// Sponsored offers: the sponsor service lists the ads and books what each visit
// pays. Only what the sponsor confirms reaches the wallet.
async function sponsoredOffers() {
  const settings = await readSettings();
  const payload = await getSponsoredOffers(settings);
  return Object.assign({}, payload, { configured: sponsorConfigured(settings) });
}

async function claimSponsoredOffer(offerId) {
  const settings = await readSettings();
  const reply = await claimOffer(settings, offerId);
  if (!reply.ok) return reply;

  const wallet = await readWallet();
  settle(wallet);
  const entry = addSponsoredEarning(wallet, reply.earning);
  if (!entry) {
    return { ok: false, error: "This offer is already in your wallet.", wallet: await walletSummary() };
  }
  await writeWallet(wallet);
  return { ok: true, entry, wallet: await walletSummary() };
}

async function stats() {
  const [saved, verified, prices, stored, wallet] = await Promise.all([
    readMap("saved"),
    readMap("verified"),
    readMap("prices"),
    readScoped("savings"),
    readWallet().then((loaded) => {
      settle(loaded);
      return loaded;
    }),
  ]);
  const countCodes = (map) =>
    Object.keys(map).reduce((total, key) => total + (map[key] || []).length, 0);
  return {
    saved: countCodes(saved),
    verified: countCodes(verified),
    products: Object.keys(prices).length,
    savings: stored || { total: 0, count: 0 },
    wallet: balances(wallet),
  };
}

async function exportData() {
  const [saved, verified, prices, stored, settings, wallet] = await Promise.all([
    readMap("saved"),
    readMap("verified"),
    readMap("prices"),
    readScoped("savings"),
    readSettings(),
    readWallet(),
  ]);
  const safeSettings = Object.assign({}, settings);
  // Credentials stay on the device they were entered on.
  delete safeSettings.feedKey;
  delete safeSettings.feedUser;
  delete safeSettings.sponsorKey;
  delete safeSettings.payoutKey;
  delete safeSettings.payoutPlatformKey;
  return {
    app: "shopping-agent-savings",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: safeSettings,
    saved,
    verified,
    prices,
    savings: stored || null,
    cashback: wallet,
  };
}

// Only the signed-in account's figures are cleared; another account on the same
// browser keeps its own balance untouched.
async function clearData() {
  const prefix = await scopePrefix();
  const all = (await chrome.storage.local.get(null)) || {};
  const mine = Object.keys(all).filter((key) => key.indexOf(prefix) === 0);
  if (mine.length) await chrome.storage.local.remove(mine);
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
      return activateCashback(message.url, message.total, message.currency);
    case "cashback:wallet":
      return walletSummary();
    case "cashback:cashout":
      return cashOut(message);
    case "age:status":
      return ageStatus();
    case "age:verify":
      return verifyAge(message);
    case "age:local":
      return verifyAgeLocally(message);
    case "payout:detect":
      return detectPayoutService(await readSettings());
    case "sponsor:offers":
      return sponsoredOffers();
    case "sponsor:claim":
      return claimSponsoredOffer(message.offerId);
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
    case "ads:report":
      return reportAds(message.count);
    case "ads:stats":
      return adsSummary();
    case "site:detect":
      return detectSite(message.url, sender && sender.tab ? sender.tab.id : message.tabId);
    case "site:remove":
      return removeSite(message.url);
    case "settings:get":
      return readSettings();
    case "settings:set":
      await writeSettings(message.settings);
      feedCache.clear();
      await syncAdBlock();
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

// Toolbar click opens the panel — the whole UI lives there. Chromium browsers
// have the Side Panel API, Firefox has its sidebar, and a browser with neither
// gets the panel in a small window.
const HAS_SIDE_PANEL = !!(chrome.sidePanel && chrome.sidePanel.open);
const HAS_SIDEBAR = !!(chrome.sidebarAction && chrome.sidebarAction.open);

function openPanel(windowId) {
  if (HAS_SIDE_PANEL) {
    return chrome.sidePanel.open({ windowId }).catch(function () {
      /* Only opens from a user gesture; a click or a command is one. */
    });
  }
  if (HAS_SIDEBAR) {
    return chrome.sidebarAction.open().catch(function () {
      /* Firefox opens it from the toolbar button or its own shortcut. */
    });
  }
  return chrome.windows
    .create({
      url: chrome.runtime.getURL("sidepanel.html"),
      type: "popup",
      width: 400,
      height: 760,
    })
    .catch(function () {});
}

function openPanelOnActionClick() {
  if (!HAS_SIDE_PANEL) return;
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function (error) {
    console.warn("[savings] side panel setup failed:", error);
  });
}

openPanelOnActionClick();
// Rulesets follow the saved setting from the first moment the worker runs.
syncAdBlock();

// Only fires where the click does not already open the side panel: Firefox and
// any Chromium browser without the Side Panel API.
chrome.action.onClicked.addListener(function () {
  openPanel();
});

chrome.commands.onCommand.addListener(function (command) {
  if (command !== "open-panel") return;
  chrome.windows.getLastFocused({ populate: false }, function (win) {
    if (win && typeof win.id === "number") openPanel(win.id);
  });
});

chrome.runtime.onInstalled.addListener(function () {
  openPanelOnActionClick();
  syncAdBlock();
});
chrome.runtime.onStartup.addListener(syncAdBlock);
