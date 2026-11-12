// The tour card in the panel: one step at a time, in the order a shopper meets
// the features. Progress is device state (see tutorial.js), so closing the panel
// mid-tour resumes where it stopped, and Settings can replay it later.
import { TOUR_KEY, TOUR_VERSION, readTour, tourSteps } from "./tutorial.js";
import { detectPlatform } from "./platform.js";

const byId = (id) => document.getElementById(id);

export function startTour(options) {
  const onChange = (options && options.onChange) || function () {};
  const root = byId("tour-block");
  const dots = byId("tour-dots");
  const points = byId("tour-points");
  if (!root) {
    return { open() {}, hide() {}, isOpen: () => false, refresh() {} };
  }

  let index = 0;
  let steps = tourSteps(detectPlatform());
  let visible = false;

  function paintDots() {
    if (!dots) return;
    while (dots.firstChild) dots.removeChild(dots.firstChild);
    steps.forEach((_step, at) => {
      const dot = document.createElement("i");
      if (at < index) dot.className = "done";
      if (at === index) dot.className = "on";
      dots.appendChild(dot);
    });
  }

  function paint() {
    const step = steps[Math.min(index, steps.length - 1)];
    const last = index >= steps.length - 1;
    byId("tour-kicker").textContent = step.kicker + " \u00b7 " + (index + 1) + " of " + steps.length;
    byId("tour-title").textContent = step.title;
    byId("tour-body").textContent = step.body;
    byId("tour-next").textContent = last ? "Start saving" : "Next";
    byId("tour-back").disabled = index === 0;
    if (points) {
      while (points.firstChild) points.removeChild(points.firstChild);
      (step.points || []).forEach((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        points.appendChild(item);
      });
    }
    paintDots();
  }

  async function remember(done, reason) {
    try {
      await chrome.storage.local.set({
        [TOUR_KEY]: {
          version: TOUR_VERSION,
          done,
          step: done ? 0 : index,
          at: Date.now(),
          reason: reason || "",
        },
      });
    } catch (_error) {
      // Storage blocked: the tour simply opens again next time.
    }
  }

  function openTour(at) {
    const start = Number(at);
    index = isFinite(start) && start >= 0 ? Math.min(start, steps.length - 1) : index;
    steps = tourSteps(detectPlatform());
    visible = true;
    root.hidden = false;
    paint();
    onChange(true);
    const next = byId("tour-next");
    if (next) next.focus({ preventScroll: true });
  }

  function hide() {
    visible = false;
    root.hidden = true;
    onChange(false);
  }

  function finish(reason) {
    remember(true, reason);
    hide();
  }

  function goNext() {
    if (index >= steps.length - 1) {
      finish("finished");
      byId("saved-total").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    index += 1;
    remember(false, "progress");
    paint();
  }

  function goBack() {
    if (index <= 0) return;
    index -= 1;
    remember(false, "progress");
    paint();
  }

  byId("tour-next").addEventListener("click", goNext);
  byId("tour-back").addEventListener("click", goBack);
  byId("tour-skip").addEventListener("click", () => finish("skipped"));

  return {
    open: openTour,
    hide,
    finish,
    isOpen: () => visible,
    // Re-reads the platform, so a tour left open while the preview switches OS
    // names the new desktop rather than the old one.
    refresh() {
      steps = tourSteps(detectPlatform());
      if (visible) paint();
    },
    async resume() {
      try {
        const stored = await chrome.storage.local.get(TOUR_KEY);
        const state = readTour(stored[TOUR_KEY]);
        if (state.done) return false;
        openTour(state.step);
        return true;
      } catch (_error) {
        return false;
      }
    },
  };
}
