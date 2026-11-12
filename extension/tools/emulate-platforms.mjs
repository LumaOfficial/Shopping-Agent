#!/usr/bin/env node
// Cross-platform run, without a Windows, Mac and Linux machine on the desk.
//
//   node tools/emulate-platforms.mjs
//
// Each row emulates the strings one desktop's browser hands the extension, then
// drives the real modules: platform detection, the tour's own wording, the
// on-device face detector on a close-up frame, and the real service worker's
// store resolution. Only navigator is emulated — every branch of the extension
// itself is the shipped one, so a change that only works on the author's OS
// fails here and the process exits non-zero.
import { loadWorker } from "../test/fake-chrome.mjs";
import { platformFrom, platformInfo, shortcutLabel } from "../src/lib/platform.js";
import { platformStep, tourSteps } from "../src/lib/tutorial.js";
import { summarize, judgeLocal } from "../src/lib/age-local.js";
import { STEPS, judgePose, poseFrom } from "../src/lib/face-rotate.js";
import { catalogOffers } from "../src/lib/catalog.js";
import { closeUpFrame, scanStats, turnFrame } from "../test/frames.mjs";
import { signUp } from "../src/lib/accounts.js";

const SIDE = 256;

const MACHINES = [
  {
    name: "Windows 11 · Chrome",
    env: {
      platform: "Win32",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    want: "windows",
  },
  {
    name: "Windows 10 · Edge",
    env: {
      platform: "Win32",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    },
    want: "windows",
  },
  {
    name: "macOS 15 · Chrome",
    env: {
      platform: "MacIntel",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    want: "mac",
  },
  {
    name: "macOS 15 · Opera",
    env: {
      platform: "MacIntel",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
    },
    want: "mac",
  },
  {
    name: "Ubuntu 24.04 · Chromium",
    env: {
      platform: "Linux x86_64",
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    want: "linux",
  },
  {
    name: "Linux · Opera",
    env: {
      platform: "Linux x86_64",
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
    },
    want: "linux",
  },
  {
    name: "ChromeOS · Chrome",
    env: {
      platform: "Linux x86_64",
      userAgent:
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    want: "chromeos",
  },
];

const PERSON = {
  fullName: "Emulation Runner",
  email: "emulation.runner@example.com",
  phone: "+1 555 010 1212",
  dob: "1989-09-09",
  password: "testing12345",
};

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
}

async function storeRows(url) {
  const fake = await loadWorker();
  try {
    const signed = await signUp(PERSON);
    if (!signed.ok) return { ok: false, detail: "signup failed" };
    const payload = await fake.send({ type: "site:resolve", url });
    if (!payload || !payload.store) return { ok: false, detail: "no store resolved" };
    const rows = Array.isArray(payload.offers) ? payload.offers.length : 0;
    return {
      ok: rows > 0 && payload.catalog && payload.catalog.source === "starter",
      detail: payload.store.name + " · " + rows + " rows",
    };
  } finally {
    delete globalThis.chrome;
  }
}

async function run(machine) {
  const platform = platformFrom(machine.env);
  const info = platformInfo(platform);
  const step = platformStep(platform);

  // The face check, on a close-up frame: the case that used to ask people to
  // lean back until their face was small enough.
  const baseline = poseFrom(summarize(closeUpFrame(0), SIDE, SIDE), SIDE);
  const turned = poseFrom(summarize(turnFrame(8, 0, 0.97, 1.4), SIDE, SIDE), SIDE);
  const turn = judgePose(STEPS[1], turned, baseline).ok;
  const verdict = judgeLocal(scanStats(closeUpFrame(0), closeUpFrame(2)));
  const face = baseline ? verdict.state === "verified" && turn : false;

  const rows = await storeRows("https://www.target.com/cart");
  const catalog = catalogOffers("target").length > 0;

  return {
    machine: machine.name,
    platform,
    platformOk: platform === machine.want,
    shortcut: shortcutLabel(platform),
    tour: step.kicker,
    tourOk: step.kicker === info.label && tourSteps(platform).length === 7,
    face,
    faceDetail: baseline ? "share " + baseline.share.toFixed(2) + " · turn " + (turn ? "ok" : "missed") : "no face",
    rowsOk: rows.ok && catalog,
    rowsDetail: rows.detail,
  };
}

const results = [];
for (const machine of MACHINES) results.push(await run(machine));

const header = [
  pad("Machine", 24),
  pad("Detected", 10),
  pad("Shortcut", 18),
  pad("Tour step", 12),
  pad("Close-up scan", 28),
  pad("Store rows", 22),
].join("");
console.log(header);
console.log("-".repeat(header.length));
results.forEach((row) => {
  console.log(
    [
      pad(row.machine, 24),
      pad(row.platform, 10),
      pad(row.shortcut || "none", 18),
      pad(row.tour, 12),
      pad((row.face ? "pass" : "FAIL") + " · " + row.faceDetail, 28),
      pad((row.rowsOk ? "pass" : "FAIL") + " · " + row.rowsDetail, 22),
    ].join("")
  );
});

const failures = results.filter((row) => !row.platformOk || !row.tourOk || !row.face || !row.rowsOk);
console.log("");
if (failures.length) {
  failures.forEach((row) => {
    console.log(
      "FAIL " +
        row.machine +
        ": platform " +
        (row.platformOk ? "ok" : "wrong") +
        ", tour " +
        (row.tourOk ? "ok" : "wrong") +
        ", close-up scan " +
        (row.face ? "ok" : "rejected") +
        ", store rows " +
        (row.rowsOk ? "ok" : "missing")
    );
  });
  process.exitCode = 1;
} else {
  console.log("All " + results.length + " desktops passed on the shipped code.");
}
