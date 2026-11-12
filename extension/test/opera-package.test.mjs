// What the packaged Opera build has to look like. Opera is Chromium underneath,
// but it has its own sidebar and no Side Panel API, so its manifest differs from
// the Chromium one. The manifest is generated, so the rules are checked on the
// output rather than on the source manifest.
//
//   node --test extension/test/opera-package.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = resolve(root, "..", "dist");

async function manifestFor(target) {
  await run(process.execPath, [join(root, "tools/build.mjs"), "--target", target]);
  return JSON.parse(await readFile(join(out, target, "manifest.json"), "utf8"));
}

test("the Opera package declares its sidebar the Opera way", async () => {
  const manifest = await manifestFor("opera");

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, undefined, "Chromium-only key");
  assert.equal(manifest.side_panel, undefined, "Opera has no side_panel key");
  assert.equal(manifest.permissions.includes("sidePanel"), false);

  // sidebar_action is Opera's own key: it both declares the panel and puts the
  // extension's icon on the sidebar rail. Its icon is required.
  assert.equal(manifest.sidebar_action.default_panel, "sidepanel.html");
  assert.equal(manifest.sidebar_action.default_title, manifest.action.default_title);
  assert.ok(manifest.sidebar_action.default_icon[16], "Opera requires a sidebar icon");
  await stat(join(out, "opera", manifest.sidebar_action.default_icon[16]));
});

test("the Opera package keeps the Manifest V3 service worker", async () => {
  const manifest = await manifestFor("opera");

  assert.deepEqual(manifest.background, {
    service_worker: "src/background/service-worker.js",
    type: "module",
  });
});

test("the Opera package carries the Opera panel surface, not the Chromium one", async () => {
  const surface = await readFile(join(out, "opera", "src", "lib", "panel-surface.js"), "utf8");

  assert.equal(surface.includes("sidePanel"), false, "Opera has no Side Panel API");
  assert.match(surface, /openPanelWindow/, "a toolbar click opens the panel in a window");
  await assert.rejects(
    stat(join(out, "opera", "src", "lib", "panel-surface.opera.js")),
    "the variant is written into place, not shipped alongside"
  );
});

test("the package is named Luma Pay Shopping Agent and carries its terms", async () => {
  const manifest = await manifestFor("opera");

  assert.equal(manifest.name, "Luma Pay Shopping Agent");
  // Opera's metadata criteria want background actions described, not just the
  // headline feature: the ad-slot hiding is disclosed in the summary itself.
  assert.match(manifest.description, /hides ad slots/i);

  // The terms are a page inside the package — one link away from the panel and,
  // because the document ships, it opens with no network call at all.
  for (const file of ["terms.html", "terms.css", "terms.js", "anim.js"]) {
    await stat(join(out, "opera", file));
  }
});

test("the Opera package ships the rules and leaves the build tools behind", async () => {
  const manifest = await manifestFor("opera");

  assert.equal(manifest.declarative_net_request.rule_resources[0].path, "rules/ads.json");
  await stat(join(out, "opera", "rules", "ads.json"));
  await assert.rejects(stat(join(out, "opera", "tools", "build.mjs")), "tools are not part of a package");
  await assert.rejects(stat(join(out, "opera", "test")), "tests are not part of a package");
});

test("the Chromium package keeps its side panel", async () => {
  const manifest = await manifestFor("chromium");

  assert.equal(manifest.name, "Luma Pay Shopping Agent");
  assert.equal(manifest.side_panel.default_path, "sidepanel.html");
  assert.equal(manifest.permissions.includes("sidePanel"), true);
  assert.equal(manifest.background.service_worker, "src/background/service-worker.js");
  assert.equal(manifest.sidebar_action, undefined, "sidebar_action is Opera's key");

  const surface = await readFile(join(out, "chromium", "src", "lib", "panel-surface.js"), "utf8");
  assert.match(surface, /sidePanel/, "the Chromium package keeps the Side Panel module");
});
