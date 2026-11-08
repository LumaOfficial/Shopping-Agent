// Every user-facing mention of the connected services goes through here, so the
// UI never names a partner brand.
export const PARTNER_LABEL = "Partner Platforms";

// The operator sets a member count in Options once the number can be
// substantiated. Left empty nothing numeric is shown — the extension must not
// print a figure it cannot back up.
export function partnerSummary(members) {
  const clean = String(members || "").trim();
  if (!clean) return `Coupons, cashback and price data from ${PARTNER_LABEL}.`;
  return `Coupons, cashback and price data from ${PARTNER_LABEL} — ${clean}+ members combined.`;
}

// Codes are read from the page the shopper is already on, so nothing has to be
// connected first. No bundled examples: a code the store never issued is worse
// than no code.
export const PAGE_SOURCE_NOTE =
  "Codes are read automatically from the page you are shopping — no API or key needed. Stores often publish them in the cart, a banner or their deals page.";
