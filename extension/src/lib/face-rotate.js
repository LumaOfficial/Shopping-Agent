// Guided head rotation for the face scan. The panel asks for a few angles in
// turn; this module decides whether the face in a frame has actually reached the
// angle being asked for, and then whether the views it collected hold together
// as one face (the temporary model that double-checks the scan).
//
// Nothing here sees a picture: it works on the summary age-local.js already
// produces from a small copy of the frame. Nothing is stored.
import {
  MAX_BRIGHTNESS,
  MAX_FACE_SHARE,
  MIN_BRIGHTNESS,
  MIN_CONTRAST,
  MIN_FACE_SHARE,
  MIN_FILL,
} from "./age-local.js";

// How far the face has to travel from the straight-on view, as a share of the
// frame. Small enough for a head turned a comfortable amount, big enough that
// sitting still cannot pass for a turn.
export const TURN = 0.035;
// A turned face also reads narrower than a straight-on one, which is a second,
// independent sign of the same turn.
export const NARROW = 0.92;
// Where the straight-on view has to sit, from the middle of the frame.
export const CENTER_TOLERANCE = 0.12;
// The face has to hold an angle this many samples in a row, so a single lucky
// frame at the edge of the lens is not taken for a turn.
export const HOLD = 2;
// What a set of views may differ by before the model stops counting as one face.
export const LIGHT_DRIFT = 56;
export const CONTRAST_SPREAD = 30;

// The angles the panel asks for, in order. `turn` is what the little head model
// on screen rotates to, so the model shows the angle being asked for.
export const STEPS = [
  {
    id: "center",
    axis: "center",
    label: "Look straight at the camera",
    tip: "Line your face up with the ring",
    turn: { x: 0, y: 0 },
    short: "Straight",
  },
  {
    id: "left",
    axis: "x",
    sign: -1,
    label: "Turn your head to the left",
    tip: "Slowly, chin level, eyes back on the camera",
    turn: { x: -26, y: 0 },
    short: "Left",
  },
  {
    id: "right",
    axis: "x",
    sign: 1,
    label: "Now turn to your right",
    tip: "The same distance the other way",
    turn: { x: 26, y: 0 },
    short: "Right",
  },
  {
    id: "up",
    axis: "y",
    sign: -1,
    label: "Tilt your chin up",
    tip: "Keep your whole face inside the ring",
    turn: { x: 0, y: -20 },
    short: "Up",
  },
];

// Where the face sits in a measured frame, in the panel's own left/right: the
// preview is mirrored so it reads like a mirror, and this follows that.
export function poseFrom(stats, size) {
  const side = Number(size) || 0;
  if (!stats || !stats.found || !stats.box || !side) return null;
  const width = Number(stats.box.width) || 0;
  const height = Number(stats.box.height) || 0;
  if (!width || !height) return null;
  return {
    x: 0.5 - (stats.box.x + width / 2) / side,
    y: (stats.box.y + height / 2) / side - 0.5,
    width: width / side,
    height: height / side,
    aspect: width / height,
    share: Number(stats.share) || 0,
    fill: Number(stats.fill) || 0,
    contrast: Number(stats.contrast) || 0,
    brightness: Number(stats.brightness) || 0,
  };
}

// The same rules the on-device check applies to a frame, so an angle that could
// not be judged is never captured as one. A turned face is allowed to be narrow;
// that is what a turn looks like from the camera.
function usable(pose) {
  if (!pose) return "Looking for your face — face the camera in even light.";
  if (pose.share < MIN_FACE_SHARE) return "Come a little closer — fill the ring with your face.";
  if (pose.share > MAX_FACE_SHARE) return "You are too close to the lens. Move back a little.";
  if (pose.fill < MIN_FILL) return "Hold your whole face in the ring — no hand or hair over it.";
  if (pose.contrast < MIN_CONTRAST) return "No detail is visible. Face a lamp or a window.";
  if (pose.brightness < MIN_BRIGHTNESS) return "Too dark to read your face. Face a lamp or a window.";
  if (pose.brightness > MAX_BRIGHTNESS) return "Too bright to read your face. Step out of the glare.";
  return "";
}

