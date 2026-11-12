// Panel comfort preferences: how the panel reads, never what it does. Stored on
// this device only, and sanitized on the way in so an edited profile cannot put
// a value here that the stylesheet has no rule for.
export const PREFS_KEY = "panelPrefs";

// Four steps, applied to the panel's own text sizes through --text-scale.
export const TEXT_STEPS = [0.9, 1, 1.1, 1.2];

export function emptyPrefs() {
  return { contrast: "normal", density: "cozy", motion: "auto", textScale: 1 };
}

export function sanitizePrefs(raw) {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const scale = Number(input.textScale);
  return {
    contrast: input.contrast === "high" ? "high" : "normal",
    density: input.density === "compact" ? "compact" : "cozy",
    motion: input.motion === "reduce" ? "reduce" : "auto",
    textScale: TEXT_STEPS.indexOf(scale) === -1 ? 1 : scale,
  };
}

// One step up or down, clamped at the ends so a held button cannot walk away.
export function stepText(prefs, direction) {
  const clean = sanitizePrefs(prefs);
  const at = TEXT_STEPS.indexOf(clean.textScale);
  const next = Math.max(0, Math.min(TEXT_STEPS.length - 1, at + (direction < 0 ? -1 : 1)));
  return TEXT_STEPS[next];
}

// Writes the three attributes the stylesheet keys off and the one custom
// property its sizes read, then hands back the sanitized object it applied.
export function applyPrefs(prefs, root) {
  const clean = sanitizePrefs(prefs);
  const node = root || (typeof document !== "undefined" ? document.documentElement : null);
  if (!node) return clean;
  node.dataset.contrast = clean.contrast;
  node.dataset.density = clean.density;
  node.dataset.motion = clean.motion;
  node.style.setProperty("--text-scale", String(clean.textScale));
  return clean;
}

export async function readPrefs() {
  const stored = await chrome.storage.local.get(PREFS_KEY);
  return sanitizePrefs(stored[PREFS_KEY]);
}

export async function writePrefs(patch) {
  const current = await readPrefs();
  const next = sanitizePrefs(Object.assign({}, current, patch || {}));
  await chrome.storage.local.set({ [PREFS_KEY]: next });
  applyPrefs(next);
  return next;
}
