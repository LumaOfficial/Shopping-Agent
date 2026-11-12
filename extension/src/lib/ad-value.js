// What a blocked ad was worth. Every ad slot is one impression the advertiser
// paid for; blocking it takes that value off the page, so the panel shows the
// money rather than a coin count. This file is the only place the rate lives.
//
// The rate is ours to set. DEFAULT_CENTS_PER_PACK is what one pack of
// ADS_PER_PACK impressions is worth unless the operator says otherwise, and
// Settings (Developer) moves it as the programmes that pay for the impressions
// change. No two slots are worth the same either, so a report arrives as slots
// and is counted in units: a small strip is a fraction of an impression, a large
// format or a long video a multiple of one.
import { money } from "./format.js";

// The going rate for display impressions, in the packs advertisers buy.
export const ADS_PER_PACK = 5;
export const DEFAULT_CENTS_PER_PACK = 3;
export const MIN_CENTS_PER_PACK = 1;
export const MAX_CENTS_PER_PACK = 500;

// The ceiling on what can be claimed. Ad value is money in the wallet, and the
// count arrives from a page, so the rate alone is not enough: a page that fills
// itself with fake slots must not be able to mint a balance. One report is a
// page load; one tab and one day are the two ceilings above it.
export const MAX_ADS_PER_REPORT = 200;
export const MAX_ADS_PER_TAB = 600;
export const MAX_ADS_PER_DAY = 2000;

// The most one slot can be worth, whatever it claims to be.
export const MAX_UNITS_PER_SLOT = 2.5;

const DEFAULT_RATE = { cents: DEFAULT_CENTS_PER_PACK, ads: ADS_PER_PACK };

function figure(value) {
  const number = Number(value);
  return isFinite(number) && number > 0 ? number : 0;
}

// What one slot counts for. Area reads the format an advertiser buys — a strip
// banner is worth less than a rectangle, a large format more — and a video that
// runs longer than a display notice pays more again.
export function unitsOfSlot(slot) {
  const source = slot && typeof slot === "object" ? slot : {};
  const area = figure(source.width) * figure(source.height);
  let units = 0.5;
  if (area >= 160000) units = 1.5;
  else if (area >= 60000) units = 1;
  else if (area >= 20000) units = 0.75;
  if (source.video === true) units = Math.max(units, figure(source.seconds) >= 20 ? 2 : 1.2);
  return Math.min(MAX_UNITS_PER_SLOT, units);
}

export function unitsFor(slots) {
  if (!Array.isArray(slots)) return 0;
  return slots.reduce((sum, slot) => sum + unitsOfSlot(slot), 0);
}

// The rate the operator has set, or the default when nothing usable is stored.
export function rateOf(settings) {
  const cents = Math.round(Number(settings && settings.adRateCents));
  const usable = isFinite(cents) && cents >= MIN_CENTS_PER_PACK && cents <= MAX_CENTS_PER_PACK;
  return { cents: usable ? cents : DEFAULT_CENTS_PER_PACK, ads: ADS_PER_PACK };
}

export function rateLabel(rate) {
  const safe = rate && rate.ads ? rate : DEFAULT_RATE;
  return money(safe.cents) + " per " + safe.ads + " ads";
}

// Whole cents, so the figure a shopper sees is one an advertiser would quote.
export function valueOf(units, rate) {
  const safe = rate && rate.ads ? rate : DEFAULT_RATE;
  return Math.round((Math.max(0, Number(units) || 0) * safe.cents) / safe.ads);
}

export function dayKey(now) {
  const date = new Date(typeof now === "number" ? now : Date.now());
  return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
}

export function emptyRecord(now) {
  return { total: 0, units: 0, day: dayKey(now), dayCount: 0, dayUnits: 0, updatedAt: 0 };
}

export function normalizeRecord(stored, now) {
  const record = Object.assign(emptyRecord(now), stored || {});
  record.total = Math.max(0, Math.round(Number(record.total) || 0));
  record.units = Math.max(0, Number(record.units) || 0);
  record.dayCount = Math.max(0, Math.round(Number(record.dayCount) || 0));
  record.dayUnits = Math.max(0, Number(record.dayUnits) || 0);
  return record;
}

// Adds a page's counted ads and their worth to the running total, rolling the
// day over so "today" always means today.
export function addAds(record, count, units, now) {
  const added = Math.max(0, Math.round(Number(count) || 0));
  if (!added) return record;
  const worth = Math.max(0, Math.min(Number(units) || 0, added * MAX_UNITS_PER_SLOT));
  const today = dayKey(now);
  if (record.day !== today) {
    record.day = today;
    record.dayCount = 0;
    record.dayUnits = 0;
  }
  record.total += added;
  record.units += worth;
  record.dayCount += added;
  record.dayUnits += worth;
  record.updatedAt = typeof now === "number" ? now : Date.now();
  return record;
}

// Credits a report only as far as the day's ceiling allows, and says how much
// was actually credited so the caller can keep its own per-page count honest.
export function creditAds(record, count, units, now) {
  const requested = Math.max(0, Math.min(Math.round(Number(count) || 0), MAX_ADS_PER_REPORT));
  const today = dayKey(now);
  const used = record.day === today ? record.dayCount : 0;
  const granted = Math.max(0, Math.min(requested, MAX_ADS_PER_DAY - used));
  if (granted > 0) {
    // The worth a report claims is spread over its slots, so a part of a report
    // carries its share of that worth rather than all of it.
    const perAd = requested > 0 ? Math.min(Math.max(0, Number(units) || 0) / requested, MAX_UNITS_PER_SLOT) : 1;
    addAds(record, granted, perAd * granted, now);
  }
  return { granted, record };
}

export function summaryOf(record, now, rate) {
  const safe = normalizeRecord(record, now);
  const sameDay = safe.day === dayKey(now);
  const today = sameDay ? safe.dayCount : 0;
  const todayUnits = sameDay ? safe.dayUnits : 0;
  return {
    total: safe.total,
    today,
    value: valueOf(safe.units, rate),
    todayValue: valueOf(todayUnits, rate),
  };
}
