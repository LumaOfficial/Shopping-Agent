// What a blocked ad was worth. Every ad slot is one impression the advertiser
// paid for; blocking it takes that value off the page, so the panel shows the
// money rather than a coin count. This file is the only place the rate lives.
import { money } from "./format.js";

// The going rate for a display impression, in the packs advertisers buy.
export const ADS_PER_PACK = 5;
export const CENTS_PER_PACK = 3;

export function rateLabel() {
  return money(CENTS_PER_PACK) + " per " + ADS_PER_PACK + " ads";
}

// Whole cents, so the figure a shopper sees is one an advertiser would quote.
export function valueOf(ads) {
  const count = Math.max(0, Number(ads) || 0);
  return Math.round((count * CENTS_PER_PACK) / ADS_PER_PACK);
}

export function dayKey(now) {
  const date = new Date(typeof now === "number" ? now : Date.now());
  return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
}

export function emptyRecord(now) {
  return { total: 0, day: dayKey(now), dayCount: 0, updatedAt: 0 };
}

export function normalizeRecord(stored, now) {
  const record = Object.assign(emptyRecord(now), stored || {});
  record.total = Math.max(0, Math.round(Number(record.total) || 0));
  record.dayCount = Math.max(0, Math.round(Number(record.dayCount) || 0));
  return record;
}

// Adds a page's counted ads to the running total, rolling the day over so
// "today" always means today.
export function addAds(record, count, now) {
  const added = Math.max(0, Math.round(Number(count) || 0));
  if (!added) return record;
  const today = dayKey(now);
  if (record.day !== today) {
    record.day = today;
    record.dayCount = 0;
  }
  record.total += added;
  record.dayCount += added;
  record.updatedAt = typeof now === "number" ? now : Date.now();
  return record;
}

export function summaryOf(record, now) {
  const safe = normalizeRecord(record, now);
  const today = safe.day === dayKey(now) ? safe.dayCount : 0;
  return {
    total: safe.total,
    today,
    value: valueOf(safe.total),
    todayValue: valueOf(today),
  };
}
