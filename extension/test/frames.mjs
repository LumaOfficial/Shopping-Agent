// Frames for the face check, drawn in memory so the tests exercise the real
// detector in src/lib/age-local.js rather than hand-written statistics.
import { motion, summarize } from "../src/lib/age-local.js";

export const SIDE = 256;

// A lit face on a plain wall: skin-toned oval, brows, eyes and a mouth so the
// frame carries the facial detail a real one does. `shift` moves the head, which
// is what the second frame of a live scan does.
// `scale` enlarges the head inside the frame. 1 is a face sitting at a normal
// distance; 1.4 is the close-up a laptop camera sees when someone stays exactly
// where they were sitting, which the scan has to accept just the same.
export function faceFrame(shift, scale) {
  return drawFace(Number(shift) || 0, 0, 1, Number(scale) || 1, SIDE);
}

// A close-up straight-on frame, for the "nobody should have to lean back" case.
export function closeUpFrame(shift) {
  return faceFrame(shift, 1.4);
}

// The same face seen from another angle: the head moved by dx/dy pixels and, as
// a turned head really does, reading a little narrower across (narrow < 1).
export function turnFrame(dx, dy, narrow, scale) {
  return drawFace(Number(dx) || 0, Number(dy) || 0, narrow || 1, Number(scale) || 1, SIDE);
}

// A frame drawn at another size, so a caller can prove the measurement does not
// depend on the camera's resolution.
export function sizedFace(size, shift, scale) {
  return drawFace(Number(shift) || 0, 0, 1, Number(scale) || 1, Number(size) || SIDE);
}

function drawFace(offsetX, offsetY, narrow, scale, size) {
  const halfWidth = 78 * narrow * scale;
  const halfHeight = 96 * scale;
  const data = new Uint8Array(size * size * 4);
  const centreX = size / 2 + offsetX;
  const centreY = size / 2 + offsetY;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = (y * size + x) * 4;
      let colour = [60, 60, 62];
      const dx = x - centreX;
      const dy = y - centreY;
      if ((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight) < 1) {
        colour = [205, 160, 135];
        if (Math.abs(dy + 36 * scale) < 4 * scale && Math.abs(dx) < 30 * scale) colour = [90, 60, 50];
        const eye = Math.sqrt(60) * scale;
        if ((x - (centreX - 20 * scale)) ** 2 + (y - (centreY - 20 * scale)) ** 2 < eye * eye) {
          colour = [55, 40, 38];
        }
        if ((x - (centreX + 20 * scale)) ** 2 + (y - (centreY - 20 * scale)) ** 2 < eye * eye) {
          colour = [55, 40, 38];
        }
        if (Math.abs(dy - 37 * scale) < 5 * scale && Math.abs(dx) < 22 * scale) colour = [150, 85, 85];
      }
      data[at] = colour[0];
      data[at + 1] = colour[1];
      data[at + 2] = colour[2];
      data[at + 3] = 255;
    }
  }
  return data;
}

// A room with nobody in it.
export function emptyFrame() {
  const data = new Uint8Array(SIDE * SIDE * 4);
  for (let index = 0; index < SIDE * SIDE; index += 1) {
    data[index * 4] = 60;
    data[index * 4 + 1] = 60;
    data[index * 4 + 2] = 62;
    data[index * 4 + 3] = 255;
  }
  return data;
}

function measure(frame) {
  return summarize(frame, SIDE, SIDE);
}

// The payload the panel sends as age:local — the same fields age-panel.js builds
// from a live camera or a chosen photo.
export function scanStats(first, second) {
  const a = measure(first);
  const b = second ? measure(second) : null;
  const best = b && b.share > a.share ? b : a;
  return {
    faceFound: best.found,
    faceShare: best.share,
    fill: best.fill,
    aspect: best.aspect,
    contrast: best.contrast,
    brightness: b ? (a.brightness + b.brightness) / 2 : best.brightness,
    motion: b && best.box ? motion(a.luma, b.luma, best.box) : null,
    skinShare: best.share,
  };
}

// Two frames of a person in front of the camera, and two frames of a still
// picture moved across it.
export function liveScan() {
  return scanStats(faceFrame(0), faceFrame(2));
}

export function stillPhotoScan() {
  return scanStats(faceFrame(0), faceFrame(0));
}

export function noFaceScan() {
  return scanStats(emptyFrame());
}
