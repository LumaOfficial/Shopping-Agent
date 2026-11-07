#!/usr/bin/env node
// Builds the Microsoft Edge package from the same source the Chrome build uses.
//
// Edge is Chromium and runs this extension unchanged, so nothing is rewritten
// except the one Chrome-only manifest key: the Edge Add-ons partner center
// validates the manifest itself and rejects properties it does not know.
//
//   node tools/build-edge.mjs        # writes ../dist/edge/
//
// Load ../dist/edge as an unpacked extension in edge://extensions, or zip that
// folder to upload it to the Microsoft Edge Add-ons store.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "..");
const out = resolve(source, "..", "dist", "edge");

// Build output and build tools are not part of a shipped package.
const SKIP = new Set(["tools", "dist"]);

const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
delete manifest.minimum_chrome_version;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(source, out, {
  recursive: true,
  filter: (path) => !SKIP.has(path.slice(source.length + 1).split(/[\\/]/)[0]),
});
await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`Edge build written to ${out}`);
console.log("Edge 116 or later (the side panel API needs it).");
