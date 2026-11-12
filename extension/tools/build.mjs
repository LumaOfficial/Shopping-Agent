#!/usr/bin/env node
// Builds the browser packages from this one source.
//
//   node tools/build.mjs                  # both packages
//   node tools/build.mjs --target opera   # just one
//
// dist/chromium — Chrome, Microsoft Edge, Brave, Vivaldi, Arc and any other
//   Chromium browser that ships the Side Panel API. They all accept the manifest
//   as it stands, so the package is the source with the Chrome-only version key
//   dropped (the Edge store validates the manifest itself and flags keys it knows
//   nothing about).
// dist/opera — Opera is Chromium underneath but has no Side Panel API: its
//   sidebar is declared with Opera's own sidebar_action key (Opera 30+), which is
//   also what puts the panel on its sidebar rail. The background stays a service
//   worker, as in any Manifest V3 Chromium build.
//
// src/lib/panel-surface.js is the Chromium side panel, which is also what the
// source tree itself uses. The Opera package gets src/lib/panel-surface.opera.js
// written over that name instead, and the variant file is left out of every
// package, so the Opera build holds no reference at all to an API Opera does not
// implement — which is what an Opera reviewer would otherwise have to read past.
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
  : ["chromium", "opera"];

const PANEL_MODULE = "src/lib/panel-surface.js";
// Only the targets whose panel differs from the source tree's Chromium module.
const PANEL_VARIANTS = {
  opera: "src/lib/panel-surface.opera.js",
};

function chromiumManifest() {
  const manifest = structuredClone(base);
  delete manifest.minimum_chrome_version;
  return manifest;
}

function operaManifest() {
  const manifest = structuredClone(base);
  delete manifest.minimum_chrome_version;
  // Opera declares its sidebar with sidebar_action, not Chrome's side_panel, and
  // the sidePanel permission goes with it.
  delete manifest.side_panel;
  manifest.permissions = manifest.permissions.filter((name) => name !== "sidePanel");
  manifest.sidebar_action = {
    default_panel: "sidepanel.html",
    default_title: base.action.default_title,
    default_icon: {
      16: "icons/luma-pay-16.png",
      32: "icons/luma-pay-32.png",
      48: "icons/luma-pay-48.png",
      96: "icons/luma-pay-96.png",
    },
  };
  return manifest;
}

const BUILDERS = { chromium: chromiumManifest, opera: operaManifest };

const base = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));

for (const target of targets) {
  const build = BUILDERS[target];
  if (!build) {
    console.error(`unknown target "${target}" — use chromium or opera`);
    process.exit(1);
  }

  const out = join(dist, target);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(source, out, {
    recursive: true,
    filter: (path) => !SKIP.has(path.slice(source.length + 1).split(/[\\/]/)[0]),
  });

  // The panel surface for this browser, written where the background imports it,
  // and no other browser's variant left behind in the package.
  if (PANEL_VARIANTS[target]) {
    const surface = await readFile(join(source, PANEL_VARIANTS[target]), "utf8");
    await writeFile(join(out, PANEL_MODULE), surface);
  }
  for (const variant of Object.values(PANEL_VARIANTS)) {
    await rm(join(out, variant), { force: true });
  }

  await writeFile(join(out, "manifest.json"), JSON.stringify(build(), null, 2) + "\n");
  console.log(`${target} package written to ${out}`);
}
