// The "Animate" trailer on the panel's All stores card.
//
// Shot like a film trailer rather than a slide deck: a pre-roll slate while the
// marks cache, then title cards cut against the logo imagery, and a closing
// wordmark card with the way into All stores. Every popular mark is fetched and
// decoded, and every scene is laid out, before the first card appears — so
// nothing pops in halfway through a shot. Presentational only: it reads the
// catalog for its closing count, reports its own progress, and lets the panel
// wire the close and Browse buttons.
import { BRAND_MARKS, initials, markUrl } from "./brand-marks.js";

const CONCURRENCY = 8;
const PRELOAD_LIMIT_MS = 20000;

// The running order, in milliseconds. Each card cuts on the beat below it.
const ORBIT_MS = 4600;
const WALL_MS = 4600;
const TAG_MS = 2200;

// Where the progress bar sits at each beat: the real work first, then the film.
const AT = { cache: 30, decode: 40, build: 50, orbit: 68, wall: 86, done: 100 };

const cache = new Map(); // host -> loaded Image, or null when the mark failed
let preloadRun = null;

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Fetch every mark once per session with a small queue. A slow or blocked mark
// is remembered as failed, never waited on forever.
function preload(onMark) {
  if (preloadRun) return preloadRun;
  preloadRun = new Promise((resolve) => {
    const queue = BRAND_MARKS.slice();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const pump = () => {
      const mark = queue.shift();
      if (!mark) {
        if (cache.size >= BRAND_MARKS.length) finish();
        return;
      }
      const img = new Image();
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      const settle = (ok) => {
        cache.set(mark.host, ok ? img : null);
        onMark(mark);
        pump();
        if (cache.size >= BRAND_MARKS.length) finish();
      };
      img.onload = () => settle(true);
      img.onerror = () => settle(false);
      img.src = markUrl(mark.host);
    };
    if (!BRAND_MARKS.length) {
      finish();
      return;
    }
    for (let i = 0; i < CONCURRENCY; i += 1) pump();
    setTimeout(finish, PRELOAD_LIMIT_MS);
  });
  return preloadRun;
}

// One tile at any size. The store's initials sit underneath in its own ink, so
// a mark that is blocked in this browser still reads as that store.
function makeTile(mark) {
  const tile = el("div", "show-tile");
  tile.style.setProperty("--ink", mark.ink);

  const letters = el("span", "show-mark");
  letters.textContent = initials(mark.name);

  const img = el("img", "show-logo");
  img.alt = "";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  if (cache.has(mark.host)) {
    if (cache.get(mark.host)) tile.classList.add("has-logo");
  } else {
    img.addEventListener("load", () => tile.classList.add("has-logo"));
  }
  img.src = markUrl(mark.host);

  tile.append(letters, img);
  return tile;
}

// Pre-roll: the house slate. A wordmark, a counter and a hairline that fills
// as the marks land — the studio card before the trailer, not a progress bar.
function buildSlate(scene, total) {
  scene.textContent = "";
  const slate = el("div", "slate");

  const house = el("span", "slate-house");
  house.textContent = "Luma Pay presents";

  const count = el("div", "slate-count");
  const now = el("b");
  now.textContent = "0";
  const of = el("span");
  of.textContent = "/" + total;
  count.append(now, of);

  const rule = el("div", "slate-rule");
  const fill = el("i");
  rule.appendChild(fill);

  const cap = el("span", "slate-cap");
  cap.textContent = "marks on the reel";

  slate.append(house, count, rule, cap);
  scene.appendChild(slate);

  return {
    paint(done) {
      now.textContent = String(done);
      fill.style.width = (total ? Math.min(1, done / total) * 100 : 100) + "%";
    },
  };
}

