#!/usr/bin/env node
// Age check relay for the Savings extension.
//
// The extension never holds a face provider's credentials, so this small server
// does the one thing that needs them: take a single still frame, ask a face
// provider to estimate the age in it, throw the frame away and answer with a
// verdict. Nothing is written to disk and no image is logged.
//
//   node server/age-verify.mjs
//
// Configuration (environment):
//   AGE_PROVIDER=huggingface | azure-face     which account you hold
//   HF_TOKEN=...                              Hugging Face access token (free account)
//   HF_MODEL=nateraw/vit-age-classifier       any HF image-classification age model
//   AZURE_FACE_KEY=...                        Azure AI Face key (F0 free tier)
//   AZURE_FACE_ENDPOINT=https://westus.api.cognitive.microsoft.com
//   AGE_RELAY_TOKEN=...                       optional bearer token the extension sends
//   PORT=8787
//
//   POST /   { "image": "data:image/jpeg;base64,…" }
//   -> 200 { verdict: "over"|"under"|"unclear", estimate, provider, reference, at }
//   -> 422 { error: "no-face" } | 503 { error: "provider-unconfigured" }
//
// GET / answers a small health document, so a panel can tell a live relay with a
// provider from a live relay without one.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 8787);
const PROVIDER = String(process.env.AGE_PROVIDER || "").trim().toLowerCase();
const HF_TOKEN = String(process.env.HF_TOKEN || "").trim();
const HF_MODEL = String(process.env.HF_MODEL || "nateraw/vit-age-classifier").trim();
const AZURE_KEY = String(process.env.AZURE_FACE_KEY || "").trim();
const AZURE_ENDPOINT = String(process.env.AZURE_FACE_ENDPOINT || "").trim().replace(/\/+$/, "");
const RELAY_TOKEN = String(process.env.AGE_RELAY_TOKEN || "").trim();
const MIN_AGE = 18;
// An estimate has to clear the age gate by this margin before it counts as
// proof, so a 17-year-old's lucky frame is not read as 18.
const MARGIN = 3;
const MAX_BYTES = 3 * 1024 * 1024;
// Only counters: how many checks ran, never who ran them or what was in the frame.
const counts = { checks: 0, over: 0, under: 0, unclear: 0, failed: 0 };

function providerReady() {
  if (PROVIDER === "huggingface") return Boolean(HF_TOKEN);
  if (PROVIDER === "azure-face") return Boolean(AZURE_KEY && AZURE_ENDPOINT);
  return false;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "cache-control": "no-store",
};

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, Object.assign({ "content-type": "application/json" }, CORS));
  res.end(text);
}

// "data:image/jpeg;base64,…" -> { bytes, mime }. Anything else is refused: this
// server only ever receives an image, never a URL to fetch.
function decodeImage(value) {
  const text = String(value || "");
  const match = text.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!bytes.length || bytes.length > MAX_BYTES) return null;
  return { bytes, mime: match[1] === "image/jpg" ? "image/jpeg" : match[1] };
}

function midpoints(label) {
  // Age buckets such as "10-19", "20-29", "more than 70" and single years.
  const numbers = String(label || "").match(/\d+/g);
  if (!numbers) return null;
  const low = Number(numbers[0]);
  const high = numbers.length > 1 ? Number(numbers[1]) : low;
  if (!isFinite(low) || !isFinite(high)) return null;
  return { low, high };
}

// A weighted mean over the model's buckets, which is the same figure a face
// provider would print as an estimate.
function estimateFromScores(scores) {
  const usable = (Array.isArray(scores) ? scores : [])
    .map((item) => {
      const span = midpoints(item && item.label);
      const weight = Number(item && item.score);
      if (!span || !isFinite(weight) || weight <= 0) return null;
      return { mid: (span.low + span.high) / 2, weight };
    })
    .filter(Boolean);
  if (!usable.length) return null;
  const total = usable.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;
  return usable.reduce((sum, item) => sum + item.mid * item.weight, 0) / total;
}

