// The "Animate" preview on the panel's All stores card: every store's own mark
// flips past in a board of tiles over ~15 seconds, then settles on a finale.
// Presentational only — it reads the catalog and touches nothing else.
import { hostsOf } from "./stores.js";

const RUN_MS = 15000;
const STAGGER_MS = 14;
const MIN_TILE = 62;
const ROWS = 5;

function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The store's own mark, at logo size. The tile keeps the store's initials
// underneath, so a blocked or missing image still reads as that store.
function logoUrl(store) {
  return (
    "https://www.google.com/s2/favicons?domain=" +
    encodeURIComponent(hostsOf(store)[0]) +
    "&sz=128"
  );
}

function initials(name) {
  return name
    .replace(/[^A-Za-z0-9& ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function hue(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum = (sum * 31 + name.charCodeAt(i)) % 360;
  return sum;
}

function makeTile() {
  const item = document.createElement("li");
  item.className = "logo-tile";
  const mark = document.createElement("span");
  mark.className = "logo-mark";
  item.appendChild(mark);
  const img = document.createElement("img");
  img.className = "logo-img";
  img.alt = "";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  img.addEventListener("load", () => item.classList.add("has-logo"));
  img.addEventListener("error", () => item.classList.add("no-logo"));
  item.appendChild(img);
  item._img = img;
  item._mark = mark;
  return item;
}

// Fill one tile with a store, restarting its flip so each board reads as a new
// wave of logos rather than a silent swap.
function fillTile(item, store, index) {
  item.classList.remove("off");
  item.title = store.name;
  item.style.setProperty("--hue", String(hue(store.name)));
  item._mark.textContent = initials(store.name);
  item.classList.remove("has-logo", "no-logo");
  item._img.src = logoUrl(store);
  item.classList.remove("flip");
  void item.offsetWidth;
  item.style.animationDelay = index * STAGGER_MS + "ms";
  item.classList.add("flip");
}

export function startLogoShow(root, stores) {
  const grid = root.querySelector("[data-show-grid]");
  const stepEl = root.querySelector("[data-show-step]");
  const titleEl = root.querySelector("[data-show-title]");
  const barEl = root.querySelector("[data-show-bar]");
  const noteEl = root.querySelector("[data-show-note]");
  if (!grid || !stores.length) return () => {};

  const cols = Math.min(8, Math.max(3, Math.floor((grid.clientWidth || 320) / MIN_TILE)));
  grid.style.setProperty("--cols", String(cols));
  const perBoard = cols * ROWS;

  grid.textContent = "";
  const tiles = [];
  for (let i = 0; i < perBoard; i += 1) {
    const tile = makeTile();
    tile.classList.add("off");
    grid.appendChild(tile);
    tiles.push(tile);
  }

  const order = shuffled(stores);
  const boards = [];
  for (let i = 0; i < order.length; i += perBoard) boards.push(order.slice(i, i + perBoard));
  const gap = Math.max(420, Math.min(1400, Math.round(RUN_MS / boards.length)));

  root.classList.remove("done");
  titleEl.textContent = stores.length + " stores";
  noteEl.textContent = "Every store Savings works on — tap Browse to open any of them.";
  stepEl.textContent = "All stores";
  barEl.style.width = "0%";

  let timer = 0;
  let index = 0;

  function render(board) {
    const from = index * perBoard + 1;
    const shown = index * perBoard + board.length;
    stepEl.textContent = from + "–" + shown + " of " + stores.length;
    barEl.style.width = Math.round((shown / stores.length) * 100) + "%";
    tiles.forEach((tile, slot) => {
      if (slot < board.length) fillTile(tile, board[slot], slot);
      else tile.classList.add("off");
    });
  }

  function finish() {
    titleEl.textContent = stores.length + " stores, one panel";
    stepEl.textContent = "All stores";
    barEl.style.width = "100%";
    noteEl.textContent = "Every store above is covered by the panel — tap Browse to open any of them.";
    root.classList.add("done");
  }

  function next() {
    if (index >= boards.length) {
      finish();
      return;
    }
    render(boards[index]);
    index += 1;
    timer = setTimeout(next, gap);
  }

  next();

  return () => {
    clearTimeout(timer);
    root.classList.remove("done");
  };
}
