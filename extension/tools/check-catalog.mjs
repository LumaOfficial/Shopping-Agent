#!/usr/bin/env node
// Keeps manifest.json and the merchant catalog in sync.
//
// The content script only runs on hosts listed in manifest.json, so a store
// that exists in src/lib/stores.js but not in the manifest would silently never
// activate. Run this after editing the catalog:
//
//   node tools/check-catalog.mjs           # report
//   node tools/check-catalog.mjs --write   # rewrite the matches list
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const { STORES, hostsOf } = await import(resolve(root, "src/lib/stores.js"));

const manifestPath = resolve(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const expected = [];
for (const store of STORES) {
  for (const host of hostsOf(store)) expected.push(`*://*.${host}/*`);
}
const unique = Array.from(new Set(expected)).sort();

// The catalog's own script. Every content script belongs to it — the ad-slot
// script is its first file.
const storeScript = manifest.content_scripts.find((entry) =>
  (entry.js || []).includes("src/content/content.js")
);
const current = new Set(storeScript.matches);
const missing = unique.filter((pattern) => !current.has(pattern));
const extra = Array.from(current).filter((pattern) => !unique.includes(pattern));

// A pattern that is not a shop is a permission a reviewer reads as "access to
// all your data": the extension asks for the shops it covers and, for anything
// else, for the one origin the shopper adds on the spot.
const ALL_SITES = ["*://*/*", "http://*/*", "https://*/*", "<all_urls>"];
const stray = [];
manifest.content_scripts.forEach((entry) => {
  (entry.matches || []).forEach((pattern) => {
    if (unique.indexOf(pattern) === -1) stray.push(pattern);
  });
});
const broad = (manifest.host_permissions || []).filter((pattern) =>
  ALL_SITES.includes(pattern)
);
const scoped = (storeScript.js || []).includes("src/content/ad-guard.js");

if (process.argv.includes("--write")) {
  storeScript.matches = unique;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`wrote ${unique.length} match patterns from ${STORES.length} stores`);
  if (stray.length || broad.length || !scoped) {
    console.log("the other checks still fail — run without --write to see them");
    process.exit(1);
  }
  process.exit(0);
}

console.log(`${STORES.length} stores · ${unique.length} host patterns`);
if (missing.length) console.log("missing from manifest:\n  " + missing.join("\n  "));
if (extra.length) console.log("in manifest but not in the catalog:\n  " + extra.join("\n  "));
if (stray.length) console.log("content script on a host that is not a shop:\n  " + stray.join("\n  "));
if (broad.length) console.log("standing access to every site:\n  " + broad.join("\n  "));
if (!scoped) console.log("the ad-slot script has to run with the store script, not on its own");
if (missing.length || extra.length) {
  console.log("\nrun: node tools/check-catalog.mjs --write");
  process.exit(1);
}
if (stray.length || broad.length || !scoped) process.exit(1);
console.log("catalog and manifest agree");
