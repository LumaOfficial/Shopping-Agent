#!/usr/bin/env node
// Builds a browser package from this one source.
//
//   node tools/build.mjs                 # every ready target
//   node tools/build.mjs --target opera  # one target, ready or planned
//   node tools/build.mjs --all           # every target, planned ones included
//   node tools/build.mjs --list          # targets, their stores and their rules
//
// What a target is, what each store accepts and how a browser is added live in
// tools/targets.mjs. This file only copies the source, writes the manifest a
// target asks for and refuses to write one a store would bounce; it holds no
// browser of its own.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_TARGETS, PANEL_VARIANTS, TARGETS, checkManifest, targetById } from "./targets.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "..");
const dist = resolve(source, "..", "dist");

// Build output and build tools are not part of a shipped package.
const SKIP = new Set(["tools", "test", "dist"]);

// Where the background imports its panel surface from.
const PANEL_MODULE = "src/lib/panel-surface.js";

function listTargets() {
  TARGETS.forEach((target) => {
    console.log(`${target.id.padEnd(9)} ${target.status.padEnd(8)} ${target.label}`);
    console.log("          stores: " + target.stores.join(", "));
    target.notes.forEach((note) => console.log("          · " + note));
  });
}

const argv = process.argv.slice(2);
const flagAt = (name) => argv.indexOf(name);

if (flagAt("--list") !== -1) {
  listTargets();
  process.exit(0);
}

let chosen = DEFAULT_TARGETS;
if (flagAt("--all") !== -1) chosen = TARGETS.map((target) => target.id);
else if (flagAt("--target") !== -1) chosen = [argv[flagAt("--target") + 1]];

const base = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));

let failed = false;

for (const id of chosen) {
  const target = targetById(id);
  if (!target) {
    console.error(`unknown target "${id}" — run --list to see the ones this source has`);
    process.exit(1);
  }

  const out = join(dist, target.id);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(source, out, {
    recursive: true,
    filter: (path) => !SKIP.has(path.slice(source.length + 1).split(/[\\/]/)[0]),
  });

  // The panel surface this browser can open, written where the background
  // imports it, with no other browser's variant left in the package.
  if (target.panel) {
    const surface = await readFile(join(source, target.panel), "utf8");
    await writeFile(join(out, PANEL_MODULE), surface);
  }
  for (const variant of PANEL_VARIANTS) {
    await rm(join(out, variant), { force: true });
  }

  const manifest = target.manifest(base);
  const problems = checkManifest(manifest, target);
  if (problems.length) {
    failed = true;
    await rm(out, { recursive: true, force: true });
    console.error(`${target.id}: not written, the store's rules are not met`);
    problems.forEach((problem) => console.error("  · " + problem));
    continue;
  }

  await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${target.id}: ${target.stores.join(", ")} → ${out}`);
}

if (failed) process.exit(1);
