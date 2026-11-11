// The on-device face check: no provider, no key, no network. The panel measures
// the frames it takes and this module judges the measurement, so the check works
// on a fresh install with nothing configured.
//
// What it can prove is limited, and the panel says so: a live face is in front of
// the camera on this device, and the account's own date of birth says 18+. It is
// not a third-party age estimate. Point the panel at an age check relay
// (server/age-verify.mjs) if you want one of those.
export const LOCAL_PROVIDER = "On-device check";

// Thresholds kept generous: ordinary indoor light, an unposed selfie.
export const MIN_SKIN = 0.02;
export const MAX_SKIN = 0.7;
export const MIN_BRIGHTNESS = 45;
export const MAX_BRIGHTNESS = 232;
export const MIN_MOTION = 0.06;

// One RGBA frame summarised: how much of it reads as skin, how bright it is, and
// a luma copy for comparing two frames.
export function summarize(data, width, height) {
  const pixels = Math.round(Number(width) * Number(height));
  if (!pixels || !data || data.length < pixels * 4) return null;
  const luma = new Uint8Array(pixels);
  let skin = 0;
  let total = 0;
  for (let index = 0; index < pixels; index += 1) {
    const red = data[index * 4];
    const green = data[index * 4 + 1];
    const blue = data[index * 4 + 2];
    const high = Math.max(red, green, blue);
    const low = Math.min(red, green, blue);
    if (
      red > 95 &&
      green > 40 &&
      blue > 20 &&
      high - low > 15 &&
      Math.abs(red - green) > 15 &&
      red > green &&
      red > blue
    ) {
      skin += 1;
    }
    const value = (red * 77 + green * 150 + blue * 29) >> 8;
    luma[index] = value;
    total += value;
  }
  return { skinShare: skin / pixels, brightness: total / pixels, luma };
}

// How much the picture changed between two frames, in luma levels per pixel. A
// person in front of the camera never holds perfectly still; a photo does.
export function motion(first, second) {
  if (!first || !second || first.length !== second.length || !first.length) return null;
  let total = 0;
  for (let index = 0; index < first.length; index += 1) {
    total += Math.abs(first[index] - second[index]);
  }
  return total / first.length;
}

// The verdict for the numbers the panel sent. Anything that does not clear every
// rule comes back "unclear" so it can simply be tried again.
export function judgeLocal(stats) {
  const value = stats || {};
  const skinShare = Number(value.skinShare);
  const brightness = Number(value.brightness);
  const moved =
    value.motion === null || typeof value.motion === "undefined" ? null : Number(value.motion);

  if (!isFinite(skinShare) || !isFinite(brightness)) {
    return { state: "unclear", message: "No frame arrived, so nothing was checked." };
  }
  if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS) {
    return {
      state: "unclear",
      message: "That frame was too dark or too bright. Face a lamp or a window and try again.",
    };
  }
  if (skinShare < MIN_SKIN) {
    return {
      state: "unclear",
      message: "No face was found in that frame. Fill the frame with your face and try again.",
    };
  }
  if (skinShare > MAX_SKIN) {
    return {
      state: "unclear",
      message: "That frame was too close to the lens. Move back a little and try again.",
    };
  }
  if (moved !== null && (!isFinite(moved) || moved < MIN_MOTION)) {
    return {
      state: "unclear",
      message: "That looked like a still picture rather than you. Sit in front of the camera and scan again.",
    };
  }
  return { state: "verified", message: "" };
}