async function askHuggingFace(image) {
  const response = await fetch("https://router.huggingface.co/hf-inference/models/" + encodeURIComponent(HF_MODEL), {
    method: "POST",
    headers: { authorization: "Bearer " + HF_TOKEN, "content-type": image.mime, accept: "application/json" },
    body: image.bytes,
  });
  if (response.status === 401 || response.status === 403) {
    const error = new Error("hf-denied");
    error.code = "provider-denied";
    throw error;
  }
  if (!response.ok) {
    const error = new Error("hf-" + response.status);
    error.code = "provider-error";
    throw error;
  }
  const payload = await response.json();
  const estimate = estimateFromScores(payload);
  if (!estimate) return null;
  return { estimate, provider: "huggingface:" + HF_MODEL };
}

async function askAzureFace(image) {
  const url =
    AZURE_ENDPOINT + "/face/v1.0/detect?returnFaceAttributes=age&detectionModel=detection_03&recognitionModel=none";
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", "Ocp-Apim-Subscription-Key": AZURE_KEY },
    body: image.bytes,
  });
  if (response.status === 401 || response.status === 403) {
    const error = new Error("azure-denied");
    error.code = "provider-denied";
    throw error;
  }
  if (!response.ok) {
    const error = new Error("azure-" + response.status);
    error.code = "provider-error";
    throw error;
  }
  const faces = await response.json();
  // The largest face is the person in front of the camera.
  const best = (Array.isArray(faces) ? faces : [])
    .map((face) => {
      const box = (face && face.faceRectangle) || {};
      return { age: Number(face && face.faceAttributes && face.faceAttributes.age), area: (box.width || 0) * (box.height || 0) };
    })
    .filter((face) => isFinite(face.age) && face.age > 0)
    .sort((a, b) => b.area - a.area)[0];
  if (!best) return null;
  return { estimate: best.age, provider: "azure-face" };
}

function verdictFor(estimate) {
  if (!isFinite(estimate)) return "unclear";
  if (estimate >= MIN_AGE + MARGIN) return "over";
  if (estimate < MIN_AGE - 2) return "under";
  return "unclear";
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES * 1.4) {
      const error = new Error("too-large");
      error.code = "too-large";
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  if (req.method === "GET") {
    return send(res, 200, {
      ok: true,
      service: "age-verify",
      provider: PROVIDER || null,
      providerReady: providerReady(),
      minAge: MIN_AGE,
      retention: "the frame is passed to the provider and discarded; nothing is stored",
      checks: counts.checks,
    });
  }

  if (req.method !== "POST") return send(res, 405, { error: "method-not-allowed" });

  if (RELAY_TOKEN) {
    const offered = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (offered !== RELAY_TOKEN) return send(res, 401, { error: "denied" });
  }

  if (!providerReady()) {
    counts.failed += 1;
    return send(res, 503, {
      error: "provider-unconfigured",
      detail: "Set AGE_PROVIDER and its credentials on this relay — see server/age-verify.mjs.",
    });
  }

  let image;
  try {
    const body = JSON.parse(await readBody(req));
    image = decodeImage(body && body.image);
  } catch (error) {
    if (error && error.code === "too-large") return send(res, 413, { error: "too-large" });
    return send(res, 400, { error: "bad-request" });
  }
  if (!image) return send(res, 422, { error: "bad-image" });

  counts.checks += 1;
  let answer;
  try {
    answer = PROVIDER === "azure-face" ? await askAzureFace(image) : await askHuggingFace(image);
  } catch (error) {
    counts.failed += 1;
    const code = (error && error.code) || "provider-error";
    return send(res, 502, {
      error: code,
      detail: "The face provider did not accept the check: " + String((error && error.message) || error),
    });
  } finally {
    // The frame is not kept: it was only ever a local variable.
    image = null;
  }

  if (!answer) {
    counts.failed += 1;
    return send(res, 422, { error: "no-face" });
  }

  const verdict = verdictFor(answer.estimate);
  counts[verdict] += 1;
  return send(res, 200, {
    verdict,
    estimate: Math.round(answer.estimate),
    provider: answer.provider,
    reference: "age_" + randomUUID().replace(/-/g, "").slice(0, 20),
    at: Date.now(),
    minAge: MIN_AGE,
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const state = providerReady() ? PROVIDER : "no provider configured — checks answer 503 until one is set";
  console.log(`age-verify relay on http://0.0.0.0:${PORT} · ${state}`);
});