// Shot 1: three rings turning at different speeds, the camera pushing in.
function buildOrbit(scene, stage, marks) {
  scene.textContent = "";
  const disc = el("div", "show-disc");
  const size = Math.min(stage.clientWidth, stage.clientHeight) * 0.98;
  const order = shuffled(marks);
  const rings = [
    { count: 12, radius: 0.24, tile: 0.075, dur: 52, tint: "far", reverse: true },
    { count: 16, radius: 0.34, tile: 0.09, dur: 66, tint: "mid", reverse: false },
    { count: 18, radius: 0.44, tile: 0.105, dur: 82, tint: "near", reverse: true },
  ];

  let cursor = 0;
  rings.forEach((ring) => {
    const rail = el("div", "show-ring " + ring.tint + (ring.reverse ? " rev" : ""));
    rail.style.setProperty("--dur", ring.dur + "s");
    const radius = Math.round(size * ring.radius);
    const tileSize = Math.max(26, Math.round(size * ring.tile));
    for (let i = 0; i < ring.count && cursor < order.length; i += 1) {
      // The slot rides the ring; the tile inside turns the other way, so every
      // mark stays upright on screen while it travels.
      const slot = el("div", "ring-slot");
      slot.style.setProperty("--tile", tileSize + "px");
      slot.style.setProperty("--r", radius + "px");
      slot.style.setProperty("--a", Math.round((360 / ring.count) * i) + "deg");
      slot.style.setProperty("--dur", ring.dur + "s");
      slot.appendChild(makeTile(order[cursor]));
      cursor += 1;
      rail.appendChild(slot);
    }
    disc.appendChild(rail);
  });

  scene.appendChild(disc);
}

// Shot 2: a tilted wall of logo bands drifting in opposite directions.
const WALL_ROWS = [
  { tile: 58, dur: 44, reverse: false },
  { tile: 46, dur: 54, reverse: true },
  { tile: 66, dur: 47, reverse: false },
  { tile: 50, dur: 60, reverse: true },
];

function buildWall(scene, marks) {
  scene.textContent = "";
  const wall = el("div", "show-wall");
  const pool = shuffled(marks);

  WALL_ROWS.forEach((row, rowIndex) => {
    const line = [];
    for (let i = 0; i < 12; i += 1) line.push(pool[(rowIndex * 11 + i) % pool.length]);

    const rowEl = el("div", "wall-row" + (row.reverse ? " rev" : ""));
    const track = el("div", "wall-track");
    track.style.setProperty("--dur", row.dur + "s");

    // Two identical sets make the loop seamless at -50%.
    for (let copy = 0; copy < 2; copy += 1) {
      const set = el("div", "wall-set");
      line.forEach((mark) => {
        const tile = makeTile(mark);
        tile.classList.add("wall-tile");
        tile.style.setProperty("--tile", row.tile + "px");
        set.appendChild(tile);
      });
      track.appendChild(set);
    }

    rowEl.appendChild(track);
    wall.appendChild(rowEl);
  });

  scene.appendChild(wall);
}

// The closing shot: every mark settling into a dim poster behind the wordmark.
function buildPoster(scene, stage, marks) {
  scene.textContent = "";
  const grid = el("div", "show-poster-grid");
  const cols = Math.max(4, Math.min(9, Math.floor(stage.clientWidth / 76)));
  const rows = Math.max(3, Math.min(7, Math.floor((stage.clientHeight * 0.58) / 76)));
  grid.style.setProperty("--cols", String(cols));
  shuffled(marks)
    .slice(0, cols * rows)
    .forEach((mark, index) => {
      const tile = makeTile(mark);
      tile.style.setProperty("--d", Math.min(index * 18, 700) + "ms");
      grid.appendChild(tile);
    });
  scene.appendChild(grid);
}

