// Autopilot: the rules for saving without anyone asking. The background worker
// decides when a page is a checkout, which codes are worth entering, and what to
// do with the store's answer, so the panel never has to be open for a code to be
// tried. Both the worker and the panel read these rules from here.
import { isExpired } from "./codes.js";

// One pass tries three codes at most: a store's promo box usually keeps the
// first code it takes, and a shopper watching a checkout should not see a queue
// of attempts.
export const AUTOPILOT_LIMIT = 3;

// The cart and checkout steps live at a path segment of their own, so a query
// string or a product slug that happens to say "order" is not mistaken for one.
const CHECKOUT_RE = /(^|\/)(cart|basket|checkout|order|payment)(\/|$)/;

export function looksLikeCheckout(url) {
  try {
    return CHECKOUT_RE.test(new URL(url).pathname.toLowerCase());
  } catch (_error) {
    return false;
  }
}

// The codes worth entering automatically: live ones only, best source first
// (mergeCodes has already ranked them), and never one this store already
// refused. Anything the shopper marked dead stays dead until they restore it.
export function autopilotQueue(codes, dead, limit) {
  const refused = new Set(
    (Array.isArray(dead) ? dead : []).map((entry) => String(entry || "").toUpperCase())
  );
  const max = typeof limit === "number" ? limit : AUTOPILOT_LIMIT;
  const seen = new Set();
  return (Array.isArray(codes) ? codes : [])
    .filter((coupon) => coupon && coupon.code && !isExpired(coupon))
    .filter((coupon) => {
      const code = String(coupon.code).toUpperCase();
      if (refused.has(code) || seen.has(code)) return false;
      seen.add(code);
      return true;
    })
    .slice(0, max);
}

// What the panel says once a pass is over. The worker reports the outcome, the
// panel prints it, and neither invents a saving the store did not confirm.
export function autopilotMessage(result) {
  const outcome = result || {};
  if (outcome.status === "applied") {
    return {
      tone: "ok",
      text: outcome.code + " entered at checkout — " + (outcome.message || "the store took it."),
    };
  }
  if (outcome.status === "no-field") {
    return { tone: "wait", text: "No coupon field on this screen — open your cart or checkout." };
  }
  if (outcome.status === "none") {
    return { tone: "wait", text: "No code is known for this store yet — one will be saved the next time it works." };
  }
  const tried = Number(outcome.tried) || 0;
  return {
    tone: "wait",
    text:
      "Tried " + tried + " code" + (tried === 1 ? "" : "s") +
      " at checkout — none were accepted. You can still try another below.",
  };
}
