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

export const DEMO_NOTE =
  "Demo catalog: these codes are examples, not live offers. Connect an offer feed in Settings for real ones.";
