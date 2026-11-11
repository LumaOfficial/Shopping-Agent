// What the packaged Firefox build has to look like for addons.mozilla.org. The
// manifest is generated, so the rules are checked on the output rather than on
// the source manifest.
//
//   node --test extension/test/firefox-package.test.mjs
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

test("the Firefox package carries only what Firefox understands", async () => {
  const manifest = await manifestFor("firefox");

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, undefined, "Chromium-only key");
  assert.equal(manifest.side_panel, undefined, "Firefox has no side_panel key");
  assert.equal(manifest.permissions.includes("sidePanel"), false);
  assert.equal(manifest.permissions.includes("sidebarAction"), false, "sidebar_action needs no permission");
  assert.equal(manifest.sidebar_action.default_panel, "sidepanel.html");

  // Firefox MV3 has no background service worker: the same file is an event page,
  // and it is an ES module, which Firefox has loaded since 112.
  assert.deepEqual(manifest.background, {
    scripts: ["src/background/service-worker.js"],
    type: "module",
  });
});

test("the Firefox package declares data collection the way AMO requires", async () => {
  const manifest = await manifestFor("firefox");
  const gecko = manifest.browser_specific_settings.gecko;

  assert.equal(typeof gecko.id, "string");
  assert.ok(gecko.id.length > 0, "AMO needs an id, even a placeholder one");
  assert.equal(gecko.strict_min_version, "140.0", "data_collection_permissions is read from 140");
  assert.equal(manifest.browser_specific_settings.gecko_android.strict_min_version, "142.0");

  const required = gecko.data_collection_permissions.required;
  assert.ok(required.includes("browsingActivity"), "the feed request carries the store");
  assert.ok(required.includes("personallyIdentifyingInfo"), "the age check posts a frame of the shopper");
});

test("the Firefox package ships the rules and leaves the build tools behind", async () => {
  const manifest = await manifestFor("firefox");

  assert.equal(manifest.declarative_net_request.rule_resources[0].path, "rules/ads.json");
  await stat(join(out, "firefox", "rules", "ads.json"));
  await assert.rejects(stat(join(out, "firefox", "tools", "build.mjs")), "tools are not part of a package");
  await assert.rejects(stat(join(out, "firefox", "test")), "tests are not part of a package");
});

test("the Chromium package keeps its side panel", async () => {
  const manifest = await manifestFor("chromium");

  assert.equal(manifest.side_panel.default_path, "sidepanel.html");
  assert.equal(manifest.permissions.includes("sidePanel"), true);
  assert.equal(manifest.background.service_worker, "src/background/service-worker.js");
  assert.equal(manifest.browser_specific_settings, undefined);
});
