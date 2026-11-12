// The store criteria that can be checked mechanically, asserted on the source
// every package is built from. They are written as findings because most of them
// are shared by Chrome, Edge and Opera — an unnecessary permission or an
// undisclosed background action is the same review note in each — and each test
// names the criterion it stands for:
//
//   https://help.opera.com/en/extensions/acceptance-criteria/
//   https://developer.chrome.com/docs/webstore/program-policies/
//   https://learn.microsoft.com/microsoft-edge/extensions/publish/policies
//
//   node --test extension/test/manifest-compliance.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));

// Directories the build leaves out of a package, so they are not reviewed.
const NOT_PACKAGED = new Set(["tools", "test", "dist"]);

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (NOT_PACKAGED.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, files);
    else files.push(path);
  }
  return files;
}

const files = await walk(root);
const packaged = files.map((path) => relative(root, path).split("\\").join("/"));
const textOf = async (file) => readFile(join(root, file), "utf8");
const ALL_SITES = ["*://*/*", "http://*/*", "https://*/*", "<all_urls>"];

test('metadata: the summary is complete sentences and names the background action', async () => {
  const description = manifest.description;

  // Opera: "the summary must be composed of grammatically correct and complete
  // sentences" and "if the extension performs background actions, then those
  // actions must be described".
  assert.ok(description.length <= 132, "Chromium caps the manifest description at 132 characters");
  assert.match(description, /^[A-Z].*\.$/, "it starts with a capital and ends with a full stop");
  assert.match(description, /\b(hides|coupons|cashback)\b/i, "it says what the extension does");
  assert.match(description, /ad slots/i, "hiding ad slots is a background action, so it is named");

  // A name may not suggest a non-affiliated company, and no browser vendor's
  // name may appear in the title.
  assert.ok(!/opera|chrome|edge|firefox|brave/i.test(manifest.name), "no browser vendor in the name");
  assert.ok(!/opera/i.test(manifest.action.default_title), "no Opera branding on the button");
  assert.match(manifest.version, /^\d+(\.\d+){0,3}$/, "a version is dot-separated integers");
});

test("content: no standing access to every site, and every page script is a covered shop", async () => {
  // "There must be no redundant permissions requested or unnecessary manifest
  // entries." Standing access to every site is the finding a reviewer records
  // first, so the shipped manifest asks for the shops it covers and for nothing
  // else; anything outside them is granted one origin at a time, on a click.
  const broad = (manifest.host_permissions || []).filter((pattern) => ALL_SITES.includes(pattern));
  assert.deepEqual(broad, [], "no all-sites host permission");
  assert.ok(
    (manifest.optional_host_permissions || []).includes("*://*/*"),
    "a shop the shopper adds is granted at runtime, which needs it to be optional"
  );

  const { STORES, hostsOf } = await import(resolve(root, "src/lib/stores.js"));
  const catalog = new Set();
  for (const store of STORES) for (const host of hostsOf(store)) catalog.add(`*://*.${host}/*`);

  for (const entry of manifest.content_scripts) {
    for (const pattern of entry.matches) {
      assert.ok(catalog.has(pattern), `${pattern} is not a shop in the catalog`);
    }
  }

  // The ad-slot script belongs to the store script, not to a script of its own
  // that would have to run everywhere.
  const storeScript = manifest.content_scripts.find((entry) =>
    entry.js.includes("src/content/content.js")
  );
  assert.ok(storeScript.js.includes("src/content/ad-guard.js"), "the ad-slot script runs with the shop script");
});

test("development: each permission is asked for because a file uses it", async () => {
  const USES = {
    storage: ["src/lib/settings.js", "storage.local"],
    tabs: ["sidepanel.js", "chrome.tabs"],
    scripting: ["src/background/service-worker.js", "chrome.scripting"],
    declarativeNetRequest: ["src/background/service-worker.js", "chrome.declarativeNetRequest"],
    // The hourly savings-catalog pass: the only reason a timer is needed.
    alarms: ["src/background/service-worker.js", "chrome.alarms"],
    sidePanel: ["src/lib/panel-surface.js", "chrome.sidePanel"],
  };

  for (const permission of manifest.permissions) {
    const use = USES[permission];
    assert.ok(use, `${permission} is requested but no file is listed as using it`);
    assert.ok((await textOf(use[0])).includes(use[1]), `${permission} is not used in ${use[0]}`);
  }
  for (const permission of Object.keys(USES)) {
    if (permission === "sidePanel") continue; // the Opera build drops it, with the Side Panel API
    assert.ok(manifest.permissions.includes(permission), `${permission} is used but not declared`);
  }
});

