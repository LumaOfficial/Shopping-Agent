// The guided rotation: the panel asks for straight-on, left, right and up, and
// only a scan whose views agree as one face is allowed to reach the worker.
//
//   node --test extension/test
import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./fake-chrome.mjs";
import { SIDE, faceFrame, turnFrame } from "./frames.mjs";
import { motion, summarize } from "../src/lib/age-local.js";
import { STEPS, compareModel, judgePose, poseFrom } from "../src/lib/face-rotate.js";
import { signUp } from "../src/lib/accounts.js";

function view(id, frame) {
  const stats = summarize(frame, SIDE, SIDE);
  return { id, pose: poseFrom(stats, SIDE), stats };
}

// The four angles a completed scan keeps. The turns are drawn moving the head
// about as far as a person turning to be scanned does.
const straight = () => view("center", faceFrame(0));
const turnLeft = () => view("left", turnFrame(14, 0, 0.94));
const turnRight = () => view("right", turnFrame(-14, 0, 0.94));
const tiltUp = () => view("up", turnFrame(0, -16, 1));
const guided = () => [straight(), turnLeft(), turnRight(), tiltUp()];

const PERSON = {
  fullName: "Rotation Tester",
  email: "rotation.tester@example.com",
  phone: "+1 555 010 4444",
  dob: "1988-02-02",
  password: "testing12345",
};

test("the first angle needs the face straight on, in the middle of the ring", async () => {
  assert.equal(judgePose(STEPS[0], straight().pose, null).ok, true);

  const offCentre = poseFrom(summarize(turnFrame(52, 0, 1), SIDE, SIDE), SIDE);
  const verdict = judgePose(STEPS[0], offCentre, null);
  assert.equal(verdict.ok, false);
  assert.match(verdict.hint, /middle of the ring/i);
});

test("a turn is read on the side the mirrored preview shows", async () => {
  const baseline = straight().pose;
  const toTheLeft = turnLeft().pose;
  const toTheRight = turnRight().pose;

  assert.ok(toTheLeft.x < baseline.x, "the left turn sits to the left of the straight-on view");
  assert.ok(toTheRight.x > baseline.x, "and the right turn to the right");
  assert.equal(judgePose(STEPS[1], toTheLeft, baseline).ok, true);
  assert.equal(judgePose(STEPS[2], toTheRight, baseline).ok, true);
});

test("turning the wrong way says so instead of passing", async () => {
  const baseline = straight().pose;
  const verdict = judgePose(STEPS[1], turnRight().pose, baseline);
  assert.equal(verdict.ok, false);
  assert.match(verdict.hint, /other way/i);
});

test("a tilt up is read from the face sitting higher in the frame", async () => {
  const baseline = straight().pose;
  assert.equal(judgePose(STEPS[3], tiltUp().pose, baseline).ok, true);
  assert.equal(judgePose(STEPS[3], straight().pose, baseline).ok, false);
});

test("an angle reports how far it has come, so the ring can fill on the way", async () => {
  const baseline = straight().pose;
  const partway = poseFrom(summarize(turnFrame(6, 0, 0.97), SIDE, SIDE), SIDE);
  const verdict = judgePose(STEPS[1], partway, baseline);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.progress > 0 && verdict.progress < 1, "a half turn reports partway");
  assert.equal(judgePose(STEPS[1], turnLeft().pose, baseline).progress, 1, "a full turn reports done");
});

test("a dropped chin is told to lift, not to turn sideways", async () => {
  const baseline = straight().pose;
  const chinDown = poseFrom(summarize(turnFrame(0, 16, 1), SIDE, SIDE), SIDE);
  const verdict = judgePose(STEPS[3], chinDown, baseline);
  assert.equal(verdict.ok, false);
  assert.match(verdict.hint, /lift your chin/i);
  assert.doesNotMatch(verdict.hint, /left|right/i);
});

test("a frame with nobody in it can never be kept as an angle", async () => {
  const empty = poseFrom(summarize(new Uint8Array(SIDE * SIDE * 4).fill(60), SIDE, SIDE), SIDE);
  assert.equal(empty, null);
  const verdict = judgePose(STEPS[0], empty, null);
  assert.equal(verdict.ok, false);
  assert.match(verdict.hint, /looking for your face/i);
});

test("the four angles hold together as one face model", async () => {
  const verdict = compareModel(guided());
  assert.equal(verdict.ok, true, verdict.message);
  assert.equal(verdict.model.views, STEPS.length);
  assert.ok(verdict.model.spreadX >= 0.035, "the model saw the sideways travel");
  assert.ok(verdict.model.spreadY >= 0.028, "and the travel up");
});

test("views that never moved are not a model and are not submitted", async () => {
  const verdict = compareModel([straight(), straight(), straight(), straight()]);
  assert.equal(verdict.ok, false);
  assert.match(verdict.message, /sideways/i);
});

test("a scan that stopped halfway is not a model either", async () => {
  const verdict = compareModel([straight(), turnLeft()]);
  assert.equal(verdict.ok, false);
  assert.match(verdict.message, /2 of 4 angles/i);
});

test("a finished guided scan reaches the worker and unlocks the boost", async (t) => {
  const fake = await loadWorker();
  t.after(() => {
    delete globalThis.chrome;
  });
  assert.equal((await signUp(PERSON)).ok, true);

  const views = guided();
  assert.equal(compareModel(views).ok, true, "the panel only submits a scan whose model holds");

  // The payload age-panel.js builds from the kept views: the straight-on numbers
  // plus the movement seen across the turns.
  const centre = views[0].stats;
  const moved = motion(views[0].stats.luma, views[1].stats.luma, views[0].stats.box);
  const stats = {
    faceFound: centre.found,
    faceShare: centre.share,
    fill: centre.fill,
    aspect: centre.aspect,
    contrast: centre.contrast,
    brightness: centre.brightness,
    motion: moved,
    skinShare: centre.share,
  };

  const reply = await fake.send({ type: "age:local", stats });
  assert.equal(reply.ok, true, reply.error);
  assert.equal(reply.state, "verified");
  assert.equal((await fake.send({ type: "age:status" })).state, "verified");
});
