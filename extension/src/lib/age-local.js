// The on-device face check: no provider, no key, no network. The panel measures
// the frames it takes and this module judges the measurement, so the check works
// on a fresh install with nothing configured.
//
// What it can prove is limited, and the panel says so: a live face is in front of
// the camera on this device, and the account's own date of birth says 18+. It is
// not a third-party age estimate. Point the panel at an age check relay
// (server/age-verify.mjs) if you want one of those.
export const LOCAL_PROVIDER = "On-device check";

// A face has to fill a useful part of the frame, be roughly face-shaped, carry
// some facial detail, sit in usable light and move a little between two frames.
// The numbers are kept generous so ordinary indoor light and an unposed selfie
// pass on the first try.
export const MIN_FACE_SHARE = 0.03;
export const MAX_FACE_SHARE = 0.8;
export const MIN_FILL = 0.3;
export const MIN_ASPECT = 0.5;
export const MAX_ASPECT = 1.9;
export const MIN_CONTRAST = 8;
export const MIN_BRIGHTNESS = 45;
export const MAX_BRIGHTNESS = 232;
export const MIN_MOTION = 0.05;

// Skin lives in a narrow band of chroma whatever the tone or the lamp, which is
// why this reads Cb/Cr rather than raw red/green/blue: a bright wall and a pale
// face are far apart here, a dark face and a shadowed room are not far apart in
// RGB.
function isSkin(red, green, blue) {
  const luma = 0.299 * red + 0.587 * green + 0.114 * blue;
  if (luma < 35) return false;
  const cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
  const cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;
  return cb >= 72 && cb <= 132 && cr >= 128 && cr <= 182;
}

// The biggest patch of skin in the frame, on a coarse grid so one noisy row of
// pixels cannot split a face in two.
function findFace(mask, width, height) {
  const scale = Math.max(1, Math.round(width / 64));
  const cols = Math.floor(width / scale);
  const rows = Math.floor(height / scale);
  if (!cols || !rows) return null;

  const solid = Uint8Array.from({ length: cols * rows }, () => 0);
  const need = (scale * scale) / 2;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let count = 0;
      for (let y = 0; y < scale; y += 1) {
        const line = (row * scale + y) * width + col * scale;
        for (let x = 0; x < scale; x += 1) {
          if (mask[line + x]) count += 1;
        }
      }
      solid[row * cols + col] = count >= need ? 1 : 0;
    }
  }

  const seen = new Uint8Array(solid.length);
  let best = null;
  for (let start = 0; start < solid.length; start += 1) {
    if (!solid[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let cells = 0;
    let minCol = cols;
    let maxCol = -1;
    let minRow = rows;
    let maxRow = -1;
    while (stack.length) {
      const at = stack.pop();
      const col = at % cols;
      const row = (at - col) / cols;
      cells += 1;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
      if (col > 0 && solid[at - 1] && !seen[at - 1]) {
        seen[at - 1] = 1;
        stack.push(at - 1);
      }
      if (col < cols - 1 && solid[at + 1] && !seen[at + 1]) {
        seen[at + 1] = 1;
        stack.push(at + 1);
      }
      if (row > 0 && solid[at - cols] && !seen[at - cols]) {
        seen[at - cols] = 1;
        stack.push(at - cols);
      }
      if (row < rows - 1 && solid[at + cols] && !seen[at + cols]) {
        seen[at + cols] = 1;
        stack.push(at + cols);
      }
    }
    if (!best || cells > best.cells) best = { cells, minCol, maxCol, minRow, maxRow };
  }
  if (!best) return null;

  const box = {
    x: best.minCol * scale,
    y: best.minRow * scale,
    width: (best.maxCol - best.minCol + 1) * scale,
    height: (best.maxRow - best.minRow + 1) * scale,
  };
  const inside = (best.maxCol - best.minCol + 1) * (best.maxRow - best.minRow + 1);
  return { box, fill: Math.min(1, best.cells / inside) };
}

// One RGBA frame summarised: the biggest face-shaped patch of skin, how bright
// and how detailed it is, plus a luma copy for comparing two frames.
export function summarize(data, width, height) {
  const cols = Math.round(Number(width));
  const rows = Math.round(Number(height));
  const pixels = cols * rows;
  if (!pixels || !data || data.length < pixels * 4) return null;

  const luma = new Uint8Array(pixels);
  const mask = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    const at = index * 4;
    const red = data[at];
    const green = data[at + 1];
    const blue = data[at + 2];
    luma[index] = (red * 77 + green * 150 + blue * 29) >> 8;
    if (isSkin(red, green, blue)) mask[index] = 1;
  }

  const found = findFace(mask, cols, rows);
  if (!found) {
    return { found: false, box: null, share: 0, fill: 0, aspect: 0, contrast: 0, brightness: 0, luma };
  }

  // Brightness and detail are read inside the face, not across the whole frame:
  // a dark room behind a well-lit face is not a dark face.
  let total = 0;
  let totalSquared = 0;
  let count = 0;
  for (let y = found.box.y; y < found.box.y + found.box.height; y += 1) {
    for (let x = found.box.x; x < found.box.x + found.box.width; x += 1) {
      const value = luma[y * cols + x];
      total += value;
      totalSquared += value * value;
      count += 1;
    }
  }
  const brightness = count ? total / count : 0;
  const variance = count ? Math.max(0, totalSquared / count - brightness * brightness) : 0;

  return {
    found: true,
    box: found.box,
    share: (found.box.width * found.box.height) / pixels,
    fill: found.fill,
    aspect: found.box.width / found.box.height,
    contrast: Math.sqrt(variance),
    brightness,
    luma,
  };
}

