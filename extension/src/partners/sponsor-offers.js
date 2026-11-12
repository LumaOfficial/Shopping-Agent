// Sponsored offers — the "earn extra" slice. Advertisers and the money they pay
// come from the sponsor service the operator configures. The extension never
// values a visit itself and never invents an advertiser: the sponsor decides
// what, if anything, a sponsored visit is worth.
//
//   GET  <sponsorUrl>                         — the offers to show
//   -> { "offers": [ { "id": "ad_12", "advertiser": "Nordic Outdoors",
//                      "title": "New season", "reward": 25, "currency": "USD",
//                      "url": "https://…", "expiresAt": "2026-12-01" } ] }
//   `reward` is in minor units, like every other amount in the extension.
//
//   POST <sponsorUrl> { "offerId": "ad_12" }  — the sponsor books the visit
//   -> { "amount": 25, "currency": "USD", "status": "pending",
//        "confirmAt": 1767225600000 }
//   A reply without a positive amount pays nothing, and the panel says so.

import { webUrl } from "../lib/guard.js";

const EMPTY = { offers: [], status: "unconfigured", error: null };

export function sponsorConfigured(settings) {
  return Boolean(String((settings && settings.sponsorUrl) || "").trim());
}

function sponsorHeaders(settings) {
  const headers = { accept: "application/json", "content-type": "application/json" };
  const key = String((settings && settings.sponsorKey) || "").trim();
  if (key) headers.authorization = "Bearer " + key;
  return headers;
}

function isExpired(offer, now) {
  if (!offer.expiresAt) return false;
  const at = Date.parse(offer.expiresAt);
  return isFinite(at) && at < (now || Date.now());
}

export function normalizeOffer(raw) {
  if (!raw) return null;
  const id = String(raw.id || raw.offerId || "").trim().slice(0, 64);
  // The sponsor is a remote service, so its link goes through the same guard a
  // feed's address does: a real http(s) address this browser may visit, never a
  // string that only starts with one.
  const url = webUrl(raw.url || raw.link);
  const reward = Math.round(Number(raw.reward || raw.amount || 0));
  if (!id || !url || !isFinite(reward) || reward <= 0) return null;
  return {
    id,
    advertiser: String(raw.advertiser || raw.brand || "Sponsored").slice(0, 60),
    title: String(raw.title || raw.description || "").slice(0, 140),
    reward,
    currency: String(raw.currency || "USD").slice(0, 3).toUpperCase(),
    url,
    expiresAt: raw.expiresAt || null,
  };
}

export async function getSponsoredOffers(settings) {
  if (!sponsorConfigured(settings)) return Object.assign({}, EMPTY);

  try {
    const response = await fetch(String(settings.sponsorUrl).trim(), {
      headers: sponsorHeaders(settings),
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      return Object.assign({}, EMPTY, {
        status: "denied",
        error: "The sponsor service rejected the credentials (HTTP " + response.status + ").",
      });
    }
    if (!response.ok) {
      return Object.assign({}, EMPTY, {
        status: "error",
        error: "The sponsor service answered HTTP " + response.status + ".",
      });
    }
    const payload = await response.json();
    const now = Date.now();
    const offers = (Array.isArray(payload && payload.offers) ? payload.offers : [])
      .map(normalizeOffer)
      .filter((offer) => offer && !isExpired(offer, now));
    return { offers, status: "ok", error: null };
  } catch (error) {
    return Object.assign({}, EMPTY, {
      status: "unreachable",
      error: "Could not reach the sponsor service: " + String((error && error.message) || error),
    });
  }
}

// The sponsor's answer is the only thing that can put money in the wallet.
export async function claimOffer(settings, offerId) {
  const id = String(offerId || "").trim();
  if (!sponsorConfigured(settings)) return { ok: false, error: "No sponsor service is connected." };
  if (!id) return { ok: false, error: "That offer is no longer available." };

  try {
    const response = await fetch(String(settings.sponsorUrl).trim(), {
      method: "POST",
      headers: sponsorHeaders(settings),
      cache: "no-store",
      body: JSON.stringify({ offerId: id }),
    });
    if (!response.ok) {
      return { ok: false, error: "The sponsor service answered HTTP " + response.status + "." };
    }
    const payload = (await response.json()) || {};
    const amount = Math.round(Number(payload.amount || 0));
    if (!isFinite(amount) || amount <= 0) {
      return { ok: false, error: "The sponsor did not book a reward for this visit." };
    }
    return {
      ok: true,
      earning: {
        offerId: id,
        amount,
        currency: String(payload.currency || "USD").slice(0, 3).toUpperCase(),
        status: payload.status === "available" ? "available" : "pending",
        confirmAt: Number(payload.confirmAt) || null,
      },
    };
  } catch (error) {
    return { ok: false, error: "Could not reach the sponsor service: " + String((error && error.message) || error) };
  }
}
