// The jump row under the quick actions: every view in the panel a tap away.
//
// Three kinds of shortcut share the row — the panel's own sections, the store
// categories the catalog holds, and two small views of their own: price movers
// (the watch list read like a ticker) and headlines (the deals feed read like a
// news list). *More* opens the sheet with the rest: every section, every
// category and the settings pages. Presentational only: it reads the catalog,
// the watch list and the deals feed, and hands each tap back to the panel.
import { STORES, storeById } from "./stores.js";
import { matchDeals, offerLines, productUrl } from "./deals.js";
import { priceMove, readWatch } from "./watchlist.js";
import { money } from "./format.js";

const byId = (id) => document.getElementById(id);

// Sections that are on screen whatever page the shopper is on.
const SECTIONS = [
  { label: "Deals", target: "deals-block" },
  { label: "Picks", target: "picks-block" },
  { label: "Categories", target: "category-block" },
  { label: "How it works", target: "how-block" },
  { label: "Your data", target: "trust-block" },
  { label: "FAQ", target: "faq-block" },
];

const PAGES = [
  { label: "Settings", path: "options.html" },
  { label: "My savings toolkit", path: "options.html#toolkit" },
  { label: "Card vault", path: "options.html#card-vault" },
  { label: "Support", path: "support.html" },
  { label: "Terms", path: "terms.html" },
  { label: "Privacy", path: "privacy.html" },
];

const CATEGORY_CHIPS = 8;
const HEADLINES = 10;

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

