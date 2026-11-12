// The packaging table: one row per browser, each with the manifest its store
// accepts and the panel surface that browser can open. These tests hold the
// promise that adding a browser is a row, not a branch.
//
//   node --test extension/test/targets.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { DEFAULT_TARGETS, PANEL_VARIANTS, TARGETS, checkManifest, targetById } from "../tools/targets.mjs";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const base = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));

test("every target's manifest meets the rules its stores enforce", () => {
  assert.ok(TARGETS.length > 0, "there is at least one target");
  TARGETS.forEach((target) => {
    const problems = checkManifest(target.manifest(base), target);
    assert.deepEqual(problems, [], target.id + " would be bounced by its store");
  });
});

test("the shared checks catch what every store rejects", () => {
  const broken = targetById("chromium").manifest(base);
  broken.description = "x".repeat(133);
  broken.host_permissions = ["<all_urls>"];
  delete broken.icons[128];
  const problems = checkManifest(broken, targetById("chromium"));
  assert.ok(problems.some((line) => /132/.test(line)), "a long description is caught");
  assert.ok(problems.some((line) => /every site/.test(line)), "standing access to every site is caught");
  assert.ok(problems.some((line) => /128px/.test(line)), "a missing icon size is caught");
});

test("a plain build is the ready targets, and planned ones stay buildable", () => {
  assert.ok(DEFAULT_TARGETS.includes("chromium"));
  assert.ok(!DEFAULT_TARGETS.includes("opera"), "Opera is planned, so it is not in the default build");
  assert.ok(targetById("opera"), "but its row is here, so --target opera still works");
  DEFAULT_TARGETS.forEach((id) => assert.equal(targetById(id).status, "ready"));
});

test("each row names its stores and the reasons it differs", () => {
  TARGETS.forEach((target) => {
    assert.ok(target.stores.length > 0, target.id + " names the stores it is uploaded to");
    assert.ok(target.notes.length > 0, target.id + " records why it differs");
    assert.match(target.id, /^[a-z][a-z0-9-]*$/, "an id is what --target takes");
  });
});

test("a target's panel surface is a real file that avoids the API its browser lacks", async () => {
  for (const target of TARGETS) {
    if (!target.panel) continue;
    const path = join(root, target.panel);
    await stat(path);
    const surface = await readFile(path, "utf8");
    assert.equal(surface.includes("sidePanel"), false, target.id + " ships a surface that would call sidePanel");
  }
  // The source tree's own module is the side-panel one, and stays packaged when
  // no variant is named.
  const source = await readFile(join(root, "src", "lib", "panel-surface.js"), "utf8");
  assert.match(source, /sidePanel/, "the default surface is the Chromium side panel");
  assert.deepEqual(PANEL_VARIANTS, ["src/lib/panel-surface.opera.js"]);
});

test("--list prints the table, and an unknown target fails with a pointer to it", async () => {
  const listed = await run(process.execPath, [join(root, "tools", "build.mjs"), "--list"]);
  TARGETS.forEach((target) => {
    assert.ok(listed.stdout.includes(target.id), "--list names " + target.id);
    assert.ok(listed.stdout.includes(target.stores[0]), "--list names the stores of " + target.id);
  });

  await assert.rejects(
    run(process.execPath, [join(root, "tools", "build.mjs"), "--target", "netscape"]),
    (error) => /unknown target/.test(error.stderr) && /--list/.test(error.stderr),
    "an unknown target points back at the table"
  );
});
