// Chrome exposes the extension APIs as promise-returning `chrome.*` in Manifest
// V3, and this code uses that promise style everywhere. Firefox and Safari also
// expose `browser.*` with promises, while their `chrome.*` alias is callback
// only. Pointing `chrome` at `browser` where both exist keeps one source working
// in every browser. Chromium browsers have no `browser` global, so this is a
// no-op there.
if (typeof globalThis.browser !== "undefined" && globalThis.browser && globalThis.browser.runtime) {
  globalThis.chrome = globalThis.browser;
}
