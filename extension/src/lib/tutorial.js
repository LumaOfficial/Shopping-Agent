// The newcomer's tour. It explains the panel in the order a shopper meets it,
// one screen at a time, and the last step is written for the desktop they are
// actually on. The copy lives here rather than in the markup so the tests can
// read exactly what a shopper will read.
//
// Progress is device state, not account state: someone who has seen the tour
// does not need it again after signing out, and a new version of the tour can
// be offered again without touching an account.
import { detectPlatform, platformInfo } from "./platform.js";

export const TOUR_KEY = "tour";
export const TOUR_VERSION = 2;

export const TOUR_STEPS = [
  {
    id: "welcome",
    kicker: "Welcome",
    title: "Your savings, on every shop you open",
    body:
      "Luma Pay reads the store page you are already on for codes, cashback and price history. " +
      "Nothing to set up: open it beside a shop and it fills in.",
    points: [
      "One panel, on every shop it covers \u2014 no tab switching.",
      "Codes are tried in the store's own promo field, never anywhere else.",
      "Everything stays in this browser profile.",
    ],
  },
  {
    id: "codes",
    kicker: "Codes",
    title: "A code only counts once the page says so",
    body:
      "Codes come from the page itself \u2014 banners, the cart, the store's deals. " +
      "Tap Apply and the panel types it into the store's promo field, then reads the store's own answer.",
    points: [
      "A code that worked is remembered for next time.",
      "A code that failed is marked dead instead of offered again.",
      "Every row says where it came from: on page, feed, or yours.",
    ],
  },
  {
    id: "cashback",
    kicker: "Cashback",
    title: "Cashback that turns into a card",
    body:
      "When a store pays cashback, the panel tracks it through your account. " +
      "It stays pending until the store's return window closes, then it is available to cash out.",
    points: [
      "Pending, available and paid out are shown apart, never blurred together.",
      "Cash out to a virtual Visa once the balance clears the payout minimum.",
      "The 3% face-check boost applies to new earnings only.",
    ],
  },
  {
    id: "prices",
    kicker: "Prices",
    title: "Know the price before you pay it",
    body:
      "Every product page you open records the price you saw, on this device. " +
      "The panel compares it with the low it knows and tells you whether this is a good moment.",
    points: [
      "A 90-day low is added when a product API is connected.",
      "Nothing is uploaded unless you connect a source.",
      "The meter shows where today's price sits in what it has seen.",
    ],
  },
  {
    id: "scan",
    kicker: "Face scan",
    title: "The face scan is short, and it works close up",
    body:
      "Only a cash out needs it. You look straight at the camera, then turn left, right and tilt up. " +
      "Sit where your face fits the oval \u2014 a webcam's normal distance is fine.",
    points: [
      "Nothing is recorded and no picture is kept.",
      "Any comfortable distance works; you never need to lean far back.",
      "Skip it whenever you like \u2014 codes and prices still work.",
    ],
  },
  {
    id: "ads",
    kicker: "Ads",
    title: "Quiet shops, and the value is counted",
    body:
      "With ad blocking on, the ad slots the panel hides add up to a figure in your wallet, " +
      "at a published rate. It is a switch, not a subscription.",
    points: [
      "Blocking starts only after you agree to the terms.",
      "The switch in Settings stops it again immediately.",
      "Blocked-today and all-time counts sit next to the value.",
    ],
  },
];

// The last step names the shopper's own desktop and its shortcut. It is built
// at open time, so the preview's OS switcher and a real Windows or Mac both see
// the truth rather than a generic guess.
export function platformStep(platform) {
  const info = platformInfo(platform || detectPlatform());
  return {
    id: "desktop",
    kicker: info.label,
    title: "Built for " + info.label,
    body:
      (info.shortcut
        ? "This is the same extension on Windows, macOS and Linux. " + info.line
        : "The panel runs in the desktop browsers.") +
      " Settings, the store list and the tour are all in the panel's own corner.",
    points: [
      info.shortcut
        ? "The panel opens from " + info.where + ", or with " + info.shortcut + "."
        : "The account works wherever you sign in on a desktop browser.",
      "Every store the panel covers is listed under Browse.",
      "This tour can be replayed from Settings at any time.",
    ],
  };
}

export function tourSteps(platform) {
  return TOUR_STEPS.concat([platformStep(platform)]);
}

export function readTour(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const version = Number(value.version) || 0;
  const done = value.done === true && version >= TOUR_VERSION;
  return {
    done,
    // A finished tour has no step to resume; an unfinished one picks up where it
    // stopped, as long as it is the current version.
    step: done || version < TOUR_VERSION ? 0 : Math.max(0, Number(value.step) || 0),
    version,
  };
}