// How much the picture changed between two frames, in luma levels per pixel. A
// person in front of the camera never holds perfectly still; a photo does. Only
// the face is compared, so a busy background cannot fake movement.
export function motion(first, second, box) {
  if (!first || !second || first.length !== second.length || !first.length) return null;
  const side = Math.round(Math.sqrt(first.length));
  if (side * side !== first.length) return null;
  const stride = Math.max(1, Math.round(side / 128));
  let total = 0;
  let count = 0;
  for (let y = 0; y < side; y += stride) {
    if (box && (y < box.y || y >= box.y + box.height)) continue;
    for (let x = 0; x < side; x += stride) {
      if (box && (x < box.x || x >= box.x + box.width)) continue;
      total += Math.abs(first[y * side + x] - second[y * side + x]);
      count += 1;
    }
  }
  return count ? total / count : null;
}

function unclear(message) {
  return { state: "unclear", message };
}

// The verdict for the numbers the panel sent. Anything that does not clear every
// rule comes back "unclear" so it can simply be tried again.
export function judgeLocal(stats) {
  const value = stats || {};
  const brightness = Number(value.brightness);
  const moved =
    value.motion === null || typeof value.motion === "undefined" ? null : Number(value.motion);

  if (!isFinite(brightness)) {
    return unclear("No frame arrived, so nothing was checked.");
  }

  // Older callers only sent a skin share; a face-shaped patch is what counts now.
  const share = Number(typeof value.faceShare === "number" ? value.faceShare : value.skinShare);
  const found = typeof value.faceFound === "boolean" ? value.faceFound : share >= MIN_FACE_SHARE;

  if (!found || !isFinite(share) || share < MIN_FACE_SHARE) {
    return unclear("No face was found in that frame. Fill the frame with your face and try again.");
  }
  if (share > MAX_FACE_SHARE) {
    return unclear("That frame was too close to the lens. Move back a little and try again.");
  }
  if (typeof value.aspect === "number" && (value.aspect < MIN_ASPECT || value.aspect > MAX_ASPECT)) {
    return unclear("That did not look like a face. Face the camera straight on and try again.");
  }
  if (typeof value.fill === "number" && value.fill < MIN_FILL) {
    return unclear("That did not look like a face. Face the camera straight on and try again.");
  }
  if (typeof value.contrast === "number" && value.contrast < MIN_CONTRAST) {
    return unclear("No facial detail was visible. Face a lamp or a window and try again.");
  }
  if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS) {
    return unclear("That frame was too dark or too bright. Face a lamp or a window and try again.");
  }
  if (moved !== null && (!isFinite(moved) || moved < MIN_MOTION)) {
    return unclear("That looked like a still picture rather than you. Sit in front of the camera and scan again.");
  }
  return { state: "verified", message: "" };
}
