// The row of actions under the brand, plus the keys that run them. The goal, the
// watch list and the store notes live on Settings now, so the panel keeps only
// the gestures that have to happen on the page that is open: watching the
// product, pinning the store, and opening the directory.
import { STORES } from "./stores.js";
import { pushRecent, readBookmarks, saveBookmarks, sanitizeBookmarks, togglePin } from "./bookmarks.js";
import { addWatch, cleanWatch, readWatch, saveWatch } from "./watchlist.js";
import { PREFS_KEY, applyPrefs, readPrefs } from "./prefs.js";
import { SHORTCUTS, actionFor } from "./shortcuts.js";

const byId = (id) => document.getElementById(id);

export function startPanelShortcuts(handlers) {
  const openSearch =
    handlers && typeof handlers.openSearch === "function" ? handlers.openSearch : () => {};
  let watch = cleanWatch(null);
  let books = sanitizeBookmarks(null);
  let store = null;
  let product = null;
  let currentUrl = "";
  let statusTimer = null;
  let searchTimer = null;

  // Said on the row itself, so a one-tap action always reports what it did.
  function status(message, kind) {
    const box = byId("shortcut-status");
    if (!box) return;
    clearTimeout(statusTimer);
    box.hidden = !message;
    box.className = "status " + (kind || "ok");
    box.textContent = message || "";
    if (!message) return;
    statusTimer = setTimeout(() => {
      box.hidden = true;
    }, 3600);
  }

  // The goal is edited on Settings, so the shortcut takes the shopper there
  // rather than scrolling to a card the panel no longer holds.
  function openToolkit() {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html#toolkit") });
  }

  async function addCurrentProduct() {
    if (!(store && product && product.price)) {
      status("Open a product page with a price to watch it.", "wait");
      return;
    }
    const result = addWatch(watch, {
      storeId: store.id,
      storeName: store.name,
      title: product.title,
      price: product.price,
      currency: product.currency,
      url: currentUrl,
      at: Date.now(),
    });
    if (!result.added) {
      status("That product has no readable title or price yet.", "wait");
      return;
    }
    watch = await saveWatch(result.watch);
    renderWatch();
    status(
      result.duplicate
        ? "Price updated in Settings › My savings toolkit."
        : "Watching this price in Settings › My savings toolkit.",
      "ok"
    );
  }

  async function pinCurrent() {
    if (!store) return;
    const had = books.pins.indexOf(store.id) !== -1;
    books = await saveBookmarks(togglePin(books, store.id));
    renderPin();
    status(had ? "Unpinned " + store.name + "." : "Pinned " + store.name + ".", "ok");
  }

  function renderWatch() {
    const button = byId("sc-watch");
    if (!button) return;
    const watching = Boolean(store && product && product.price);
    button.disabled = !watching;
    button.title = watching ? "Watch this product's price" : "Open a product page to watch its price";
  }

  function renderPin() {
    const button = byId("sc-pin");
    if (!button) return;
    const here = Boolean(store && STORES.some((entry) => entry.id === store.id));
    const pinned = Boolean(here && books.pins.indexOf(store.id) !== -1);
    button.disabled = !here;
    button.setAttribute("aria-pressed", String(pinned));
    button.title = here
      ? pinned
        ? "Unpin " + store.name
        : "Pin " + store.name
      : "Open a store to pin it";
    const label = byId("sc-pin-label");
    if (label) label.textContent = pinned ? "Unpin store" : "Pin store";
  }

  function renderKeys() {
    const box = byId("shortcut-hint");
    if (!box) return;
    box.textContent = "";
    SHORTCUTS.forEach((entry) => {
      const row = document.createElement("div");
      const key = document.createElement("kbd");
      key.textContent = entry.keys;
      row.append(key, document.createTextNode(" " + entry.what));
      box.appendChild(row);
    });
  }

  function toggleKeys(open) {
    const hint = byId("shortcut-hint");
    if (!hint) return;
    hint.hidden = typeof open === "boolean" ? !open : !hint.hidden;
    const button = byId("shortcut-help");
    if (button) button.setAttribute("aria-expanded", String(!hint.hidden));
  }

  // One place for what a shortcut does, whether it came from a key or from the
  // row under the brand.
  function runAction(action) {
    if (action === "focus-search") {
      openSearch();
      return;
    }
    if (action === "focus-goal") {
      openToolkit();
      return;
    }
    if (action === "watch-product") {
      addCurrentProduct();
      return;
    }
    if (action === "pin-store") {
      pinCurrent();
      return;
    }
    if (action === "help") toggleKeys();
  }

  function onKey(event) {
    const action = actionFor(event);
    if (!action) return;
    if (action === "escape") {
      const hint = byId("shortcut-hint");
      if (hint && !hint.hidden) {
        toggleKeys(false);
        return;
      }
      const field = byId("store-search");
      if (field && document.activeElement === field && field.value) {
        field.value = "";
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    event.preventDefault();
    runAction(action);
  }

  // Remembered searches are shown on Settings, so the directory writes them here
  // even though it no longer renders them.
  function noteSearch(query) {
    const text = String(query || "").trim();
    if (text.length < 2) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      books = await saveBookmarks(pushRecent(books, text));
    }, 900);
  }

  function bind() {
    document.querySelectorAll("[data-shortcut]").forEach((button) => {
      button.addEventListener("click", () => runAction(button.getAttribute("data-shortcut")));
    });
    document.addEventListener("keydown", onKey);

    // Comfort is switched in Settings, so an open panel follows the stored
    // value instead of waiting to be reopened.
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[PREFS_KEY]) applyPrefs(changes[PREFS_KEY].newValue);
      });
    }
  }

  async function boot() {
    applyPrefs(await readPrefs());
    watch = await readWatch();
    books = await readBookmarks();
    bind();
    renderKeys();
    renderWatch();
    renderPin();
  }

  boot();

  return {
    // The store the panel resolved and the product on the page it is looking at.
    setStore(nextStore, nextProduct, url) {
      store = nextStore && nextStore.id ? nextStore : null;
      product = nextProduct || null;
      currentUrl = typeof url === "string" ? url : "";
      renderWatch();
      renderPin();
    },
    noteSearch,
  };
}
