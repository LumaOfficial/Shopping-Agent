// Frames for the face check, drawn in memory so the tests exercise the real
// detector in src/lib/age-local.js rather than hand-written statistics.
import { motion, summarize } from "../src/lib/age-local.js";

export const SIDE = 256;

// A lit face on a plain wall: skin-toned oval, brows, eyes and a mouth so the
// frame carries the facial detail a real one does. `shift` moves the head, which
// is what the second frame of a live scan does.
export function faceFrame(shift) {
  const offset = Number(shift) || 0;
  const data = new Uint8Array(SIDE * SIDE * 4);
  for (let y = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1) {
      const at = (y * SIDE + x) * 4;
      let colour = [60, 60, 62];
      const dx = x - SIDE / 2 - offset;
      const dy = y - SIDE / 2;
      if ((dx * dx) / (78 * 78) + (dy * dy) / (96 * 96) < 1) {
        colour = [205, 160, 135];
        if (Math.abs(y - 92) < 4 && Math.abs(dx) < 30) colour = [90, 60, 50];
        if ((x - 108 - offset) ** 2 + (y - 108) ** 2 < 60) colour = [55, 40, 38];
        if ((x - 148 - offset) ** 2 + (y - 108) ** 2 < 60) colour = [55, 40, 38];
        if (Math.abs(y - 165) < 5 && Math.abs(dx) < 22) colour = [150, 85, 85];
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
