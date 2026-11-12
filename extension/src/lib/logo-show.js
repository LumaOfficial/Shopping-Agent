// The "Animate" trailer on the panel's All stores card.
//
// The whole show is cached and built before the first scene paints: every
// popular mark is fetched and decoded, then the orbit, the logo wall and the
// mosaic are laid out off-screen. The opening therefore says what it is really
// doing, and nothing pops in halfway through a scene. Presentational only — it
// reads the catalog for its closing count, reports its own progress, and lets
// the panel wire the close and Browse buttons.
import { BRAND_MARKS, initials, markUrl } from "./brand-marks.js";

const CONCURRENCY = 8;
const PRELOAD_LIMIT_MS = 20000;
const ORBIT_MS = 6600;
const WALL_MS = 5800;

// Progress at each beat of the show, so the bar tracks the real work first and
// the scenes after it.
const AT = { cache: 30, decode: 38, build: 50, orbit: 74, wall: 92, done: 100 };

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

// The opening: a progress dial that fills with the marks themselves, one tile
// per cached logo, while the copy underneath names the step.
function buildBoot(scene, total, later, onPaint) {
  scene.textContent = "";
  const boot = el("div", "boot");
  const halo = el("div", "boot-halo");
  const dial = el("div", "boot-dial");

  const core = el("div", "boot-core");
  const pct = el("strong", "boot-pct");
  const num = el("b");
  num.textContent = "0";
  const sign = el("span");
  sign.textContent = "%";
  pct.append(num, sign);
  const unit = el("em");
  unit.textContent = "marks cached";
  core.append(pct, unit);

  const slots = [];
  for (let i = 0; i < total; i += 1) slots.push(el("span", "boot-slot"));

  boot.append(halo, dial, core);
  scene.appendChild(boot);

  // Slots ride the dial itself, so the ring visibly fills as marks arrive.
  const radius = Math.round(boot.clientWidth * 0.47);
  const ring = el("div", "boot-ring");
  slots.forEach((slot, i) => {
    slot.style.setProperty("--a", Math.round((360 / total) * i - 90) + "deg");
    slot.style.setProperty("--r", radius + "px");
    ring.appendChild(slot);
  });
  boot.appendChild(ring);

  const order = shuffled(slots.map((_, i) => i));
  let placed = 0;

  // Marks are poured in on a steady drip, so the ring fills in front of the
  // shopper even when the browser answers from its own cache in a blink.
  const queue = [];
  const waiting = [];
  let draining = false;

  const paintNow = (mark) => {
    const slot = slots[order[placed % order.length]];
    placed += 1;
    const img = el("img", "boot-mark");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = markUrl(mark.host);
    if (cache.get(mark.host)) {
      slot.appendChild(img);
      slot.classList.add("lit");
    } else {
      slot.classList.add("missed");
    }
    if (onPaint) onPaint(placed, mark);
  };

  const drip = () => {
    if (!queue.length) {
      draining = false;
      waiting.splice(0).forEach((resolve) => resolve());
      return;
    }
    paintNow(queue.shift());
    later(drip, 24);
  };

  return {
    paint(mark) {
      queue.push(mark);
      if (draining) return;
      draining = true;
      later(drip, 0);
    },
    // Resolves once every queued mark has landed on the dial.
    settle() {
      if (!draining && !queue.length) return Promise.resolve();
      return new Promise((resolve) => waiting.push(resolve));
    },
    progress(done) {
      const share = total ? Math.min(1, done / total) : 1;
      dial.style.setProperty("--p", String(share));
      num.textContent = String(Math.round(share * 100));
    },
  };
}

