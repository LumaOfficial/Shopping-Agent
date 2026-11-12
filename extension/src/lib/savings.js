// The two things a page writes into the local savings record — a code tried in a
// store's own promo field, and confirmed cashback landing in the wallet — happen
// from the panel, and the figures behind them are read on Settings. One module
// keeps both surfaces folding the same money into the same days, once each.
import { recordAttempt as bumpAttempt, readActivity, saveActivity, syncEarnings } from "./goals.js";

export function readSavings() {
  return readActivity();
}

// One code was tried in the store's promo field, and possibly accepted.
export async function noteAttempt(applied) {
  const activity = await readActivity();
  return saveActivity(bumpAttempt(activity, applied));
}

// Earnings fold into the day they were earned, once each, by wallet entry id.
export async function absorbWallet(wallet) {
  const activity = await readActivity();
  if (!wallet || !Array.isArray(wallet.entries)) return activity;
  const synced = syncEarnings(activity, wallet.entries);
  if (!synced.added) return activity;
  return saveActivity(synced);
}
