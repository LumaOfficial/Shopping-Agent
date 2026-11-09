// Panel content that needs no configuration: a rail of popular stores and
// category tiles that jump straight into the All stores directory. Presentational
// only — it reads the catalog and hands each tap back to the panel.
import { STORES, hostsOf } from "./stores.js";

// Stores shoppers look for most, spread across categories. Each render picks ten
// of them, so "Shuffle" turns the rail over without inventing anything that is
// not in the catalog.
const POPULAR = [
  "amazon",
  "target",
  "walmart",
  "bestbuy",
  "sephora",
  "nike",
  "macys",
  "etsy",
  "ebay",
  "wayfair",
  "ikea",
  "chewy",
  "lululemon",
  "ulta",
  "nordstrom",
  "gap",
  "booking",
  "expedia",
  "doordash",
  "shein",
  "adidas",
  "uniqlo",
  "zara",
  "samsclub",
];

const SHOW_PICKS = 10;
const SHOW_CATEGORIES = 7;

function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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

// The store's own mark, at tile size. The initials underneath mean a blocked or
// missing image still reads as that store.
function logoUrl(store) {
  return (
    "https://www.google.com/s2/favicons?domain=" +
    encodeURIComponent(hostsOf(store)[0]) +
    "&sz=64"
  );
}

function pickTile(store, index, onOpenStore) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "pick";
  tile.title = "Open " + store.name;
  tile.style.setProperty("--hue", String(hue(store.name)));
  tile.style.animationDelay = index * 45 + "ms";

  const mark = document.createElement("span");
  mark.className = "pick-mark";
  const letters = document.createElement("span");
  letters.className = "pick-initials";
  letters.textContent = initials(store.name);
  const img = document.createElement("img");
  img.className = "pick-img";
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  img.addEventListener("load", () => tile.classList.add("has-logo"));
  img.src = logoUrl(store);
  mark.append(img, letters);

  const name = document.createElement("span");
  name.className = "pick-name";
  name.textContent = store.name;

  tile.append(mark, name);
  tile.addEventListener("click", () => onOpenStore(store));
  return tile;
}

export function startPanelExtras({ rail, grid, shuffleButton, onOpenStore, onOpenCategory }) {
  if (!rail || !grid) return;

  const popular = POPULAR.map((id) => STORES.find((store) => store.id === id)).filter(Boolean);

  function renderPicks() {
    rail.textContent = "";
    shuffled(popular)
      .slice(0, SHOW_PICKS)
      .forEach((store, index) => rail.appendChild(pickTile(store, index, onOpenStore)));
  }

  // Categories ordered by how much of the catalog they hold, so the tiles lead
  // with Fashion, Home and Electronics rather than an arbitrary first-seen order.
  function renderCategories() {
    grid.textContent = "";
    const counts = new Map();
    STORES.forEach((store) => counts.set(store.category, (counts.get(store.category) || 0) + 1));
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, SHOW_CATEGORIES);
    [["All", STORES.length]]
      .concat(top)
      .forEach(([name, count]) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "cat-tile";
        const label = document.createElement("strong");
        label.textContent = name === "All" ? "All stores" : name;
        const total = document.createElement("span");
        total.className = "lbl";
        total.textContent = String(count);
        tile.append(label, total);
        tile.addEventListener("click", () => onOpenCategory(name));
        grid.appendChild(tile);
      });
  }

  renderPicks();
  renderCategories();
  if (shuffleButton) shuffleButton.addEventListener("click", renderPicks);
}
