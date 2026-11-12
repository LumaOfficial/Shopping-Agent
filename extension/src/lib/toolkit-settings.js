// "My savings toolkit" on the Settings page: the monthly goal, the price watch
// list, a note per store, the figures the panel used to show in a card of its
// own, and the stores and searches kept close. The panel keeps only the shortcut
// row that acts on the page you are shopping on.
import { money } from "./format.js";
import { STORES } from "./stores.js";
import { storeSite } from "./store-directory.js";
import { goalProgress, monthTotal, saveActivity, setGoal, streak, todayTotals } from "./goals.js";
import { cleanWatch, priceMove, readWatch, removeWatch, restoreWatch, saveWatch } from "./watchlist.js";
import { readBookmarks, saveBookmarks, sanitizeBookmarks, setNote } from "./bookmarks.js";
import { bestStore, monthEarned, topCategory } from "./insights.js";
import { absorbWallet, readSavings } from "./savings.js";

const byId = (id) => document.getElementById(id);

function storeFor(value) {
  const query = String(value == null ? "" : value).trim().toLowerCase();
  if (!query) return null;
  return (
    STORES.find((store) => store.id === query) ||
    STORES.find((store) => store.name.toLowerCase() === query) ||
    STORES.find((store) => store.name.toLowerCase().startsWith(query)) ||
    null
  );
}

function categoryOf(storeId) {
  const found = STORES.find((store) => store.id === storeId);
  return found ? found.category : null;
}

function storeName(storeId) {
  const found = STORES.find((store) => store.id === storeId);
  return found ? found.name : storeId;
}

