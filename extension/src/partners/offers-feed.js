// Optional offer connector. Codes arrive automatically from the page the
// shopper is on; this feed only adds more of them, plus the cashback rate, for
// an operator who has an authorized source. There is no bundled catalog: when no
// feed is configured this returns nothing and the panel works from the page.
import { normalizeCode, isExpired } from "../lib/codes.js";

export function feedEndpoint(feedUrl, storeId) {
  return String(feedUrl || "").split("{store}").join(encodeURIComponent(storeId));
}

// Credentials live in chrome.storage.local and are only ever sent to the host
// the operator configured. Oxylabs-style access uses HTTP Basic.
export function feedHeaders(settings) {
  const headers = { accept: "application/json" };
  if (!settings.feedKey) return headers;
  if (settings.feedAuth === "basic" && settings.feedUser) {
    headers.authorization = "Basic " + btoa(settings.feedUser + ":" + settings.feedKey);
  } else {
    headers.authorization = "Bearer " + settings.feedKey;
  }
  return headers;
}

export function sourceLabel(feedUrl) {
  try {
    return new URL(String(feedUrl).replace("{store}", "example")).host;
  } catch (_error) {
    return "configured source";
  }
}

// Some authorized providers answer with their own job envelope rather than the
// store's JSON — Oxylabs' Web Scraper API puts the fetched page in
// `results[].content`, as a JSON string. Unwrapping it here means an operator's
// existing account works without running a separate formatting proxy.
function unwrapPayload(payload, depth) {
  if (depth > 3 || payload === null || typeof payload === "undefined") return payload;
  if (typeof payload === "string") {
    const text = payload.trim();
    if (!text || (text[0] !== "{" && text[0] !== "[")) return payload;
    try {
      return unwrapPayload(JSON.parse(text), depth + 1);
    } catch (_error) {
      return payload;
    }
  }
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object") return payload;
  if (Array.isArray(payload.results) && payload.results.length) {
    const first = payload.results[0] || {};
    const inner = typeof first.content !== "undefined" ? first.content : first;
    return unwrapPayload(inner, depth + 1);
  }
  if (typeof payload.content !== "undefined") return unwrapPayload(payload.content, depth + 1);
  return payload;
}

// Accepted payload shapes, in the order the README documents them.
function pickEntry(payload, storeId) {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    const match = payload.find((item) => item && (item.store === storeId || item.id === storeId));
    if (match) return match;
    // A feed may also answer with just this store's coupons or just its offers.
    if (payload.some((item) => item && (item.code || item.couponCode))) return { coupons: payload };
    return payload.some((item) => item && item.title) ? { deals: payload } : null;
  }
  if (payload.stores && payload.stores[storeId]) return payload.stores[storeId];
  if (payload.coupons || payload.codes || payload.offers || payload.cashback) return payload;
  if (payload.deals || payload.storeOffers) return payload;
  return null;
}

// Only an http(s) link may leave the panel, even when a feed supplies it.
function httpLink(url) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value) ? value : null;
}

const OFFER_KINDS = new Set(["coupon", "member", "outlet", "deal", "service"]);

// Storewide offers a feed may publish alongside its codes: the same rows a
// published savings list carries, so a connected provider can fill the panel's
// savings list too. Only a title is required, and only an https link survives.
function normalizeDeal(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!title) return null;
  const link = String(raw.url || "").trim();
  return {
    kind: OFFER_KINDS.has(raw.kind) ? raw.kind : "deal",
    title,
    detail: String(raw.detail || raw.note || "").replace(/\s+/g, " ").trim().slice(0, 220),
    url: /^https:\/\/[^\s]+$/i.test(link) ? link : null,
  };
}

function normalizeOffers(entry) {
  const list = entry && (entry.deals || entry.storeOffers);
  return (Array.isArray(list) ? list : []).map(normalizeDeal).filter(Boolean);
}

function normalizeEntry(entry) {
  const list = entry && (entry.coupons || entry.codes || entry.offers);
  const coupons = (Array.isArray(list) ? list : [])
    .map((raw) => normalizeCode(raw, "feed"))
    .filter(Boolean)
    .filter((coupon) => !isExpired(coupon));
  const cashback = entry && entry.cashback
    ? {
        rate: entry.cashback.rate || null,
        trackingUrl: httpLink(entry.cashback.trackingUrl || entry.cashback.url),
      }
    : null;
  return { coupons, cashback, offers: normalizeOffers(entry) };
}

const EMPTY = { coupons: [], cashback: null, offers: [], fetchedAt: null, error: null };

// One reading of a source's answer, shared by the panel's offers and by the
// Settings test, so what the test reports is what the panel will show.
export function readFeed(payload, storeId) {
  const entry = pickEntry(unwrapPayload(payload, 0), storeId);
  return { entry, ...normalizeEntry(entry) };
}

export async function getOffers(store, settings) {
  if (!settings.feedUrl) return Object.assign({}, EMPTY, { status: "unconfigured" });

  try {
    const response = await fetch(feedEndpoint(settings.feedUrl, store.id), {
      headers: feedHeaders(settings),
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      return Object.assign({}, EMPTY, {
        status: "denied",
        error: "The source rejected the credentials (HTTP " + response.status + ").",
      });
    }
    if (!response.ok) {
      return Object.assign({}, EMPTY, { status: "error", error: "The source answered HTTP " + response.status + "." });
    }
    const payload = await response.json();
    const read = readFeed(payload, store.id);
    return {
      coupons: read.coupons,
      cashback: read.cashback,
      offers: read.offers,
      status: "ok",
      fetchedAt: Date.now(),
      error: read.entry ? null : "The source has no entry for this store.",
    };
  } catch (error) {
    return Object.assign({}, EMPTY, {
      status: "unreachable",
      error: "Could not reach the source: " + String((error && error.message) || error),
    });
  }
}
