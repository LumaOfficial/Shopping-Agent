// The deals rail: partner offers paired with the product that qualifies for
// them. Presentational only — the pairing, the price and the copy all come from
// deals.js; this file lays them out and hands each tap back to the panel.
import { DEALS_UPDATED, matchDeals, offerLines, productUrl } from "./deals.js";
import { STORES } from "./stores.js";
import { storeSite } from "./store-directory.js";

// Cards at a time. The whole feed is one list, so each pass turns it over
// instead of re-pairing anything.
const SHOW = 4;
// How long a set of cards stays before the rail turns itself over. Hovering or
// focusing the rail holds it, so a shopper reading a card is never interrupted.
const ROTATE_MS = 8000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function checkedLabel() {
  const date = new Date(DEALS_UPDATED + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return "";
  return MONTHS[date.getUTCMonth()] + " " + date.getUTCDate();
}

function card(offer, index, storeName, shop) {
  const lines = offerLines(offer);

  const article = document.createElement("article");
  article.className = "deal";
  article.style.animationDelay = index * 60 + "ms";

  const top = document.createElement("div");
  top.className = "deal-top";
  const store = document.createElement("span");
  store.className = "deal-store";
  store.textContent = storeName;
  const tag = document.createElement("span");
  tag.className = "deal-tag";
  tag.textContent = lines.label;
  top.append(store, tag);

  const name = document.createElement("p");
  name.className = "deal-name";
  name.textContent = lines.title;

  const row = document.createElement("div");
  row.className = "deal-row";
  const price = document.createElement("strong");
  price.className = "deal-price";
  price.textContent = lines.price;
  row.appendChild(price);
  if (lines.savings) {
    const save = document.createElement("span");
    save.className = "deal-save";
    save.textContent = "≈ " + lines.savings + " off";
    row.appendChild(save);
  }

  const note = document.createElement("p");
  note.className = "deal-note";
  note.textContent = lines.note;

  const go = document.createElement("button");
  go.type = "button";
  go.className = "deal-go";
  go.textContent = "Shop it at " + storeName;
  go.addEventListener("click", () => shop(offer));

  const terms = document.createElement("p");
  terms.className = "deal-terms";
  terms.textContent = lines.terms + " · list price, " + checkedLabel();

  article.append(top, name, row, note, go, terms);
  return article;
}

export function startDealsFeed({ feed, shuffleButton, count, shop }) {
  if (!feed) return;

  // The rail keeps itself current: every pass re-reads the feed, so an offer
  // that has just expired leaves it and the next set of cards arrives without
  // the shopper tapping anything. Shuffle is still there for an immediate turn.
  let offers = matchDeals();
  let start = 0;
  let timer = null;
  let held = false;

  const motion =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  function slow() {
    return Boolean(motion && motion.matches);
  }

  function nameOf(offer) {
    const store = STORES.find((entry) => entry.id === offer.deal.store);
    return store ? store.name : offer.deal.store;
  }

  function link(offer) {
    const store = STORES.find((entry) => entry.id === offer.deal.store);
    return productUrl(offer.product) || (store ? storeSite(store) : "");
  }

  function paint() {
    feed.textContent = "";
    feed.hidden = offers.length === 0;
    if (count) count.textContent = String(offers.length);
    if (!offers.length) return;
    const shown = Math.min(SHOW, offers.length);
    for (let step = 0; step < shown; step += 1) {
      const offer = offers[(start + step) % offers.length];
      feed.appendChild(card(offer, step, nameOf(offer), (picked) => shop(link(picked))));
    }
  }

  function stop() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  // Turn the rail over: move the window on, then re-read the feed so the cards
  // drawn are the ones that are still live.
  function turn() {
    const shown = Math.min(SHOW, offers.length);
    offers = matchDeals();
    if (offers.length) start = (start + shown) % offers.length;
    paint();
    schedule();
  }

  function schedule() {
    if (timer || held || document.hidden || slow() || offers.length <= SHOW) return;
    timer = setTimeout(() => {
      timer = null;
      turn();
    }, ROTATE_MS);
  }

  function hold() {
    held = true;
    stop();
  }

  function release() {
    held = false;
    schedule();
  }

  paint();
  schedule();

  // A shopper reading or tabbing through a card is never interrupted, a hidden
  // panel does not churn, and a reduced-motion preference leaves the rail still
  // until it is tapped.
  feed.addEventListener("pointerenter", hold);
  feed.addEventListener("pointerleave", release);
  feed.addEventListener("focusin", hold);
  feed.addEventListener("focusout", release);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : schedule()));
  if (motion) {
    const onChange = () => (slow() ? stop() : schedule());
    if (typeof motion.addEventListener === "function") motion.addEventListener("change", onChange);
    else if (typeof motion.addListener === "function") motion.addListener(onChange);
  }

  if (shuffleButton) {
    shuffleButton.title = "New deals every few seconds";
    shuffleButton.addEventListener("click", () => {
      stop();
      turn();
    });
  }
}
