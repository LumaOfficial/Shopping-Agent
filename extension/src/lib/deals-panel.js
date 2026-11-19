// The deals rail: partner offers paired with the product that qualifies for
// them. Presentational only — the pairing, the ranking and the copy all come
// from deals.js; this file lays them out and hands each tap back to the panel.
//
// The worker ranks the feed for the shops this profile uses (deals:feed), and
// the bundled ranking is drawn first so the card is never empty while it answers.
import { DEALS_UPDATED, matchDeals, offerLines, productUrl, rankDeals } from "./deals.js";
import { STORES, hostsOf } from "./stores.js";
import { storeSite } from "./store-directory.js";
import { initials } from "./brand-marks.js";

// Cards at a time under the lead card. The whole feed is one list, so each pass
// turns it over instead of re-pairing anything.
const SHOW = 4;
// How long a set of cards stays before the rail turns itself over. Hovering or
// focusing the rail holds it, so a shopper reading a card is never interrupted.
const ROTATE_MS = 8000;
// The worker's ranking is re-read at most this often while the panel is open.
const RELOAD_MS = 45000;
// Category chips beside the rail: the ones carrying the most offers.
const FILTERS = 5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function checkedLabel() {
  const date = new Date(DEALS_UPDATED + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return "";
  return MONTHS[date.getUTCMonth()] + " " + date.getUTCDate();
}

function prettyCategory(key) {
  if (key === "tv") return "TV";
  const text = String(key || "");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function hue(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum = (sum * 31 + name.charCodeAt(i)) % 360;
  return sum;
}

// The store's own mark at card size, with its initials underneath so a blocked
// or missing image still reads as that store.
function mark(storeId, storeName) {
  const wrap = document.createElement("span");
  wrap.className = "deal-mark";
  wrap.style.setProperty("--hue", String(hue(storeName)));
  const store = STORES.find((entry) => entry.id === storeId);
  if (store) {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.src =
      "https://www.google.com/s2/favicons?domain=" +
      encodeURIComponent(hostsOf(store)[0]) +
      "&sz=64";
    img.addEventListener("error", () => img.remove());
    wrap.appendChild(img);
  }
  const fallback = document.createElement("span");
  fallback.className = "deal-mark-fallback";
  fallback.textContent = initials(storeName);
  wrap.appendChild(fallback);
  return wrap;
}

function nameOf(offer) {
  const store = STORES.find((entry) => entry.id === offer.deal.store);
  return store ? store.name : offer.deal.store;
}

function link(offer) {
  const store = STORES.find((entry) => entry.id === offer.deal.store);
  return productUrl(offer.product) || (store ? storeSite(store) : "");
}

function card(offer, index, shop, lead) {
  const lines = offerLines(offer);
  const storeName = nameOf(offer);

  const article = document.createElement("article");
  article.className = lead ? "deal deal-lead" : "deal";
  article.style.animationDelay = index * 60 + "ms";

  if (lead) {
    const eyebrow = document.createElement("p");
    eyebrow.className = "deal-eyebrow";
    eyebrow.textContent = "Top pick";
    article.appendChild(eyebrow);
  }

  const top = document.createElement("div");
  top.className = "deal-top";
  top.append(mark(offer.deal.store, storeName));
  const store = document.createElement("span");
  store.className = "deal-store";
  store.textContent = storeName;
  top.appendChild(store);
  if (offer.affinity && offer.affinity.store >= 2) {
    const own = document.createElement("span");
    own.className = "deal-own";
    own.textContent = "You shop here";
    top.appendChild(own);
  }
  const tag = document.createElement("span");
  tag.className = "deal-tag";
  tag.textContent = lines.label;
  top.appendChild(tag);

  const name = document.createElement("p");
  name.className = "deal-name";
  name.textContent = lines.title;

  const row = document.createElement("div");
  row.className = "deal-row";
  const price = document.createElement("strong");
  price.className = "deal-price";
  price.textContent = lines.pay || lines.price;
  row.appendChild(price);
  if (lines.pay) {
    const was = document.createElement("span");
    was.className = "deal-was";
    was.textContent = lines.price;
    row.appendChild(was);
  }
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
  go.addEventListener("click", () => shop(link(offer)));

  const terms = document.createElement("p");
  terms.className = "deal-terms";
  terms.textContent = lines.terms + " · list price, " + checkedLabel();

  article.append(top, name, row, note, go, terms);
  return article;
}

export function startDealsFeed({ feed, featured, filters, shuffleButton, count, shop, load }) {
  if (!feed) return;

  // The bundled ranking is what the first frame shows; the worker's answer
  // replaces it a moment later with the shops this profile actually uses first.
  let offers = rankDeals(matchDeals(), null);
  let start = 0;
  let category = "all";
  let timer = null;
  let held = false;
  let loading = false;
  let loadedAt = 0;

  const motion =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  function slow() {
    return Boolean(motion && motion.matches);
  }

  function visible() {
    if (category === "all") return offers;
    return offers.filter((offer) => offer.product && offer.product.category === category);
  }

  // The lead card is the best-ranked offer, so the rail turns over what is left.
  function rest() {
    return visible().slice(1);
  }

  function paint() {
    const list = visible();
    feed.textContent = "";
    if (featured) featured.textContent = "";
    if (count) count.textContent = String(list.length);
    if (!list.length) {
      if (featured) featured.hidden = true;
      feed.hidden = true;
      return;
    }
    if (featured) {
      featured.hidden = false;
      featured.appendChild(card(list[0], 0, shop, true));
    }
    const others = list.slice(1);
    feed.hidden = others.length === 0;
    const shown = Math.min(SHOW, others.length);
    for (let step = 0; step < shown; step += 1) {
      feed.appendChild(card(others[(start + step) % others.length], step, shop, false));
    }
  }

  function buildFilters() {
    if (!filters) return;
    const counts = new Map();
    offers.forEach((offer) => {
      const key = offer.product && offer.product.category;
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, FILTERS)
      .map(([key, total]) => ({ key, total }));
    const known = new Set(top.map((row) => row.key));
    if (category !== "all" && !known.has(category)) category = "all";

    filters.textContent = "";
    [{ key: "all", label: "All", total: offers.length }]
      .concat(top.map((row) => ({ key: row.key, label: prettyCategory(row.key), total: row.total })))
      .forEach((row) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip filter";
        button.dataset.category = row.key;
        button.textContent = row.label;
        button.setAttribute("aria-pressed", String(row.key === category));
        filters.appendChild(button);
      });
    filters.hidden = offers.length === 0;
  }

  async function refresh() {
    if (loading || typeof load !== "function") return false;
    if (Date.now() - loadedAt < RELOAD_MS) return false;
    loading = true;
    try {
      const payload = await load();
      if (payload && Array.isArray(payload.offers)) {
        offers = payload.offers;
        loadedAt = Date.now();
        buildFilters();
        return true;
      }
    } catch (_error) {
      // The bundled ranking is already on screen; a worker that cannot answer
      // does not empty the rail.
    } finally {
      loading = false;
    }
    return false;
  }

  function stop() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  // Turn the rail over: move the window on, then take the worker's newer answer
  // so an offer that has just expired leaves with the next set of cards.
  async function turn() {
    stop();
    const before = rest().length;
    await refresh();
    const after = rest().length;
    if (after) start = (start + Math.max(1, Math.min(SHOW, before || after))) % after;
    paint();
    schedule();
  }

  function schedule() {
    if (timer || held || document.hidden || slow() || rest().length <= 0) return;
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

  buildFilters();
  paint();
  schedule();

  // A shopper reading or tabbing through a card is never interrupted, a hidden
  // panel does not churn, and a reduced-motion preference leaves the rail still
  // until it is tapped.
  feed.addEventListener("pointerenter", hold);
  feed.addEventListener("pointerleave", release);
  feed.addEventListener("focusin", hold);
  feed.addEventListener("focusout", release);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
      return;
    }
    // Coming back to the panel is the moment a new shop visit may have changed
    // the ranking, so the guard is cleared for this one read.
    loadedAt = 0;
    refresh().then((changed) => {
      if (changed) paint();
      schedule();
    });
  });
  if (motion) {
    const onChange = () => (slow() ? stop() : schedule());
    if (typeof motion.addEventListener === "function") motion.addEventListener("change", onChange);
    else if (typeof motion.addListener === "function") motion.addListener(onChange);
  }

  if (filters) {
    filters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-category]");
      if (!button) return;
      category = button.dataset.category || "all";
      start = 0;
      Array.from(filters.children).forEach((chip) => {
        chip.setAttribute("aria-pressed", String(chip === button));
      });
      paint();
      stop();
      schedule();
    });
  }

  if (shuffleButton) {
    shuffleButton.title = "New deals every few seconds";
    shuffleButton.addEventListener("click", () => {
      stop();
      turn();
    });
  }

  refresh().then((changed) => {
    if (changed) {
      paint();
      schedule();
    }
  });
}