// { ok, hint }: ok means this angle has been reached and can be kept.
export function judgePose(step, pose, baseline) {
  const problem = usable(pose);
  if (problem) return { ok: false, hint: problem };

  if (step.axis === "center") {
    if (Math.abs(pose.x) > CENTER_TOLERANCE || Math.abs(pose.y) > CENTER_TOLERANCE) {
      return { ok: false, hint: "Bring your face into the middle of the ring." };
    }
    if (pose.aspect < 0.5) {
      return { ok: false, hint: "Face the camera straight on to start the scan." };
    }
    return { ok: true, hint: "" };
  }

  const from = baseline || { x: 0, y: 0, aspect: pose.aspect, width: pose.width, height: pose.height };
  const along = step.axis === "x" ? pose.x - from.x : pose.y - from.y;
  const travelled = (step.sign || 1) * along;

  // Turned the other way: worth saying, because doing it again the same way
  // will never pass.
  if (travelled <= -TURN * 0.6) {
    return { ok: false, hint: "That is the other way — turn to your " + (step.sign < 0 ? "left" : "right") + "." };
  }
  if (step.axis === "x" && travelled < TURN) {
    const narrower = from.aspect && pose.aspect <= from.aspect * NARROW && travelled >= TURN * 0.45;
    if (!narrower) {
      return {
        ok: false,
        hint: travelled >= TURN * 0.45 ? "Almost — a little further to your " + (step.sign < 0 ? "left" : "right") + "." : step.label + ".",
      };
    }
  }
  if (step.axis === "y" && travelled < TURN) {
    return { ok: false, hint: travelled >= TURN * 0.4 ? "Almost — chin a little higher." : "Tilt your chin up." };
  }
  return { ok: true, hint: "" };
}

function span(values) {
  if (!values.length) return 0;
  return Math.max.apply(null, values) - Math.min.apply(null, values);
}

// The temporary model: what the collected views say about the face they show.
// It is built from the views only and dropped with them.
export function buildModel(views) {
  const list = (Array.isArray(views) ? views : []).filter((view) => view && view.pose);
  if (!list.length) return null;
  const poses = list.map((view) => view.pose);
  return {
    views: list.length,
    angles: list.map((view) => view.id),
    brightness: poses.reduce((total, pose) => total + pose.brightness, 0) / poses.length,
    contrast: Math.min.apply(null, poses.map((pose) => pose.contrast)),
    share: poses.reduce((total, pose) => total + pose.share, 0) / poses.length,
    spreadX: span(poses.map((pose) => pose.x)),
    spreadY: span(poses.map((pose) => pose.y)),
    aspect: poses.reduce((total, pose) => total + pose.aspect, 0) / poses.length,
  };
}

// The double check: do all the collected views describe the same face in the
// same light, having really moved between angles? If this cannot be shown, the
// scan does not claim a result — it asks to try again instead.
export function compareModel(views) {
  const list = (Array.isArray(views) ? views : []).filter((view) => view && view.pose);
  if (list.length < STEPS.length) {
    return { ok: false, message: "only " + list.length + " of " + STEPS.length + " angles were captured" };
  }
  const model = buildModel(list);
  const poses = list.map((view) => view.pose);
  const brightnesses = poses.map((pose) => pose.brightness);
  const contrasts = poses.map((pose) => pose.contrast);
  const shares = poses.map((pose) => pose.share);

  if (span(shares) > 0.5 || Math.min.apply(null, shares) < MIN_FACE_SHARE) {
    return { ok: false, message: "your face left the frame between angles" };
  }
  if (span(brightnesses) > LIGHT_DRIFT) {
    return { ok: false, message: "the light changed while you turned" };
  }
  if (span(contrasts) > CONTRAST_SPREAD || Math.min.apply(null, contrasts) < MIN_CONTRAST) {
    return { ok: false, message: "one of the angles lost the detail in your face" };
  }
  if (model.spreadX < TURN) {
    return { ok: false, message: "the views barely moved sideways" };
  }
  if (model.spreadY < TURN * 0.8) {
    return { ok: false, message: "the views barely moved up and down" };
  }
  return { ok: true, message: "", model };
}
