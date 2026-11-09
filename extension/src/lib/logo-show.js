// The "Animate" trailer on the panel's All stores card.
//
// Every store's own mark is loaded before the show starts, so no tile pops a
// logo in halfway through. The show then runs three scenes — an orbit of logos,
// a fly-through and a mosaic — and settles on the store count. Presentational
// only: it reads the catalog, reports its own progress, and lets the panel wire
// the close and Browse buttons.
import { hostsOf } from "./stores.js";

const CONCURRENCY = 10;
const PRELOAD_LIMIT_MS = 15000;
const ORBIT_MS = 5600;
const TUNNEL_MS = 4000;

// One preload per session: later opens start instantly from the browser cache.
let preloadPromise = null;
const logoReady = new Set();

function logoUrl(store) {
  return (
    "https://www.google.com/s2/favicons?domain=" +
    encodeURIComponent(hostsOf(store)[0]) +
    "&sz=64"
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

function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Load every mark with a small queue, so the browser is not asked for hundreds
// of images at once. A slow or blocked image is skipped, never waited on
// forever — the tile keeps its initials instead.
function preload(stores, onProgress) {
  if (preloadPromise) {
    if (onProgress) onProgress(stores.length, stores.length);
    return preloadPromise;
  }
  const urls = stores.map(logoUrl);
  let done = 0;
  let next = 0;
  let settled = false;

  preloadPromise = new Promise((resolve) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const step = () => {
      done += 1;
      if (onProgress && (done === urls.length || done % 8 === 0)) {
        onProgress(done, urls.length);
      }
      if (next < urls.length) load();
      else if (done >= urls.length) finish();
    };
    function load() {
      const url = urls[next];
      next += 1;
      const img = new Image();
      img.onload = () => {
        logoReady.add(url);
        step();
      };
      img.onerror = step;
      img.src = url;
    }
    if (!urls.length) {
      finish();
      return;
    }
    for (let i = 0; i < CONCURRENCY; i += 1) load();
    setTimeout(finish, PRELOAD_LIMIT_MS);
  });

  return preloadPromise;
}

// One tile, at any size. The store's initials sit underneath so a mark that is
// blocked in this browser still reads as that store.
function makeTile(store) {
  const tile = document.createElement("div");
  tile.className = "show-tile";
  tile.style.setProperty("--hue", String(hue(store.name)));

  const mark = document.createElement("span");
  mark.className = "show-mark";
  mark.textContent = initials(store.name);

  const url = logoUrl(store);
  const img = document.createElement("img");
  img.className = "show-logo";
  img.alt = "";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  if (logoReady.has(url)) tile.classList.add("has-logo");
  else img.addEventListener("load", () => tile.classList.add("has-logo"));
  img.src = url;

  tile.append(mark, img);
  return tile;
}

// Scene 1: three rings turning at different speeds, tilted into a shallow disc.
function buildOrbit(scene, stores, stage) {
  scene.textContent = "";
  const disc = document.createElement("div");
  disc.className = "show-disc";
  const size = Math.min(stage.clientWidth, stage.clientHeight) * 0.96;
  const order = shuffled(stores);
  const rings = [
    { count: 22, radius: 0.17, tile: 0.062, dur: 24, tint: "far", reverse: true },
    { count: 28, radius: 0.3, tile: 0.075, dur: 32, tint: "mid", reverse: false },
    { count: 32, radius: 0.44, tile: 0.089, dur: 42, tint: "near", reverse: true },
  ];

  let cursor = 0;
  rings.forEach((ring) => {
    const rail = document.createElement("div");
    rail.className = "show-ring " + ring.tint + (ring.reverse ? " rev" : "");
    rail.style.setProperty("--dur", ring.dur + "s");
    const radius = Math.round(size * ring.radius);
    const tileSize = Math.max(24, Math.round(size * ring.tile));
    for (let i = 0; i < ring.count && cursor < order.length; i += 1) {
      const tile = makeTile(order[cursor]);
      cursor += 1;
      tile.style.setProperty("--tile", tileSize + "px");
      tile.style.setProperty("--r", radius + "px");
      tile.style.setProperty("--a", Math.round((360 / ring.count) * i) + "deg");
      rail.appendChild(tile);
    }
    disc.appendChild(rail);
  });
  scene.appendChild(disc);
}

// Scene 2: logos stream out of the centre toward the viewer.
function buildTunnel(scene, stores, stage) {
  scene.textContent = "";
  const count = Math.min(64, stores.length);
  const reach = Math.max(stage.clientWidth, stage.clientHeight) * 0.78;
  shuffled(stores)
    .slice(0, count)
    .forEach((store, index) => {
      const tile = makeTile(store);
      tile.classList.add("show-fly");
      tile.style.setProperty("--tile", 34 + Math.round(Math.random() * 26) + "px");
      tile.style.setProperty("--a", Math.round(Math.random() * 360) + "deg");
      tile.style.setProperty("--r", Math.round(reach * (0.6 + Math.random() * 0.5)) + "px");
      tile.style.animationDelay = Math.round(index * 26 + Math.random() * 180) + "ms";
      scene.appendChild(tile);
    });
}

// Scene 3: the marks settle into a mosaic under the store count.
function buildMosaic(scene, stores, stage) {
  scene.textContent = "";
  const grid = document.createElement("div");
  grid.className = "show-mosaic-grid";
  const cols = Math.max(4, Math.min(9, Math.floor(stage.clientWidth / 72)));
  const rows = Math.max(3, Math.min(7, Math.floor((stage.clientHeight * 0.56) / 72)));
  grid.style.setProperty("--cols", String(cols));
  shuffled(stores)
    .slice(0, cols * rows)
    .forEach((store, index) => {
      const tile = makeTile(store);
      tile.classList.add("show-pop");
      tile.style.animationDelay = Math.min(index * 14, 620) + "ms";
      grid.appendChild(tile);
    });
  scene.appendChild(grid);
}

export function startLogoShow(root, stores) {
  const stage = root.querySelector(".show-stage");
  const scenes = {
    orbit: root.querySelector('[data-scene="orbit"]'),
    tunnel: root.querySelector('[data-scene="tunnel"]'),
    mosaic: root.querySelector('[data-scene="mosaic"]'),
  };
  const stepEl = root.querySelector("[data-show-step]");
  const titleEl = root.querySelector("[data-show-title]");
  const noteEl = root.querySelector("[data-show-note]");
  const barEl = root.querySelector("[data-show-bar]");
  const browseEl = root.querySelector("[data-show-browse]");
  if (!stage || !scenes.orbit) return () => {};

  let stopped = false;
  const timers = [];
  const later = (fn, ms) => {
    timers.push(setTimeout(fn, ms));
  };

  const stop = () => {
    stopped = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    root.classList.remove("done", "playing");
  };

  const copy = (step, title, note) => {
    if (stepEl) stepEl.textContent = step;
    if (titleEl) titleEl.textContent = title;
    if (noteEl) noteEl.textContent = note;
  };
  const showScene = (key) => {
    Object.entries(scenes).forEach(([name, el]) => {
      if (el) el.classList.toggle("on", name === key);
    });
  };

  Object.values(scenes).forEach((el) => el && el.classList.remove("on", "leaving"));
  root.classList.remove("done");
  root.classList.add("playing");
  if (browseEl) browseEl.hidden = true;
  if (barEl) barEl.style.width = "0%";
  copy("All stores", "Loading logos", "Preloading every store's mark so nothing pops in mid-show.");

  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startedAt = Date.now();

  function finish() {
    if (stopped) return;
    buildMosaic(scenes.mosaic, stores, stage);
    showScene("mosaic");
    copy("All stores", stores.length + " stores, one panel", "Tap Browse to open any of them.");
    if (barEl) barEl.style.width = "100%";
    if (browseEl) browseEl.hidden = false;
    root.classList.add("done");
    root.classList.remove("playing");
  }

  function flyThrough() {
    if (stopped) return;
    scenes.orbit.classList.add("leaving");
    buildTunnel(scenes.tunnel, stores, stage);
    showScene("tunnel");
    copy("Scene 2 of 3 · Every aisle", "One panel", "Codes, cashback and prices, wherever you shop.");
    if (barEl) barEl.style.width = "68%";
    later(finish, TUNNEL_MS);
  }

  function begin() {
    if (stopped) return;
    // Reduced motion goes straight to the result instead of the moving scenes.
    if (reduce) {
      finish();
      return;
    }
    buildOrbit(scenes.orbit, stores, stage);
    showScene("orbit");
    copy("Scene 1 of 3 · The catalog", stores.length + " stores", "Every store Savings works on, in one orbit.");
    if (barEl) barEl.style.width = "34%";
    later(flyThrough, ORBIT_MS);
  }

  preload(stores, (done, total) => {
    if (stopped) return;
    if (barEl) barEl.style.width = Math.round((done / total) * 100) + "%";
    copy("All stores", "Loading logos", "Preloading every store's mark — " + done + " of " + total + ".");
  }).then(() => {
    if (stopped) return;
    later(begin, Math.max(0, 600 - (Date.now() - startedAt)));
  });

  return stop;
}
