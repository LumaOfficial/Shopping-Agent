// The cashback wallet. Amounts are integer minor units (cents), the same as
// prices everywhere else in the extension.
//
// A tracked visit is "pending" until the store's return window has passed; it
// then becomes "available" (cashable). Once a payout is issued the entries it
// covered become "paid", so the same cashback is never cashed twice.
export const HOLD_DAYS = 30;
export const MAX_ENTRIES = 200;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyWallet() {
  return { entries: [], payouts: [] };
}

// "4%", "4 %" and "4" all mean four percent. Anything outside 0–50% is not a
// cashback rate and is ignored rather than guessed at.
export function parseRate(rate) {
  const match = String(rate == null ? "" : rate).match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const percent = Number(match[1].replace(",", "."));
  if (!isFinite(percent) || percent <= 0 || percent > 50) return null;
  return percent;
}

export function estimate(total, rate) {
  const percent = parseRate(rate);
  if (!percent || typeof total !== "number" || !(total > 0)) return null;
  return Math.round((total * percent) / 100);
}

export function normalizeWallet(raw) {
  const wallet = raw && typeof raw === "object" ? raw : {};
  const entries = (Array.isArray(wallet.entries) ? wallet.entries : [])
    .filter((entry) => entry && typeof entry.amount === "number" && entry.amount > 0)
    .slice(0, MAX_ENTRIES);
  const payouts = (Array.isArray(wallet.payouts) ? wallet.payouts : []).filter(Boolean).slice(0, 40);
  return { entries, payouts };
}

// Pending entries become cashable once their hold has passed. Returns true when
// the wallet changed, so the caller knows to persist it.
export function settle(wallet, now) {
  const at = now || Date.now();
  let changed = false;
  wallet.entries.forEach((entry) => {
    if (entry.status === "pending" && entry.confirmAt && entry.confirmAt <= at) {
      entry.status = "available";
      changed = true;
    }
  });
  return changed;
}

// Records what the shopper's cart was worth at the rate the store published.
// Anything without a known total or rate is not recorded — the wallet never
// invents a figure.
export function addEarning(wallet, earning, now) {
  const at = now || Date.now();
  const amount = estimate(earning.total, earning.rate);
  if (!amount || !earning.storeId) return null;

  const entry = {
    id: "e_" + at.toString(36) + Math.random().toString(36).slice(2, 6),
    storeId: earning.storeId,
    storeName: earning.storeName || earning.storeId,
    rate: parseRate(earning.rate),
    total: earning.total,
    amount,
    currency: earning.currency || "USD",
    status: "pending",
    at,
    confirmAt: at + (earning.holdDays || HOLD_DAYS) * DAY_MS,
  };

  wallet.entries.unshift(entry);
  wallet.entries = wallet.entries.slice(0, MAX_ENTRIES);
  return entry;
}

// Sponsored offers pay a fixed amount the sponsor booked. One credit per offer,
// and the amount always comes from the sponsor — opening an ad never puts money
// in the wallet by itself.
export function addSponsoredEarning(wallet, earning, now) {
  const at = now || Date.now();
  const offerId = String((earning && earning.offerId) || "").trim();
  const amount = Math.round(Number(earning && earning.amount));
  if (!offerId || !isFinite(amount) || amount <= 0) return null;
  if (wallet.entries.some((entry) => entry.offerId === offerId)) return null;

  const status = earning.status === "available" ? "available" : "pending";
  const entry = {
    id: "s_" + at.toString(36) + Math.random().toString(36).slice(2, 6),
    offerId,
    storeId: "sponsored",
    storeName: String(earning.advertiser || "Sponsored offer").slice(0, 60),
    amount,
    currency: String(earning.currency || "USD").slice(0, 3).toUpperCase(),
    sponsored: true,
    status,
    at,
    confirmAt: status === "pending" ? Number(earning.confirmAt) || at + HOLD_DAYS * DAY_MS : null,
  };

  wallet.entries.unshift(entry);
  wallet.entries = wallet.entries.slice(0, MAX_ENTRIES);
  return entry;
}

export function balances(wallet) {
  const totals = { pending: 0, available: 0, paid: 0 };
  wallet.entries.forEach((entry) => {
    if (totals[entry.status] == null) return;
    totals[entry.status] += entry.amount;
  });
  return Object.assign(totals, { lifetime: totals.pending + totals.available + totals.paid });
}

// Marks every cashable entry as paid against one payout. The payout record is
// returned so the caller can store it with the wallet.
export function payOut(wallet, amount, currency, card, now) {
  const at = now || Date.now();
  wallet.entries.forEach((entry) => {
    if (entry.status !== "available") return;
    entry.status = "paid";
    entry.payoutId = card.reference;
  });
  const payout = {
    id: card.reference,
    amount,
    currency: currency || "USD",
    at,
    card: {
      brand: card.brand || "Visa",
      last4: card.last4 || null,
      expiresAt: card.expiresAt || null,
      redeemUrl: card.redeemUrl || null,
      reference: card.reference,
    },
  };
  wallet.payouts.unshift(payout);
  wallet.payouts = wallet.payouts.slice(0, 40);
  return payout;
}
