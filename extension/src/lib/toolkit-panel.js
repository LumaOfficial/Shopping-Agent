// The panel's own toolkit: a monthly goal, the products being watched, a note
// about the store that is open, a few figures from the wallet, and the comfort
// switches. It lives in its own module so sidepanel.js stays about the store
// page it is looking at.
import { money } from "./format.js";
import { STORES } from "./stores.js";
import { storeSite } from "./store-directory.js";
import { applyPrefs, readPrefs, stepText, writePrefs } from "./prefs.js";
import {
  goalProgress,
  monthTotal,
  readActivity,
  recordAttempt as bumpAttempt,
  saveActivity,
  setGoal,
  streak,
  syncEarnings,
  todayTotals,
} from "./goals.js";
import { addWatch, cleanWatch, priceMove, readWatch, removeWatch, restoreWatch, saveWatch } from "./watchlist.js";
import { pushRecent, readBookmarks, saveBookmarks, sanitizeBookmarks, setNote, togglePin } from "./bookmarks.js";
import { bestStore, monthEarned, summaryText, toCsv, topCategory } from "./insights.js";
import { SHORTCUTS, actionFor } from "./shortcuts.js";

const byId = (id) => document.getElementById(id);

function categoryOf(storeId) {
  const found = STORES.find((store) => store.id === storeId);
  return found ? found.category : null;
}

