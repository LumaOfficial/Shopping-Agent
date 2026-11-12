#!/usr/bin/env node
// Builds the browser packages from this one source.
//
//   node tools/build.mjs                   # both packages
//   node tools/build.mjs --target firefox  # just one
//
// dist/chromium — Chrome, Microsoft Edge, Brave, Opera, Vivaldi, Arc and any
//   other Chromium browser. They all accept the manifest as it stands, so the
//   package is the source with the Chrome-only version key dropped (the Edge and
//   Opera stores validate the manifest themselves and flag keys they know
//   nothing about).
// dist/firefox — Firefox has no service worker in Manifest V3 and no Side Panel
//   API, so the same background script is loaded as an event page and the panel
//   is declared as a sidebar instead. Firefox 140+ desktop, 142+ on Android: the
//   data_collection_permissions AMO requires is only read from those versions.
//
// One source file is written per target: src/lib/panel-surface.js is the
// Chromium panel in a Chromium package and Firefox's sidebar in a Firefox one.
// Keeping the surface in a build-selected module means the Firefox package holds
// no reference at all to an API Firefox does not implement, which is what an AMO
// reviewer would otherwise have to read past.
//
// Nothing else differs: src/lib/compat.js points `chrome` at `browser` where the
// browser only offers promises there.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "..");
const dist = resolve(source, "..", "dist");

// Build output and build tools are not part of a shipped package.
const SKIP = new Set(["tools", "test", "dist"]);

const targets = process.argv.includes("--target")
  ? [process.argv[process.argv.indexOf("--target") + 1]]
  : ["chromium", "firefox"];

const PANEL_MODULE = "src/lib/panel-surface.js";
const PANEL_VARIANTS = {
  chromium: "src/lib/panel-surface.chromium.js",
  firefox: "src/lib/panel-surface.firefox.js",
};

function chromiumManifest() {
  const manifest = structuredClone(base);
  delete manifest.minimum_chrome_version;
  return manifest;
}

function firefoxManifest() {
  const manifest = structuredClone(base);
  delete manifest.minimum_chrome_version;
  delete manifest.side_panel;
  manifest.permissions = manifest.permissions.filter((name) => name !== "sidePanel");
  manifest.background = { scripts: [manifest.background.service_worker], type: "module" };
  manifest.sidebar_action = {
    default_panel: "sidepanel.html",
    default_title: base.action.default_title,
    default_icon: base.icons,
  };
  manifest.browser_specific_settings = {
    gecko: {
      id: "luma-pay@luma-official.com",
      // 140 is the first desktop release that reads data_collection_permissions
      // (Firefox for Android reads it from 142). AMO requires that declaration
      // for every new submission, so an older floor would install the extension
      // somewhere the consent it describes is never shown.
      strict_min_version: "140.0",
      // The offer request carries the store you are on to the feed you
      // configured, so that is browsing activity. The age check posts one
      // straight-on frame to the relay you configured, which is a recording of
      // the shopper: personally identifying information. Set the list to
      // ["none"] if neither feature ever leaves the device.
      data_collection_permissions: {
        required: ["browsingActivity", "personallyIdentifyingInfo"],
      },
    },
    gecko_android: { strict_min_version: "142.0" },
  };
  return manifest;
}

const BUILDERS = { chromium: chromiumManifest, firefox: firefoxManifest };

const base = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));

for (const target of targets) {
  const build = BUILDERS[target];
  if (!build) {
    console.error(`unknown target "${target}" — use chromium or firefox`);
    process.exit(1);
  }

  const out = join(dist, target);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(source, out, {
    recursive: true,
    filter: (path) => !SKIP.has(path.slice(source.length + 1).split(/[\\/]/)[0]),
  });

  // The panel surface for this browser, written where the background imports it.
  const surface = await readFile(join(source, PANEL_VARIANTS[target]), "utf8");
  await writeFile(join(out, PANEL_MODULE), surface);
  for (const variant of Object.values(PANEL_VARIANTS)) {
    await rm(join(out, variant), { force: true });
  }

  await writeFile(join(out, "manifest.json"), JSON.stringify(build(), null, 2) + "\n");
  console.log(`${target} package written to ${out}`);
}
