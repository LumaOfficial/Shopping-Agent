// Offer connector. Coupons and cashback rates arrive as one normalized payload,
// either from a live offer feed the operator configures (the aggregator side of
// the Partner Platforms) or from the bundled demo catalog.
import { DEMO_NOTE } from "../lib/copy.js";

let samplePromise = null;

function loadSample() {
  if (!samplePromise) {
    samplePromise = fetch(chrome.runtime.getURL("src/data/sample-offers.json")).then((response) =>
      response.json()
    );
  }
  return samplePromise;
}

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

function normalizeCoupon(raw) {
  if (!raw) return null;
  const code = String(raw.code || raw.couponCode || "").trim();
  if (!code) return null;
  return {
    code,
    title: String(raw.title || raw.description || "").trim() || null,
    expires: raw.expires || null,
  };
}

export function normalizeOffer(entry, source) {
  const coupons = (entry && Array.isArray(entry.coupons) ? entry.coupons : [])
    .map(normalizeCoupon)
    .filter(Boolean);
  const cashback = entry && entry.cashback ? entry.cashback : null;
  return {
    coupons,
    cashback: cashback
      ? { rate: cashback.rate || null, url: cashback.url || null, trackingUrl: cashback.trackingUrl || null }
      : null,
    source,
  };
}

async function fromFeed(store, settings) {
  const response = await fetch(feedEndpoint(settings.feedUrl, store.id), {
    headers: feedHeaders(settings),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("the source rejected the credentials (HTTP " + response.status + ")");
  }
  if (!response.ok) throw new Error("offer feed returned HTTP " + response.status);
  const payload = await response.json();
  const entry = Array.isArray(payload)
    ? payload.find((item) => item && item.store === store.id)
    : (payload.stores && payload.stores[store.id]) || payload;
  return { ...normalizeOffer(entry, "live"), note: "", fetchedAt: Date.now() };
}

export async function getOffers(store, settings) {
  if (settings.feedUrl) {
    try {
      return await fromFeed(store, settings);
    } catch (error) {
      console.warn("[savings] offer feed failed:", error);
      return {
        ...(await demoOffers(store, settings)),
        note: "Authorized source unavailable (" + String(error.message || error) + ") — showing demo catalog.",
      };
    }
  }

  return demoOffers(store, settings);
}

async function demoOffers(store, settings) {
  const sample = await loadSample();
  const entry = (sample.stores && sample.stores[store.id]) || null;
  return {
    ...normalizeOffer(entry, "demo"),
    fetchedAt: Date.now(),
    note: settings.feedUrl ? "Offer feed unavailable — showing demo catalog." : DEMO_NOTE,
  };
}
