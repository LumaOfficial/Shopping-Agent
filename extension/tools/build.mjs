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
//   is declared as a sidebar instead. Firefox 128+ (optional host permissions).
//
// Nothing else differs: src/lib/compat.js points `chrome` at `browser` where the
// browser only offers promises there, and the background script opens whichever
// panel surface the browser actually has.
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
  manifest.sidebar_action = { default_panel: "sidepanel.html", default_title: "Open savings" };
  manifest.browser_specific_settings = {
    gecko: {
      // AMO does not assign an ID; replace this with your own before publishing.
      id: "savings@shopping-agent.example",
      strict_min_version: "128.0",
      // The offer request carries the store you are on to the feed you
      // configured, so that is browsing activity. Set "none" if your feed
      // never receives anything about the page.
      data_collection_permissions: { required: ["browsingActivity"] },
    },
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
  await writeFile(join(out, "manifest.json"), JSON.stringify(build(), null, 2) + "\n");
  console.log(`${target} package written to ${out}`);
}
