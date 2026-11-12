// The same extension ships to Windows, macOS and Linux. These tests emulate each
// desktop's navigator strings and camera framing, then drive the real modules, so
// a change that only works on the machine it was written on fails here.
//
//   node --test extension/test/platform.test.mjs
//   node extension/tools/emulate-platforms.mjs   # the same matrix as a report
import test from "node:test";
import assert from "node:assert/strict";
import { detectPlatform, isDesktop, platformFrom, platformInfo, platformLine, shortcutLabel } from "../src/lib/platform.js";
import { platformStep, readTour, tourSteps } from "../src/lib/tutorial.js";
import { summarize } from "../src/lib/age-local.js";
import { STEPS, compareModel, judgePose, poseFrom } from "../src/lib/face-rotate.js";
import { closeUpFrame, turnFrame } from "./frames.mjs";

const WINDOWS = {
  platform: "Win32",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};
const MAC = {
  platform: "MacIntel",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};
const LINUX = {
  platform: "Linux x86_64",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};
const CHROMEOS = {
  platform: "Linux x86_64",
  userAgent: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};
const EDGE_ON_WINDOWS = {
  platform: "Win32",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
};
const OPERA_ON_MAC = {
  platform: "MacIntel",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
};

const SIDE = 256;
const poseOf = (frame) => poseFrom(summarize(frame, SIDE, SIDE), SIDE);

test("every desktop the extension ships to is recognised from its own strings", () => {
  assert.equal(platformFrom(WINDOWS), "windows");
  assert.equal(platformFrom(MAC), "mac");
  assert.equal(platformFrom(LINUX), "linux");
  assert.equal(platformFrom(EDGE_ON_WINDOWS), "windows");
  assert.equal(platformFrom(OPERA_ON_MAC), "mac");
  // ChromeOS reports a Linux platform string, so its UA token has to win.
  assert.equal(platformFrom(CHROMEOS), "chromeos");
  // A phone is reported as a phone rather than guessed at.
  assert.equal(platformFrom({ platform: "Linux armv8l", userAgent: "Mozilla/5.0 (Linux; Android 14)" }), "android");
  assert.equal(platformFrom({}), "unknown");
  assert.equal(platformFrom({ platform: "linux" }), "linux", "an already-normalised name is accepted");
});

test("the shortcut printed is the one that desktop actually has", () => {
  assert.equal(shortcutLabel("windows"), "Alt + Shift + S");
  assert.equal(shortcutLabel("linux"), "Alt + Shift + S");
  assert.equal(shortcutLabel("mac"), "\u2325 + \u21e7 + S");
  assert.equal(shortcutLabel("chromeos"), "Alt + Shift + S");
  assert.ok(isDesktop("windows") && isDesktop("mac") && isDesktop("linux"));
  assert.equal(isDesktop("android"), false);
  assert.match(platformLine("mac"), /macOS/);
  assert.match(platformLine("linux"), /Alt \+ Shift \+ S/);
});

test("the tour's last step names the desktop the shopper is on", () => {
  const mac = platformStep("mac");
  const linux = platformStep("linux");
  assert.equal(mac.kicker, "macOS");
  assert.match(mac.body, /\u2325 \u21e7 S/);
  assert.equal(linux.kicker, "Linux");
  assert.match(linux.body, /Alt \+ Shift \+ S/);
  assert.ok(mac.points.some((line) => /macOS/.test(mac.title) || /toolbar/.test(line)));
  // The tour is the same length everywhere; only the wording of the last step moves.
  assert.equal(tourSteps("windows").length, tourSteps("mac").length);
  assert.equal(tourSteps("linux").length, 7);
  assert.equal(tourSteps("mac")[6].id, "desktop");
});

test("a seen tour stays seen, and a new version asks again", () => {
  assert.equal(readTour(null).done, false);
  assert.equal(readTour({ version: 2, done: true }).done, true);
  assert.equal(readTour({ version: 1, done: true }).done, false, "an older tour is offered again");
  assert.equal(readTour({ version: 2, done: true, step: 3 }).step, 0);
});

test("a close-up face at desk distance passes without leaning back", () => {
  const baseline = poseOf(closeUpFrame(0));
  assert.ok(baseline.share > 0.4, "the close-up really does fill the frame: " + baseline.share);
  assert.ok(baseline.share <= 0.94, "and is inside the close-of-lens limit");

  // Eight pixels of travel is what a comfortable turn looks like this close.
  const turned = poseOf(turnFrame(8, 0, 0.97, 1.4));
  assert.equal(judgePose(STEPS[1], turned, baseline).ok, true, "the left turn is accepted close up");
  const other = poseOf(turnFrame(-8, 0, 0.97, 1.4));
  assert.equal(judgePose(STEPS[2], other, baseline).ok, true, "and so is the right turn");
});

test("the same four angles hold together whether the camera is close or far", () => {
  const views = (scale) => [
    { id: "center", pose: poseOf(closeUpFrame(0)) },
    { id: "left", pose: poseOf(turnFrame(16 * scale, 0, 0.95, 1.4)) },
    { id: "right", pose: poseOf(turnFrame(-16 * scale, 0, 0.95, 1.4)) },
    { id: "up", pose: poseOf(turnFrame(0, -14 * scale, 1, 1.4)) },
  ];
  const verdict = compareModel(views(1));
  assert.equal(verdict.ok, true, verdict.message);
  assert.ok(verdict.model.spreadX > 0.05, "the model saw a real sideways turn");
});

test("a face off to one side of the frame is still accepted", () => {
  // Laptop cameras sit at the edge of a desk; the shopper should not have to
  // shuffle the chair to satisfy the oval.
  const offToTheSide = poseOf(turnFrame(34, 0, 1));
  assert.equal(judgePose(STEPS[0], offToTheSide, null).ok, true, "34px off centre is fine");
  const farTooFar = poseOf(turnFrame(90, 0, 1));
  assert.equal(judgePose(STEPS[0], farTooFar, null).ok, false, "but not off the edge of the frame");
});

test("platform detection never throws when navigator is missing", () => {
  assert.equal(typeof detectPlatform(), "string");
  assert.ok(platformInfo("does-not-exist").label.length > 0);
  assert.equal(platformInfo("unknown").label, "your computer");
});
