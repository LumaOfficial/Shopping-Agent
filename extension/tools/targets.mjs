// Every browser this source is packaged for, in one table.
//
// A target is a row: the manifest that store wants to read, the panel surface
// that browser can actually open, and the rules the store enforces. Nothing else
// in the source branches on a browser — the panel, the background and the source
// manifest are the same for all of them — so answering "make this one for Edge"
// is a change to a row here (or to the one manifest patch in it), never a change
// to the extension itself.
//
// The rules below are the ones a manifest can fail on, taken from each store:
//
//   Chrome Web Store — Manifest V3 only for new items; `manifest.json` at the ZIP
//     root, not inside a folder; `name`, `version`, `icons` and `description`
//     present, the description 132 characters or fewer; and every upload a higher
//     version number than the last.
//     https://developer.chrome.com/docs/webstore/prepare
//
//   Microsoft Edge Add-ons — Manifest V3 only since July 2022 and submitted
//     through Partner Center, which validates the manifest itself and flags keys
//     it does not know, so a Chromium-only key is a failed upload there.
//     https://learn.microsoft.com/microsoft-edge/extensions/developer-guide/manifest-v3
//
//   Opera add-ons (planned, not submitted yet) — the panel is Opera's sidebar,
//     declared with `sidebar_action`: no `side_panel` key, no `sidePanel`
//     permission and no `minimum_chrome_version`, since Opera's release numbers
//     do not follow Chrome's.
//     ../docs/opera-submission.md

const CHROMIUM_STORES = [
  "Chrome Web Store",
  "Microsoft Edge Add-ons",
  "Brave, Vivaldi, Arc (Chromium)",
];

const SIDEBAR_ICONS = {
  16: "icons/luma-pay-16.png",
  32: "icons/luma-pay-32.png",
  48: "icons/luma-pay-48.png",
  96: "icons/luma-pay-96.png",
};

export const TARGETS = [
  {
    id: "chromium",
    label: "Chromium side panel",
    // "ready" targets are what a plain `node tools/build.mjs` writes.
    status: "ready",
    stores: CHROMIUM_STORES,
    notes: [
      "Manifest V3 with side_panel and the sidePanel permission, which every store above accepts.",
      "minimum_chrome_version is dropped: Partner Center flags keys it does not know.",
      "Edge takes this package as it stands; a rule only Edge enforces belongs in this row, not in a branch.",
      "The panel surface is the source tree's own module, so an unpacked tree is what ships.",
    ],
    panel: null,
    manifest(base) {
      const manifest = structuredClone(base);
      delete manifest.minimum_chrome_version;
      return manifest;
    },
    check(manifest) {
      const problems = [];
      if (!manifest.side_panel) problems.push("side_panel is missing");
      if (!(manifest.permissions || []).includes("sidePanel")) problems.push("the sidePanel permission is missing");
      if (manifest.minimum_chrome_version) problems.push("minimum_chrome_version is Chromium-only");
      return problems;
    },
  },
  {
    id: "opera",
    label: "Opera sidebar",
    // Planned: buildable on request (`--target opera`) but left out of the
    // default build until the submission actually happens.
    status: "planned",
    stores: ["Opera add-ons"],
    notes: [
      "sidebar_action replaces side_panel, and the sidePanel permission goes with it.",
      "Declaring sidebar_action is also what puts the panel on Opera's sidebar rail.",
      "The panel surface is swapped for src/lib/panel-surface.opera.js: Opera has no Side Panel API.",
      "minimum_chrome_version is dropped; Opera's versions do not follow Chrome's.",
    ],
    panel: "src/lib/panel-surface.opera.js",
    manifest(base) {
      const manifest = structuredClone(base);
      delete manifest.minimum_chrome_version;
      delete manifest.side_panel;
      manifest.permissions = manifest.permissions.filter((name) => name !== "sidePanel");
      manifest.sidebar_action = {
        default_panel: "sidepanel.html",
        default_title: base.action.default_title,
        default_icon: SIDEBAR_ICONS,
      };
      return manifest;
    },
    check(manifest) {
      const problems = [];
      if (manifest.side_panel) problems.push("side_panel is Chrome's key; Opera declares sidebar_action");
      if ((manifest.permissions || []).includes("sidePanel")) problems.push("the sidePanel permission is not Opera's");
      if (manifest.minimum_chrome_version) problems.push("minimum_chrome_version is Chromium-only");
      if (!manifest.sidebar_action || !manifest.sidebar_action.default_panel) {
        problems.push("sidebar_action.default_panel is what Opera opens from the rail");
      }
      if (!manifest.sidebar_action || !manifest.sidebar_action.default_icon) {
        problems.push("sidebar_action.default_icon is required");
      }
      return problems;
    },
  },
];

// The surface file every package keeps in place of src/lib/panel-surface.js, so
// no browser ships another one's.
export const PANEL_VARIANTS = TARGETS.map((target) => target.panel).filter(Boolean);

export const DEFAULT_TARGETS = TARGETS.filter((target) => target.status === "ready").map((target) => target.id);

export function targetById(id) {
  return TARGETS.find((target) => target.id === id) || null;
}

const ALL_SITES = ["*://*/*", "http://*/*", "https://*/*", "<all_urls>"];

// What every store checks about a manifest, checked once here so a package is
// never written that a store would bounce. A target adds its own rules in
// `check`. Returns a list of problems; empty means the package may be written.
export function checkManifest(manifest, target) {
  const problems = [];
  if (manifest.manifest_version !== 3) problems.push("manifest_version must be 3");
  if (!manifest.name) problems.push("name is required");
  if (!/^\d+(\.\d+){0,3}$/.test(String(manifest.version || ""))) {
    problems.push("version is dot-separated integers");
  }
  if (!manifest.description) problems.push("description is required");
  else if (manifest.description.length > 132) problems.push("description is over the 132-character cap");

  const icons = manifest.icons || {};
  [16, 48, 128].forEach((size) => {
    if (!icons[size]) problems.push("missing the " + size + "px icon");
  });

  const broad = (manifest.host_permissions || []).filter((pattern) => ALL_SITES.includes(pattern));
  if (broad.length) problems.push("standing access to every site: " + broad.join(", "));

  if (target && typeof target.check === "function") problems.push(...target.check(manifest));
  return problems;
}
