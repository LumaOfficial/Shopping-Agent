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

// Shown wherever the panel would otherwise have codes to show and has none. No
// bundled examples: a code the store never issued is worse than no code.
export const NO_SOURCE_NOTE =
  "No coupon source is connected, so no codes are shown. Connect your authorized offer feed in Settings, or save a code you have.";