test("content: the CSP keeps scripts in the package and limits where data may go", async () => {
  const csp = manifest.content_security_policy.extension_pages;

  // "No external JavaScript is allowed."
  assert.match(csp, /script-src 'self'(;|$)/, "scripts come from the package and nowhere else");
  assert.ok(!/script-src[^;]*\*/.test(csp), "no wildcard script source");
  assert.match(csp, /object-src 'none'/);

  // Data may leave only over HTTPS, or to a loopback listener the operator runs.
  const connect = (csp.match(/connect-src([^;]*)/) || [, ""])[1].split(/\s+/).filter(Boolean);
  assert.ok(!connect.includes("*"), "connect-src may not be every address");
  assert.ok(connect.includes("https:"), "operator endpoints are HTTPS");
  connect
    .filter((source) => /^https?:/.test(source) && source !== "https:")
    .forEach((source) => assert.match(source, /^http:\/\/(127\.0\.0\.1|localhost):\*$/, source));
});

test("development: the code is plain, unminified and carries no remote loader", async () => {
  for (const file of packaged.filter((name) => name.endsWith(".js"))) {
    const text = await textOf(file);
    // "We must be able to review your code, so it can't be obfuscated or minified."
    const longest = Math.max(...text.split("\n").map((line) => line.length));
    assert.ok(longest < 500, `${file} has a ${longest}-character line, which reads as minified`);
    assert.ok(!/\beval\s*\(/.test(text), `${file} uses eval`);
    assert.ok(!/new\s+Function\s*\(/.test(text), `${file} builds code from a string`);
    assert.ok(!/<script[^>]+src=["']https?:/i.test(text), `${file} loads a remote script`);
  }
});

test("content: the packaged icon set is a set, and every page it ships is packaged", async () => {
  const icons = manifest.icons;
  const sizes = Object.keys(icons).map(Number).sort((a, b) => a - b);
  assert.deepEqual(sizes, [16, 32, 48, 128], "one icon per size Opera lists");
  for (const path of Object.values(icons)) {
    const file = await stat(join(root, path));
    assert.ok(file.size > 0, `${path} is an empty file`);
    const head = (await readFile(join(root, path))).subarray(0, 8);
    assert.equal(head.toString("hex"), "89504e470d0a1a0a", `${path} is a PNG`);
  }

  // Every page the manifest opens is in the package, and no page links a script
  // that is not.
  for (const page of [manifest.side_panel?.default_path, manifest.options_page, "terms.html"]) {
    assert.ok(packaged.includes(page), `${page} is missing from the package`);
    const html = await textOf(page);
    for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      assert.ok(packaged.includes(src), `${page} loads ${src}, which is not packaged`);
    }
    for (const [, href] of html.matchAll(/<link[^>]+href="([^"]+)"/g)) {
      if (/^https?:|^#|^data:|^blob:/.test(href)) continue;
      assert.ok(packaged.includes(href), `${page} loads ${href}, which is not packaged`);
    }
  }
});

test("development: there are no unused files in the package", async () => {
  const inspected = new Set([".js", ".css", ".svg", ".html", ".json"]);
  const everything = await Promise.all(
    packaged.filter((name) => inspected.has(name.slice(name.lastIndexOf(".")))).map(textOf)
  );
  const haystack = everything.join("\n");

  const unused = [];
  for (const file of packaged) {
    if (!inspected.has(file.slice(file.lastIndexOf(".")))) continue;
    // A file is used when another packaged file names it: by path, or by the
    // name it is imported or linked with.
    const base = file.split("/").pop();
    let others = haystack.split(file).length - 1;
    if (others === 0) others = haystack.split(base).length - 1;
    // Its own text counts once, so a file only named by itself is unused.
    const selfMentions = (await textOf(file)).split(base).length - 1;
    if (others - selfMentions <= 0) unused.push(file);
  }
  assert.deepEqual(unused, [], "these files are in the package but nothing refers to them");
});