// Categories ordered by how much of the catalog they hold, so the row leads with
// the aisles that have the most stores behind them.
function categoriesByCount() {
  const counts = new Map();
  STORES.forEach((store) => counts.set(store.category, (counts.get(store.category) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function storeName(id) {
  const store = storeById(id);
  return store ? store.name : id;
}

function emptyNote(text) {
  const note = el("p", "qv-empty");
  note.textContent = text;
  return note;
}

export function startPanelJumps(handlers) {
  const row = byId("jumps");
  const view = byId("quick-view");
  const body = byId("qv-body");
  if (!row || !view || !body) return;

  const openStores = typeof handlers?.openStores === "function" ? handlers.openStores : () => {};
  const openCategory = typeof handlers?.openCategory === "function" ? handlers.openCategory : () => {};
  const shop = typeof handlers?.shop === "function" ? handlers.shop : () => {};
  const openPage = typeof handlers?.openPage === "function" ? handlers.openPage : () => {};

  const kickerEl = byId("qv-kicker");
  const titleEl = byId("qv-title");
  const noteEl = byId("qv-note");
  const closeEl = byId("qv-close");
  let opener = null;

  function close() {
    if (view.hidden) return;
    view.hidden = true;
    document.body.classList.remove("quick-view-open");
    if (opener && typeof opener.focus === "function") opener.focus();
    opener = null;
  }

  function openSheet(from, kicker, title, note, build) {
    opener = from || null;
    if (kickerEl) kickerEl.textContent = kicker;
    if (titleEl) titleEl.textContent = title;
    if (noteEl) {
      noteEl.textContent = note || "";
      noteEl.hidden = !note;
    }
    body.textContent = "";
    build(body);
    view.hidden = false;
    document.body.classList.add("quick-view-open");
    if (closeEl) closeEl.focus();
  }

  function jumpTo(target) {
    const block = byId(target);
    if (!block || block.hidden) return false;
    block.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  // A row in the sheet: what it is on the left, what it is worth on the right.
  function rowButton(onAct) {
    const button = el("button", "qv-row");
    button.type = "button";
    button.addEventListener("click", onAct);
    return button;
  }

  function moverRow(entry) {
    const row = rowButton(() => {
      close();
      if (entry.item.url) shop(entry.item.url);
      else openPage("options.html#toolkit");
    });
    const main = el("span", "qv-main");
    const name = el("strong");
    name.textContent = entry.item.title;
    const sub = el("small");
    sub.textContent =
      entry.item.storeName + " · saved at " + money(entry.item.saved, entry.item.currency);
    main.append(name, sub);

    const side = el("span", "qv-side");
    const change = el("b", entry.move > 0 ? "up" : entry.move < 0 ? "down" : "flat");
    change.textContent =
      entry.move === 0 ? "no move" : (entry.move > 0 ? "▲ " : "▼ ") + Math.abs(entry.pct).toFixed(0) + "%";
    const price = el("em");
    price.textContent = money(entry.item.price, entry.item.currency);
    side.append(change, price);

    row.append(main, side);
    return row;
  }

  async function showMovers(from) {
    const watch = await readWatch();
    const entries = watch.items
      .map((item) => {
        const move = priceMove(item);
        return { item, move, pct: item.saved ? (move / item.saved) * 100 : 0 };
      })
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

    openSheet(
      from,
      "Watch list",
      "Price movers",
      entries.length ? "How far each watched price has moved since you saved it." : "",
      (body) => {
        if (!entries.length) {
          body.appendChild(
            emptyNote("Nothing watched yet. Open a product page and tap Watch price.")
          );
          return;
        }
        entries.forEach((entry) => body.appendChild(moverRow(entry)));
      }
    );
  }

  function headlineRow(offer) {
    const lines = offerLines(offer);
    const row = rowButton(() => {
      const url = productUrl(offer.product);
      close();
      if (url) shop(url);
    });

    const main = el("span", "qv-main");
    const tag = el("small", "qv-tag");
    tag.textContent = storeName(lines.store) + " · " + lines.label;
    const name = el("strong");
    name.textContent = lines.title;
    const sub = el("small");
    sub.textContent = lines.price + (lines.savings ? " · ≈ " + lines.savings + " off" : "");
    main.append(tag, name, sub);

    const side = el("span", "qv-side");
    const go = el("em");
    go.textContent = "Shop";
    side.appendChild(go);

    row.append(main, side);
    return row;
  }

  function showHeadlines(from) {
    const offers = matchDeals().slice(0, HEADLINES);
    openSheet(
      from,
      "Deals feed",
      "Headlines",
      "Partner offers today, each paired with a product that already meets the terms.",
      (body) => {
        if (!offers.length) {
          body.appendChild(emptyNote("No live partner offers right now."));
          return;
        }
        offers.forEach((offer) => body.appendChild(headlineRow(offer)));
      }
    );
  }

  function group(title, buttons) {
    const section = el("section", "qv-group");
    const head = el("h3", "lbl");
    head.textContent = title;
    const wrap = el("div", "qv-chips");
    buttons.forEach((button) => wrap.appendChild(button));
    section.append(head, wrap);
    return section;
  }

  function sheetChip(label, onAct) {
    const chip = el("button", "sc");
    chip.type = "button";
    chip.textContent = label;
    chip.addEventListener("click", onAct);
    return chip;
  }

  function showMore(from) {
    const categories = categoriesByCount();
    openSheet(from, "Everything else", "All shortcuts", "The whole panel, one tap away.", (body) => {
      body.appendChild(
        group(
          "Views",
          [sheetChip("Price movers", () => showMovers(null)), sheetChip("Headlines", () => showHeadlines(null))]
            .concat(
              SECTIONS.map((section) =>
                sheetChip(section.label, () => {
                  close();
                  jumpTo(section.target);
                })
              )
            )
            .concat([
              sheetChip("All stores", () => {
                close();
                openStores();
              }),
            ])
        )
      );

      body.appendChild(
        group(
          "Store categories",
          categories.map(([name, count]) =>
            sheetChip(count + " · " + name, () => {
              close();
              openCategory(name);
            })
          )
        )
      );

      body.appendChild(
        group(
          "Settings and info",
          PAGES.map((page) =>
            sheetChip(page.label, () => {
              close();
              openPage(page.path);
            })
          )
        )
      );
    });
  }

  // ---- the row itself -----------------------------------------------------
  row.textContent = "";
  const chip = (label, extraClass, onAct) => {
    const button = el("button", "sc" + (extraClass ? " " + extraClass : ""));
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", (event) => onAct(event.currentTarget));
    row.appendChild(button);
    return button;
  };

  chip("Price movers", "sc-view", (from) => showMovers(from));
  chip("Headlines", "sc-view", (from) => showHeadlines(from));
  SECTIONS.forEach((section) => chip(section.label, "", () => jumpTo(section.target)));
  chip("All stores", "", () => openStores());
  categoriesByCount()
    .slice(0, CATEGORY_CHIPS)
    .forEach(([name]) => chip(name, "sc-cat", () => openCategory(name)));
  chip("Settings", "", () => openPage("options.html"));
  chip("Support", "", () => openPage("support.html"));
  chip("More", "sc-more", (from) => showMore(from));

  // ---- the sheet's own ways out -------------------------------------------
  if (closeEl) closeEl.addEventListener("click", close);
  view.addEventListener("click", (event) => {
    if (event.target === view) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return { close, showMovers, showHeadlines };
}
