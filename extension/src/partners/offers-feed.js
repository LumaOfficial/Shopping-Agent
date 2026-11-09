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

// Accepted payload shapes, in the order the README documents them.
function pickEntry(payload, storeId) {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    const match = payload.find((item) => item && (item.store === storeId || item.id === storeId));
    if (match) return match;
    // A feed may also answer with just this store's coupons.
    return payload.some((item) => item && (item.code || item.couponCode)) ? { coupons: payload } : null;
  }
  if (payload.stores && payload.stores[storeId]) return payload.stores[storeId];
  if (payload.coupons || payload.codes || payload.offers || payload.cashback) return payload;
  return null;
}

// Only an http(s) link may leave the panel, even when a feed supplies it.
function httpLink(url) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value) ? value : null;
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
  return { coupons, cashback };
}

const EMPTY = { coupons: [], cashback: null, fetchedAt: null, error: null };

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
    const entry = pickEntry(payload, store.id);
    const normalized = normalizeEntry(entry);
    return {
      coupons: normalized.coupons,
      cashback: normalized.cashback,
      status: "ok",
      fetchedAt: Date.now(),
      error: entry ? null : "The source has no entry for this store.",
    };
  } catch (error) {
    return Object.assign({}, EMPTY, {
      status: "unreachable",
      error: "Could not reach the source: " + String((error && error.message) || error),
    });
  }
}