// Scene 1: three rings turning at different speeds around the wordmark.
function buildOrbit(scene, stage, marks) {
  scene.textContent = "";
  const disc = el("div", "show-disc");
  const size = Math.min(stage.clientWidth, stage.clientHeight) * 0.98;
  const order = shuffled(marks);
  const rings = [
    { count: 14, radius: 0.19, tile: 0.068, dur: 26, tint: "far", reverse: true },
    { count: 18, radius: 0.31, tile: 0.082, dur: 34, tint: "mid", reverse: false },
    { count: 20, radius: 0.45, tile: 0.098, dur: 44, tint: "near", reverse: true },
  ];

  let cursor = 0;
  rings.forEach((ring) => {
    const rail = el("div", "show-ring " + ring.tint + (ring.reverse ? " rev" : ""));
    rail.style.setProperty("--dur", ring.dur + "s");
    const radius = Math.round(size * ring.radius);
    const tileSize = Math.max(26, Math.round(size * ring.tile));
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

  const core = el("div", "orbit-core");
  const word = el("strong");
  word.textContent = "Luma Pay";
  const sub = el("small");
  sub.textContent = marks.length + " popular marks";
  core.append(word, sub);
  disc.appendChild(core);

  scene.appendChild(disc);
}

// Scene 2: a tilted wall of logo bands drifting in opposite directions.
const WALL_ROWS = [
  { tile: 64, dur: 34, reverse: false },
  { tile: 52, dur: 42, reverse: true },
  { tile: 72, dur: 37, reverse: false },
  { tile: 56, dur: 46, reverse: true },
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

// Scene 3: every mark settles into a mosaic.
function buildMosaic(scene, stage, marks) {
  scene.textContent = "";
  const grid = el("div", "show-mosaic-grid");
  const cols = Math.max(4, Math.min(9, Math.floor(stage.clientWidth / 72)));
  const rows = Math.max(3, Math.min(7, Math.floor((stage.clientHeight * 0.56) / 72)));
  grid.style.setProperty("--cols", String(cols));
  shuffled(marks)
    .slice(0, cols * rows)
    .forEach((mark, index) => {
      const tile = makeTile(mark);
      tile.classList.add("show-pop");
      tile.style.animationDelay = Math.min(index * 14, 620) + "ms";
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
    mosaic: root.querySelector('[data-scene="mosaic"]'),
  };
  const stepEl = root.querySelector("[data-show-step]");
  const titleEl = root.querySelector("[data-show-title]");
  const noteEl = root.querySelector("[data-show-note]");
  const barEl = root.querySelector("[data-show-bar]");
  const browseEl = root.querySelector("[data-show-browse]");
  const stepEls = Array.from(root.querySelectorAll("[data-step]"));
  if (!stage || !scenes.boot) return () => {};

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
  };

  const say = (step, title, note) => {
    if (stepEl) stepEl.textContent = step;
    if (titleEl) titleEl.textContent = title;
    if (noteEl) noteEl.textContent = note;
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
  if (browseEl) browseEl.hidden = true;
  bar(0);
  stepEls.forEach((node) => node.classList.remove("on", "done"));

  const boot = buildBoot(scenes.boot, marks.length, later, (count, mark) => {
    if (stopped) return;
    boot.progress(count);
    bar(Math.round((count / marks.length) * AT.cache));
    note("Caching " + mark.name + " · " + count + " of " + marks.length + ".");
  });
  showScene("boot");
  step("cache", "on");
  say("All stores", "Caching the logos", "Fetching every popular mark once, so the film never stutters.");
  boot.progress(0);

  async function gather() {
    if (preloadRun) {
      // A previous open already warmed the cache: pour it straight into the
      // dial, which paces the fill on its own.
      await preloadRun;
      if (stopped) return false;
      shuffled(marks).forEach((mark) => boot.paint(mark));
      return true;
    }

    await preload((mark) => {
      if (!stopped) boot.paint(mark);
    });
    return true;
  }

  function finish() {
    if (stopped) return;
    showScene("mosaic");
    step("play", "done");
    say(
      "Act 3 · Your panel",
      marks.length + " marks, " + totalStores + " stores",
      "Every one of them is in All stores — tap Browse to open any of them."
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
    say(
      "Act 1 · The shortlist",
      "The names you know",
      "The storefronts shoppers reach for most, orbiting in one panel."
    );
    bar(AT.orbit);
    showScene("orbit");

    later(() => {
      if (stopped) return;
      bar(AT.wall);
      say(
        "Act 2 · Every aisle",
        "Every aisle, one panel",
        "Fashion, tech, home and travel — codes, cashback and price history everywhere."
      );
      showScene("wall");
      later(finish, WALL_MS);
    }, ORBIT_MS);
  }

  (async () => {
    await gather();
    if (stopped) return;
    await boot.settle();
    if (stopped) return;
    boot.progress(marks.length);
    note("All " + marks.length + " popular marks are cached.");
    await sleep(520);
    if (stopped) return;
    step("cache", "done");

    // Decode pass: paint-ready before any tile is shown.
    step("decode", "on");
    bar(AT.cache);
    say("All stores", "Decoding the marks", "Making every logo ready to paint, so no tile flickers mid-scene.");
    const frames = marks.map((mark) => cache.get(mark.host)).filter(Boolean);
    await Promise.all([
      Promise.all(frames.map((img) => (img.decode ? img.decode().catch(() => {}) : null))),
      sleep(420),
    ]);
    if (stopped) return;
    step("decode", "done");

    // Build every scene up front: the show itself does no layout work.
    step("build", "on");
    bar(AT.decode);
    say("All stores", "Building the scenes", "Laying out the orbit, the logo wall and the mosaic before the film rolls.");
    buildOrbit(scenes.orbit, stage, marks);
    buildWall(scenes.wall, marks);
    buildMosaic(scenes.mosaic, stage, marks);
    await sleep(480);
    if (stopped) return;

    if (reduce) {
      finish();
      return;
    }
    play();
  })();

  return stop;
}