export function startToolkitSettings() {
  let activity = null;
  let watch = cleanWatch(null);
  let books = sanitizeBookmarks(null);
  let wallet = null;
  // One removal waiting to be put back, so a mis-tap never loses a row.
  let undo = null;
  let statusTimer = null;

  function status(message, kind) {
    const box = byId("toolkit-status");
    if (!box) return;
    clearTimeout(statusTimer);
    box.hidden = !message;
    box.className = "test-line " + (kind || "ok");
    box.textContent = message || "";
    if (!message) return;
    statusTimer = setTimeout(() => {
      box.hidden = true;
    }, 3600);
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

  async function saveGoal() {
    const dollars = Number(byId("goal-input").value);
    if (!isFinite(dollars) || dollars <= 0) {
      status("Type a monthly amount above zero.", "bad");
      return;
    }
    activity = await saveActivity(setGoal(activity, Math.round(dollars * 100)));
    byId("goal-input").value = "";
    renderGoal();
    status("Monthly goal saved.", "ok");
  }

  // ---- price watch ------------------------------------------------------
  function watchRow(item) {
    const row = document.createElement("li");

    const title = document.createElement("span");
    title.className = "watch-title";
    title.textContent = item.title || "Watched product";

    const meta = document.createElement("span");
    meta.className = "watch-meta";
    meta.append(
      document.createTextNode((item.storeName || item.storeId) + " · " + money(item.price, item.currency))
    );
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
    const list = byId("watch-list");
    if (!list) return;
    list.textContent = "";
    watch.items.forEach((item) => list.appendChild(watchRow(item)));
    list.hidden = watch.items.length === 0;
    byId("watch-note").hidden = watch.items.length > 0;
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

  // ---- notes ------------------------------------------------------------
  function renderStoreNames() {
    const list = byId("tk-store-names");
    if (!list) return;
    list.textContent = "";
    STORES.forEach((store) => {
      const option = document.createElement("option");
      option.value = store.name;
      list.appendChild(option);
    });
  }

  function updateNoteButtons() {
    const found = storeFor(byId("tk-note-store").value);
    if (!found) {
      byId("tk-note-save").disabled = true;
      byId("tk-note-clear").hidden = true;
      return;
    }
    const saved = books.notes[found.id] || "";
    const typed = byId("tk-note").value.trim();
    byId("tk-note-save").disabled = typed === saved || !typed;
    byId("tk-note-clear").hidden = !saved;
  }

  function renderNotes() {
    const list = byId("tk-note-list");
    if (!list) return;
    const ids = Object.keys(books.notes).filter((id) => books.notes[id]);
    list.textContent = "";
    list.hidden = ids.length === 0;
    byId("tk-note-empty").hidden = ids.length > 0;
    ids.forEach((id) => {
      const row = document.createElement("li");

      const name = document.createElement("strong");
      name.textContent = storeName(id);

      const text = document.createElement("span");
      text.className = "muted small";
      text.textContent = books.notes[id];

      const actions = document.createElement("span");
      actions.className = "note-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "mini";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => pickNote(id));
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "mini";
      clear.textContent = "Remove";
      clear.addEventListener("click", () => writeNote(id, ""));
      actions.append(edit, clear);

      row.append(name, text, actions);
      list.appendChild(row);
    });
    updateNoteButtons();
  }

  // Editing an existing note loads it into the field rather than opening a
  // second editor, so there is one place a note is typed.
  function pickNote(storeId) {
    const found = STORES.find((store) => store.id === storeId);
    byId("tk-note-store").value = found ? found.name : storeId;
    byId("tk-note").value = books.notes[storeId] || "";
    updateNoteButtons();
    byId("tk-note").focus();
  }

  async function writeNote(storeId, text) {
    if (!storeId) return;
    books = await saveBookmarks(setNote(books, storeId, text));
    const selected = storeFor(byId("tk-note-store").value);
    if (selected && selected.id === storeId) byId("tk-note").value = text;
    renderNotes();
    status(text ? "Note saved for " + storeName(storeId) + "." : "Note removed for " + storeName(storeId) + ".", "ok");
  }

  // ---- insights ---------------------------------------------------------
  function renderInsights() {
    const list = byId("insight-list");
    if (!list) return;
    const entries = wallet && Array.isArray(wallet.entries) ? wallet.entries : [];
    const best = bestStore(entries);
    const category = topCategory(entries, categoryOf);
    const lines = [
      best ? "Best store · " + best.name + " · " + money(best.amount, best.currency) : "Best store · nothing credited yet",
      category ? "Top category · " + category.name + " · " + money(category.amount) : "Top category · nothing credited yet",
      "Cashback this month · " + money(monthEarned(entries)),
      "Watched products · " + watch.items.length,
    ];
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
      empty.className = "muted small";
      empty.textContent = "None pinned yet — pin a store from the panel while you are on it.";
      box.appendChild(empty);
    }
  }

  function renderRecents() {
    const box = byId("recent-chips");
    if (!box) return;
    box.textContent = "";
    if (!books.recents.length) {
      box.textContent = "Searches you run in the panel's store directory show up here.";
      return;
    }
    books.recents.forEach((query) => {
      const chip = document.createElement("span");
      chip.className = "chip plain";
      chip.textContent = query;
      box.appendChild(chip);
    });
  }

  // ---- wiring -----------------------------------------------------------
  function bind() {
    // The settings page is one big form, so the goal is a div with its own
    // button rather than a nested form the browser would drop.
    byId("goal-save").addEventListener("click", saveGoal);
    byId("goal-input").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      saveGoal();
    });

    byId("goal-clear").addEventListener("click", async () => {
      activity = await saveActivity(setGoal(activity, 0));
      byId("goal-input").value = "";
      renderGoal();
      status("Monthly goal cleared.", "ok");
    });

    byId("watch-undo").addEventListener("click", async () => {
      if (!undo) return;
      watch = await saveWatch(restoreWatch(watch, undo.item, undo.index));
      undo = null;
      renderWatch();
      renderInsights();
      status("Put back on the watch list.", "ok");
    });

    byId("tk-note-store").addEventListener("input", () => {
      const found = storeFor(byId("tk-note-store").value);
      byId("tk-note").value = found ? books.notes[found.id] || "" : "";
      updateNoteButtons();
    });
    byId("tk-note").addEventListener("input", updateNoteButtons);
    byId("tk-note-save").addEventListener("click", () => {
      const found = storeFor(byId("tk-note-store").value);
      if (!found) {
        status("Pick a store from the list first.", "bad");
        return;
      }
      writeNote(found.id, byId("tk-note").value);
    });
    byId("tk-note-clear").addEventListener("click", () => {
      const found = storeFor(byId("tk-note-store").value);
      if (!found) return;
      byId("tk-note").value = "";
      writeNote(found.id, "");
    });
  }

  async function boot() {
    activity = await readSavings();
    watch = await readWatch();
    books = await readBookmarks();
    renderStoreNames();
    bind();
    renderGoal();
    renderWatch();
    renderNotes();
    renderInsights();
    renderPins();
    renderRecents();
  }

  boot();

  return {
    // Confirmed cashback is folded in before the figures are read, so the goal
    // on this page matches the wallet it was earned in.
    async refresh() {
      const next = await chrome.runtime.sendMessage({ type: "cashback:wallet" }).catch(() => null);
      if (next) wallet = next;
      activity = await absorbWallet(wallet);
      renderGoal();
      renderInsights();
    },
  };
}
