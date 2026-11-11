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

export function normalizeCurrency(currency) {
  const code = String(currency || "USD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "USD";
}

function entryCurrency(entry) {
  return normalizeCurrency(entry && entry.currency);
}

// Money in different currencies is never added together. The wallet works in
// the currency that holds the most unpaid cashback.
export function walletCurrency(wallet) {
  const entries = ((wallet && wallet.entries) || []).filter(
    (entry) => entry && typeof entry.amount === "number"
  );
  const totals = new Map();
  entries.forEach((entry) => {
    if (entry.status === "paid") return;
    const code = entryCurrency(entry);
    totals.set(code, (totals.get(code) || 0) + entry.amount);
  });
  let best = null;
  let bestTotal = -1;
  totals.forEach((amount, code) => {
    if (amount > bestTotal) {
      best = code;
      bestTotal = amount;
    }
  });
  // Everything paid out: keep reporting the currency of the last payout.
  if (!best) return entries.length ? entryCurrency(entries[0]) : "USD";
  return best;
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
// invents a figure. An age verification boost, when the account holds one, is
// added to this earning only, and is kept as its own figure so the panel can
// say where the extra came from.
export function addEarning(wallet, earning, now) {
  const at = now || Date.now();
  const base = estimate(earning.total, earning.rate);
  if (!base || !earning.storeId) return null;
  const boost = Math.max(0, Math.round(base * (Number(earning.boost) || 0)));

  const entry = {
    id: "e_" + at.toString(36) + Math.random().toString(36).slice(2, 6),
    storeId: earning.storeId,
    storeName: earning.storeName || earning.storeId,
    rate: parseRate(earning.rate),
    total: earning.total,
    base,
    boost,
    amount: base + boost,
    currency: normalizeCurrency(earning.currency),
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
    currency: normalizeCurrency(earning.currency),
    sponsored: true,
    status,
    at,
    confirmAt: status === "pending" ? Number(earning.confirmAt) || at + HOLD_DAYS * DAY_MS : null,
  };

  wallet.entries.unshift(entry);
  wallet.entries = wallet.entries.slice(0, MAX_ENTRIES);
  return entry;
}

// Totals for one currency (the wallet's own when none is given), so euros and
// dollars are never added together.
export function balances(wallet, currency) {
  const want = normalizeCurrency(currency || walletCurrency(wallet));
  const totals = { pending: 0, available: 0, paid: 0 };
  wallet.entries.forEach((entry) => {
    if (totals[entry.status] == null) return;
    if (entryCurrency(entry) !== want) return;
    totals[entry.status] += entry.amount;
  });
  return Object.assign(totals, {
    lifetime: totals.pending + totals.available + totals.paid,
    currency: want,
  });
}

// Marks cashable entries in the payout's currency as paid. Entries in another
// currency are left alone — that money has not been paid out.
export function payOut(wallet, amount, currency, card, now) {
  const at = now || Date.now();
  const want = normalizeCurrency(currency);
  wallet.entries.forEach((entry) => {
    if (entry.status !== "available" || entryCurrency(entry) !== want) return;
    entry.status = "paid";
    entry.payoutId = card.reference;
  });
  const payout = {
    id: card.reference,
    amount,
    currency: want,
    at,
    card: {
      brand: card.brand || "Visa",
      last4: card.last4 || null,
      expiresAt: card.expiresAt || null,
      redeemUrl: card.redeemUrl || null,
      reference: card.reference,
      preview: Boolean(card.preview),
    },
  };
  wallet.payouts.unshift(payout);
  wallet.payouts = wallet.payouts.slice(0, 40);
  return payout;
}