export function startLogoShow(root, stores) {
  const stage = root.querySelector(".show-stage");
  const scenes = {
    boot: root.querySelector('[data-scene="boot"]'),
    orbit: root.querySelector('[data-scene="orbit"]'),
    wall: root.querySelector('[data-scene="wall"]'),
    poster: root.querySelector('[data-scene="poster"]'),
  };
  const cardEl = root.querySelector(".show-copy");
  const kickerEl = root.querySelector("[data-show-step]");
  const titleEl = root.querySelector("[data-show-title]");
  const noteEl = root.querySelector("[data-show-note]");
  const barEl = root.querySelector("[data-show-bar]");
  const browseEl = root.querySelector("[data-show-browse]");
  const stepEls = Array.from(root.querySelectorAll("[data-step]"));
  if (!stage || !scenes.boot || !cardEl) return () => {};

  const marks = BRAND_MARKS;
  const totalStores = stores.length;
  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let stopped = false;
  const timers = [];
  const later = (fn, ms) => {
    timers.push(setTimeout(fn, ms));
  };
  const sleep = (ms) => new Promise((resolve) => later(resolve, ms));

  const stop = () => {
    stopped = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    root.classList.remove("done", "playing");
    root.removeAttribute("data-beat");
  };

  // A title card: kicker, statement, one line under it. Re-set on every beat, so
  // the lines step in rather than swap.
  const card = (beat, kicker, title, detail) => {
    root.dataset.beat = beat;
    if (kickerEl) {
      kickerEl.textContent = kicker || "";
      kickerEl.hidden = !kicker;
    }
    if (titleEl) titleEl.textContent = title || "";
    if (noteEl) {
      noteEl.textContent = detail || "";
      noteEl.hidden = !detail;
    }
    cardEl.classList.remove("in");
    void cardEl.offsetWidth;
    cardEl.classList.add("in");
  };
  const note = (text) => {
    if (noteEl) noteEl.textContent = text;
  };
  const bar = (pct) => {
    if (barEl) barEl.style.width = pct + "%";
  };
  const step = (key, state) => {
    const item = stepEls.find((node) => node.dataset.step === key);
    if (!item) return;
    item.classList.toggle("on", state === "on");
    item.classList.toggle("done", state === "done");
  };
  const showScene = (key) => {
    Object.entries(scenes).forEach(([name, node]) => {
      if (!node) return;
      if (name === key) {
        node.classList.add("on");
        node.classList.remove("leaving");
      } else if (node.classList.contains("on")) {
        node.classList.remove("on");
        node.classList.add("leaving");
      }
    });
  };

  Object.values(scenes).forEach((node) => node && node.classList.remove("on", "leaving"));
  root.classList.remove("done");
  root.classList.add("playing");
  cardEl.classList.remove("in");
  root.dataset.beat = "prep";
  if (browseEl) browseEl.hidden = true;
  bar(0);
  stepEls.forEach((node) => node.classList.remove("on", "done"));

  const slate = buildSlate(scenes.boot, marks.length);
  showScene("boot");
  step("cache", "on");
  note("Fetching every popular mark once, so the film never stutters.");

  let landed = 0;
  const landedMark = (mark) => {
    if (stopped) return;
    landed += 1;
    slate.paint(landed);
    bar(Math.round((landed / marks.length) * AT.cache));
    note("Caching " + mark.name + " · " + landed + " of " + marks.length + ".");
  };

  async function gather() {
    if (preloadRun) {
      // A previous open already warmed the cache: pour it in on a steady drip,
      // so the count still reads as work being done.
      await preloadRun;
      for (const mark of marks) {
        if (stopped) return;
        landedMark(mark);
        await sleep(14);
      }
      return;
    }
    await preload(landedMark);
  }

  function finish() {
    if (stopped) return;
    showScene("poster");
    step("play", "done");
    card(
      "title",
      "Now showing",
      "Luma Pay",
      totalStores + " stores · " + marks.length + " marks — every one of them in All stores."
    );
    bar(AT.done);
    if (browseEl) browseEl.hidden = false;
    root.classList.add("done");
    root.classList.remove("playing");
  }

  function play() {
    if (stopped) return;
    step("build", "done");
    step("play", "on");

    bar(AT.orbit);
    showScene("orbit");
    card(
      "orbit",
      "In every aisle",
      totalStores + " stores",
      "Every storefront Luma Pay works on — codes, cashback and prices, in one panel."
    );

    later(() => {
      if (stopped) return;
      bar(AT.wall);
      showScene("wall");
      card(
        "wall",
        "Every code",
        "One tap",
        "A code is typed into the store's own field, and the page confirms it."
      );
    }, ORBIT_MS);

    later(() => {
      if (stopped) return;
      showScene(null);
      card("tag", "", "Shop like you know every code.", "");
    }, ORBIT_MS + WALL_MS);

    later(finish, ORBIT_MS + WALL_MS + TAG_MS);
  }

  (async () => {
    await gather();
    if (stopped) return;
    slate.paint(marks.length);
    bar(AT.cache);
    note("All " + marks.length + " popular marks are on the reel.");
    await sleep(560);
    if (stopped) return;
    step("cache", "done");

    // Decode pass: paint-ready before any tile is shown.
    step("decode", "on");
    const frames = marks.map((mark) => cache.get(mark.host)).filter(Boolean);
    await Promise.all([
      Promise.all(frames.map((img) => (img.decode ? img.decode().catch(() => {}) : null))),
      sleep(420),
    ]);
    if (stopped) return;
    step("decode", "done");

    // Build every shot up front: the film itself does no layout work.
    step("build", "on");
    bar(AT.decode);
    buildOrbit(scenes.orbit, stage, marks);
    buildWall(scenes.wall, marks);
    buildPoster(scenes.poster, stage, marks);
    await sleep(460);
    if (stopped) return;

    if (reduce) {
      finish();
      return;
    }
    play();
  })();

  return stop;
}
