#!/usr/bin/env node
// Vault sync relay for the Savings extension.
//
// The one thing a powerwash cannot take away is a copy that lives somewhere
// else, so the extension seals the whole profile into a single code and posts it
// here. This server never holds a key and cannot read what it stores: what
// arrives is AES-256-GCM ciphertext under a recovery key that exists only in the
// shopper's hands (see src/lib/vault.js). Losing this file loses the backup;
// finding it gains nothing.
//
//   node server/vault-sync.mjs
//
// Configuration (environment):
//   VAULT_SYNC_TOKEN=...      required: the bearer token the extension sends
//   VAULT_STORE_DIR=./.vault-sync   where sealed copies are written (mode 0600)
//   PORT=8788
//
//   POST /   { "code": "LUMA1.…", "sealedAt": "…", "keys": 14 }
//   -> 200   { ok: true, bytes, updatedAt }
//
//   GET /    -> { code, sealedAt, keys, updatedAt }   (same bearer token)
//   GET /health -> { ok, has }                        (no token, no code)
//
// The slot a copy is kept in is derived from the token, so one relay can serve
// several people and no request or file name ever carries an account identifier.
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";

const PORT = Number(process.env.PORT || 8788);
const TOKEN = String(process.env.VAULT_SYNC_TOKEN || "").trim();
const STORE = resolve(String(process.env.VAULT_STORE_DIR || "./.vault-sync"));
// A sealed code is a few kilobytes; this is only a ceiling against a runaway
// body, not a limit anyone will meet.
const MAX_BYTES = 512 * 1024;
const PREFIX = "LUMA1.";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "cache-control": "no-store",
};

function send(res, status, body) {
  res.writeHead(status, Object.assign({ "content-type": "application/json" }, CORS));
  res.end(JSON.stringify(body));
}

// The token names the slot, and only a hash of it is ever written down.
function slotFor(token) {
  return createHash("sha256").update("vault-sync:" + token).digest("hex").slice(0, 32) + ".json";
}

function offered(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) {
      const error = new Error("too-large");
      error.code = "too-large";
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function store(slot, record) {
  await mkdir(STORE, { recursive: true, mode: 0o700 });
  const target = join(STORE, slot);
  const scratch = target + ".tmp";
  await writeFile(scratch, JSON.stringify(record), { mode: 0o600 });
  await rename(scratch, target);
}

async function load(slot) {
  try {
    const text = await readFile(join(STORE, slot), "utf8");
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  const slot = TOKEN ? slotFor(TOKEN) : "";

  if (req.method === "GET" && /^\/health\/?$/i.test(req.url || "")) {
    const record = slot ? await load(slot) : null;
    return send(res, 200, { ok: true, service: "vault-sync", configured: Boolean(TOKEN), has: Boolean(record) });
  }

  if (!TOKEN) {
    return send(res, 503, {
      error: "unconfigured",
      detail: "Set VAULT_SYNC_TOKEN on this relay — see server/vault-sync.mjs.",
    });
  }
  // One answer for a missing token and a wrong one, so nothing here confirms a
  // token that happens to be right.
  if (offered(req) !== TOKEN) return send(res, 401, { error: "denied" });

  if (req.method === "GET") {
    const record = await load(slot);
    if (!record) return send(res, 404, { error: "empty" });
    return send(res, 200, record);
  }

  if (req.method !== "POST") return send(res, 405, { error: "method-not-allowed" });

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (error) {
    if (error && error.code === "too-large") return send(res, 413, { error: "too-large" });
    return send(res, 400, { error: "bad-request" });
  }

  const code = String((body && body.code) || "").trim();
  // Only the sealed shape is stored: this relay is not a place to park arbitrary
  // bytes, and a code that does not start with the prefix could never be
  // restored by the extension that posts here.
  if (code.indexOf(PREFIX) !== 0 || code.length > MAX_BYTES) return send(res, 422, { error: "bad-code" });

  const record = {
    code,
    sealedAt: String((body && body.sealedAt) || ""),
    keys: Number(body && body.keys) || 0,
    updatedAt: new Date().toISOString(),
  };
  await store(slot, record);
  return send(res, 200, { ok: true, bytes: code.length, updatedAt: record.updatedAt });
});

server.listen(PORT, "0.0.0.0", () => {
  const state = TOKEN ? "one token configured" : "no VAULT_SYNC_TOKEN — every request answers 503";
  console.log(`vault-sync relay on http://0.0.0.0:${PORT} \u00b7 ${state} \u00b7 storing sealed codes in ${STORE}`);
});
