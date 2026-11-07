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
  const headers = { accept: "application/json" };
  if (settings.feedKey) headers.authorization = "Bearer " + settings.feedKey;
  const endpoint = settings.feedUrl.split("{store}").join(encodeURIComponent(store.id));
  const response = await fetch(endpoint, { headers });
  if (!response.ok) throw new Error("offer feed returned HTTP " + response.status);
  const payload = await response.json();
  const entry = Array.isArray(payload)
    ? payload.find((item) => item && item.store === store.id)
    : (payload.stores && payload.stores[store.id]) || payload;
  return { ...normalizeOffer(entry, "live"), note: "" };
}

export async function getOffers(store, settings) {
  if (settings.feedUrl) {
    try {
      return await fromFeed(store, settings);
    } catch (error) {
      console.warn("[savings] offer feed failed:", error);
    }
  }

  const sample = await loadSample();
  const entry = (sample.stores && sample.stores[store.id]) || null;
  return {
    ...normalizeOffer(entry, "demo"),
    note: settings.feedUrl
      ? "Offer feed unavailable — showing demo catalog."
      : DEMO_NOTE,
  };
}