function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The browser keeps the blob alive for the click; freeing it later is enough.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function startToolkit() {
  let prefs = null;
  let activity = null;
  let watch = cleanWatch(null);
  let books = sanitizeBookmarks(null);
  let wallet = null;
  let store = null;
  let product = null;
  let currentUrl = "";
  // One removal waiting to be put back, so a mis-tap never loses a row.
  let undo = null;

  function status(message, kind) {
    const box = byId("toolkit-status");
    if (!box) return;
    box.hidden = !message;
    box.className = "status " + (kind || "ok");
    box.textContent = message || "";
  }

  // ---- goal -------------------------------------------------------------
  function renderGoal() {
    if (!byId("goal-figure")) return;
    const progress = goalProgress(activity);
    byId("goal-figure").textContent = progress.set ? money(progress.goal) : "Not set";
    byId("goal-meter").style.width = Math.round(progress.ratio * 100) + "%";
    byId("goal-clear").hidden = !progress.set;
    byId("goal-note").textContent = progress.set
      ? progress.saved >= progress.goal
        ? "Goal met — " + money(progress.saved) + " saved this month."
        : money(progress.left) + " to go this month."
      : "Set a target and the panel tracks how close you are.";
    const today = todayTotals(activity);
    byId("tk-today").textContent = money(today.saved);
    byId("tk-month").textContent = money(monthTotal(activity));
    byId("tk-streak").textContent = String(streak(activity));
  }

  // ---- watch list -------------------------------------------------------
  function watchRow(item) {
    const row = document.createElement("li");

    const title = document.createElement("span");
    title.className = "watch-title";
    title.textContent = item.title || "Watched product";

    const meta = document.createElement("span");
    meta.className = "watch-meta";
    meta.append(document.createTextNode((item.storeName || item.storeId) + " · " + money(item.price, item.currency)));
    const move = priceMove(item);
    if (move > 0) {
      const drop = document.createElement("em");
      drop.className = "watch-drop";
      drop.textContent = "· down " + money(move, item.currency) + " since you saved it";
      meta.appendChild(drop);
    } else if (move < 0) {
      const up = document.createElement("em");
      up.className = "watch-up";
      up.textContent = "· up " + money(-move, item.currency) + " since you saved it";
      meta.appendChild(up);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "mini";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", "Remove " + (item.title || "this product") + " from the watch list");
    remove.addEventListener("click", () => dropWatch(item));

    row.append(title, meta, remove);
    return row;
  }

  function renderWatch() {
    if (!byId("watch-list")) return;
    const list = byId("watch-list");
    list.textContent = "";
    watch.items.forEach((item) => list.appendChild(watchRow(item)));
    list.hidden = watch.items.length === 0;
    byId("watch-note").hidden = watch.items.length > 0;
    byId("watch-add").hidden = !(store && product && product.price);
    const undoButton = byId("watch-undo");
    undoButton.hidden = !undo;
    if (undo) undoButton.textContent = "Undo remove (" + (undo.item.title || "product").slice(0, 24) + ")";
  }

  async function dropWatch(item) {
    const result = removeWatch(watch, item.id);
    if (!result.removed) return;
    watch = await saveWatch(result.watch);
    undo = { item: result.removed, index: result.index };
    renderWatch();
    status("Removed from the watch list.", "ok");
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
    undo = null;
    renderWatch();
    renderInsights();
    status(result.duplicate ? "Price updated on the watch list." : "Added to the watch list.", "ok");
  }

  // ---- note for this store ----------------------------------------------
  // Only the two buttons — never the field — so typing, pasting or a browser
  // autofill is not overwritten while it is being entered.
  function updateNoteButtons() {
    if (!store || !byId("store-note-row")) return;
    const saved = books.notes[store.id] || "";
    const typed = byId("store-note").value.trim();
    byId("note-save").disabled = typed === saved;
    byId("note-clear").hidden = !saved && !typed;
  }

  function renderNote() {
    if (!byId("store-note-row")) return;
    const here = Boolean(store && store.id);
    byId("store-note-row").hidden = !here;
    if (!here) return;
    const field = byId("store-note");
    // A different store gets its own note; the field is only rewritten when it
    // is not holding something the shopper is still typing.
    if (document.activeElement !== field) field.value = books.notes[store.id] || "";
    updateNoteButtons();
  }

  async function saveNoteText() {
    if (!store) return;
    books = await saveBookmarks(setNote(books, store.id, byId("store-note").value));
    renderNote();
    status("Note saved for " + store.name + ".", "ok");
  }

  // ---- insights ---------------------------------------------------------
  function renderInsights() {
    if (!byId("insight-list")) return;
    const entries = wallet && Array.isArray(wallet.entries) ? wallet.entries : [];
    const best = bestStore(entries);
    const category = topCategory(entries, categoryOf);
    const month = monthEarned(entries);
    const lines = [
      best ? "Best store · " + best.name + " · " + money(best.amount, best.currency) : "Best store · nothing credited yet",
      category ? "Top category · " + category.name + " · " + money(category.amount) : "Top category · nothing credited yet",
      "Cashback this month · " + money(month),
      "Watched products · " + watch.items.length,
    ];
    const list = byId("insight-list");
    list.textContent = "";
    lines.forEach((line) => {
      const row = document.createElement("li");
      row.textContent = line;
      list.appendChild(row);
    });
  }

  // ---- pins and recent searches -----------------------------------------
  function renderPins() {
    const box = byId("pin-chips");
    if (!box) return;
    box.textContent = "";
    books.pins.forEach((id) => {
      const found = STORES.find((entry) => entry.id === id);
      if (!found) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = found.name;
      button.title = "Open " + found.name;
      button.addEventListener("click", () => chrome.tabs.create({ url: storeSite(found) }));
      box.appendChild(button);
    });
    if (!box.children.length) {
      const empty = document.createElement("span");
      empty.className = "muted tiny";
      empty.textContent = "None pinned yet — open a store and pin it here.";
      box.appendChild(empty);
    }
    const button = byId("pin-current");
    const here = store && STORES.some((entry) => entry.id === store.id);
    button.hidden = !here;
    if (here) {
      button.textContent = books.pins.indexOf(store.id) === -1 ? "Pin this store" : "Unpin this store";
    }
  }

  function renderRecents() {
    const box = byId("recent-chips");
    if (!box) return;
    box.textContent = "";
    if (!books.recents.length) {
      box.textContent = "Searches you run in the store directory show up here.";
      box.className = "chips muted tiny";
      return;
    }
    box.className = "chips";
    books.recents.forEach((query) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = query;
      button.addEventListener("click", () => runSearch(query));
      box.appendChild(button);
    });
  }

  // Filling the real search field and firing its own input event keeps one
  // filter in charge of the directory.
  function runSearch(query) {
    const toggle = byId("stores-toggle");
    if (toggle && toggle.getAttribute("aria-expanded") !== "true") toggle.click();
    const field = byId("store-search");
    if (!field) return;
    field.value = query;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
  }

  async function rememberSearch(query) {
    const next = pushRecent(books, query);
    if (next.recents.length === books.recents.length && next.recents[0] === books.recents[0]) return;
    books = await saveBookmarks(next);
    renderRecents();
  }

  // ---- comfort ----------------------------------------------------------
  function renderComfort() {
    if (!prefs) return;
    byId("contrast-toggle").setAttribute("aria-pressed", String(prefs.contrast === "high"));
    byId("density-toggle").setAttribute("aria-pressed", String(prefs.density === "compact"));
    byId("motion-toggle").setAttribute("aria-pressed", String(prefs.motion === "reduce"));
    byId("text-size").textContent = Math.round(prefs.textScale * 100) + "%";
  }

  async function setPref(patch) {
    prefs = await writePrefs(patch);
    renderComfort();
  }

  function renderShortcuts() {
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

  // ---- keyboard ---------------------------------------------------------
  function onKey(event) {
    const action = actionFor(event);
    if (!action) return;
    if (action === "escape") {
      const hint = byId("shortcut-hint");
      if (hint && !hint.hidden) {
        hint.hidden = true;
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
    if (action === "focus-search") runSearch("");
    if (action === "focus-goal") {
      byId("goal-input").focus();
      byId("goal-input").select();
    }
    if (action === "watch-product") byId("watch-add").click();
    if (action === "pin-store") byId("pin-current").click();
    if (action === "help") {
      const hint = byId("shortcut-hint");
      hint.hidden = !hint.hidden;
      byId("toolkit-help").setAttribute("aria-expanded", String(!hint.hidden));
    }
  }

  // ---- wiring -----------------------------------------------------------
  function bind() {
    byId("goal-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const dollars = Number(byId("goal-input").value);
      if (!isFinite(dollars) || dollars <= 0) {
        status("Type a monthly amount above zero.", "bad");
        return;
      }
      activity = await saveActivity(setGoal(activity, Math.round(dollars * 100)));
      byId("goal-input").value = "";
      renderGoal();
      status("Monthly goal saved.", "ok");
    });

    byId("goal-clear").addEventListener("click", async () => {
      activity = await saveActivity(setGoal(activity, 0));
      byId("goal-input").value = "";
      renderGoal();
      status("Monthly goal cleared.", "ok");
    });

    byId("watch-add").addEventListener("click", addCurrentProduct);
    byId("watch-undo").addEventListener("click", async () => {
      if (!undo) return;
      watch = await saveWatch(restoreWatch(watch, undo.item, undo.index));
      undo = null;
      renderWatch();
      renderInsights();
      status("Put back on the watch list.", "ok");
    });

    byId("store-note").addEventListener("input", updateNoteButtons);
    byId("note-save").addEventListener("click", saveNoteText);
    byId("note-clear").addEventListener("click", async () => {
      byId("store-note").value = "";
      await saveNoteText();
    });

    byId("pin-current").addEventListener("click", async () => {
      if (!store) return;
      const had = books.pins.indexOf(store.id) !== -1;
      books = await saveBookmarks(togglePin(books, store.id));
      renderPins();
      status(had ? "Unpinned " + store.name + "." : "Pinned " + store.name + ".", "ok");
    });

    byId("export-csv").addEventListener("click", () => {
      const entries = wallet && Array.isArray(wallet.entries) ? wallet.entries : [];
      if (!entries.length) {
        status("Nothing in the wallet to export yet.", "wait");
        return;
      }
      downloadFile("luma-savings.csv", toCsv(entries), "text/csv");
      status("CSV saved to your downloads.", "ok");
    });

    byId("copy-summary").addEventListener("click", async () => {
      const progress = goalProgress(activity);
      const entries = wallet && Array.isArray(wallet.entries) ? wallet.entries : [];
      const text = summaryText({
        goal: progress,
        month: monthEarned(entries),
        today: todayTotals(activity).saved,
        streak: streak(activity),
        best: bestStore(entries),
        category: topCategory(entries, categoryOf),
        watch: watch.items.length,
      });
      try {
        await navigator.clipboard.writeText(text);
        status("Summary copied.", "ok");
      } catch (_error) {
        status("This browser blocked the clipboard — select the figures above instead.", "bad");
      }
    });

    byId("contrast-toggle").addEventListener("click", () =>
      setPref({ contrast: prefs.contrast === "high" ? "normal" : "high" })
    );
    byId("density-toggle").addEventListener("click", () =>
      setPref({ density: prefs.density === "compact" ? "cozy" : "compact" })
    );
    byId("motion-toggle").addEventListener("click", () =>
      setPref({ motion: prefs.motion === "reduce" ? "auto" : "reduce" })
    );
    byId("text-smaller").addEventListener("click", () => setPref({ textScale: stepText(prefs, -1) }));
    byId("text-larger").addEventListener("click", () => setPref({ textScale: stepText(prefs, 1) }));

    byId("toolkit-help").addEventListener("click", () => {
      const hint = byId("shortcut-hint");
      hint.hidden = !hint.hidden;
      byId("toolkit-help").setAttribute("aria-expanded", String(!hint.hidden));
    });

    // One remembered search per pause in typing, not per keystroke.
    let searchTimer = null;
    byId("store-search").addEventListener("input", (event) => {
      clearTimeout(searchTimer);
      const query = String(event.target.value || "").trim();
      if (query.length < 2) return;
      searchTimer = setTimeout(() => rememberSearch(query), 900);
    });

    document.addEventListener("keydown", onKey);
  }

  async function boot() {
    prefs = applyPrefs(await readPrefs());
    activity = await readActivity();
    watch = await readWatch();
    books = await readBookmarks();
    bind();
    renderShortcuts();
    renderComfort();
    renderGoal();
    renderWatch();
    renderNote();
    renderInsights();
    renderPins();
    renderRecents();
  }

  boot();

  return {
    // The store the panel resolved, the product on the page and the tab address.
    setStore(nextStore, nextProduct, url) {
      store = nextStore && nextStore.id ? nextStore : null;
      product = nextProduct || null;
      currentUrl = typeof url === "string" ? url : "";
      renderWatch();
      renderNote();
      renderPins();
    },
    // Confirmed earnings folded into the day they were earned, once each.
    async setWallet(next) {
      wallet = next || null;
      if (wallet && Array.isArray(wallet.entries) && activity) {
        const synced = syncEarnings(activity, wallet.entries);
        if (synced.added) activity = await saveActivity(synced);
      }
      renderGoal();
      renderInsights();
    },
    // A code was tried, and possibly accepted, in the store's own promo field.
    async recordAttempt(applied) {
      if (!activity) return;
      activity = await saveActivity(bumpAttempt(activity, applied));
      renderGoal();
    },
  };
}
