// Face check. Cashing out and the earnings boost are unlocked only by a verdict
// stored against the account: either the operator's age check relay (see
// server/age-verify.mjs, which holds a provider's credentials) or, when no relay
// is configured, the on-device measurement in age-local.js.
//
// What is kept here: the verdict, the provider's name, its reference and the
// time. Never the frame, never a face template.
//
// With no relay configured the check runs on this device instead (age-local.js),
// so the feature works on a fresh install with no key of any kind.
import { LOCAL_PROVIDER } from "./age-local.js";

export const MIN_AGE = 18;
// Age estimation is an estimate, so the provider's figure has to clear 18 by a
// margin before this counts as proof. Anything inside the margin comes back
// "unclear" and can be tried again.
export const DECISION_AGE = 21;
export const BOOST_RATE = 0.03;

// Shown, in this order, before the camera opens. With nothing configured the
// check runs entirely on this device, so the facts say exactly that.
const RELAY_FACTS = [
  "One still frame is taken here in your browser — not a video, and nothing else on your screen.",
  "The frame is posted over HTTPS to the age check relay your operator configured, which passes it to the face provider.",
  "The provider estimates your age from that frame and the relay discards the frame. No image and no face template is stored by this extension.",
  "Only the outcome, the provider's name, its reference and the time are saved with your account.",
  "The scan is optional: without it your savings, codes and prices still work, but cash outs stay locked.",
];

const ON_DEVICE_FACTS = [
  "One still frame is taken here in your browser — not a video, and nothing else on your screen.",
  "Nothing leaves this device: the frame is measured in the panel and then dropped. No provider, no account, no key.",
  "A second frame half a second later checks that you are really in front of the camera rather than a photo of someone.",
  "Only the outcome, the words \"On-device check\" and the time are saved with your account.",
  "The scan is optional: without it your savings, codes and prices still work, but cash outs stay locked.",
];

export function consentFacts(settings) {
  return relayConfigured(settings) ? RELAY_FACTS : ON_DEVICE_FACTS;
}

export const VERIFIED_STATES = ["verified", "under", "unclear", "none"];

export function relayUrl(settings) {
  return String((settings && settings.ageCheckUrl) || "").trim();
}

// With no relay the panel uses the on-device check, so this only decides which
// of the two paths runs.
export function relayConfigured(settings) {
  return /^https?:\/\//i.test(relayUrl(settings));
}

export function relayHost(settings) {
  try {
    return new URL(relayUrl(settings)).hostname.replace(/^www\./i, "");
  } catch (_error) {
    return "";
  }
}

// One shape for stored status and relay answers alike.
export function normalizeStatus(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const state = VERIFIED_STATES.indexOf(value.state) !== -1 ? value.state : "none";
  const estimate = Number(value.estimate);
  return {
    state,
    provider: String(value.provider || "").slice(0, 40),
    reference: String(value.reference || "").slice(0, 64),
    estimate: isFinite(estimate) && estimate > 0 ? Math.round(estimate) : null,
    checkedAt: Number(value.checkedAt) || null,
  };
}

export function isVerified(status) {
  return normalizeStatus(status).state === "verified";
}

// The boost only ever applies to an earning recorded after verification, so no
// balance changes retroactively and the same cashback is never boosted twice.
export function boostAmount(base, status) {
  const amount = Math.round(Number(base));
  if (!isFinite(amount) || amount <= 0) return 0;
  return isVerified(status) ? Math.round(amount * BOOST_RATE) : 0;
}

export function canCashOut(status) {
  return isVerified(status);
}

// What the panel says, per outcome.
export function statusCopy(status, settings) {
  const value = normalizeStatus(status);
  const host = relayHost(settings);
  if (value.state === "verified") {
    const onDevice = value.provider === LOCAL_PROVIDER;
    return {
      headline: "Verified " + MIN_AGE + "+",
      detail:
        (onDevice
          ? "Checked here on this device, with your date of birth from signup — no picture left the browser"
          : "Confirmed by " + (value.provider || host || "the age check service")) +
        ". Cash outs are unlocked and every new cashback earning is boosted by " +
        Math.round(BOOST_RATE * 100) +
        "%.",
    };
  }
  if (value.state === "under") {
    return {
      headline: "Not old enough to cash out",
      detail:
        "The check put you under " + MIN_AGE + ". Cash outs and the boost stay locked on this account.",
    };
  }
  if (value.state === "unclear") {
    return {
      headline: "Couldn't confirm your age",
      detail:
        "The estimate landed too close to " +
        MIN_AGE +
        " to count. Try again in even light, facing the camera, without a hat or glasses.",
    };
  }
  return {
    headline: "Not verified yet",
    detail:
      "Scan your face once to prove you are " +
      MIN_AGE +
      "+ and unlock cash outs plus a " +
      Math.round(BOOST_RATE * 100) +
      "% boost on new earnings. " +
      (relayConfigured(settings)
        ? "The frame goes to your age check relay and comes back as a verdict."
        : "The scan runs on this device — nothing to set up and no picture leaves the browser."),
  };
}

// The one place a frame leaves the browser. Anything other than a well-formed
// verdict is treated as no result at all.
export async function checkAge(settings, image) {
  const url = relayUrl(settings);
  const host = relayHost(settings) || "the age check relay";
  if (!url) {
    return { ok: false, error: "Add your age check relay endpoint in Settings first." };
  }

  const headers = { "content-type": "application/json", accept: "application/json" };
  const token = String((settings && settings.ageCheckToken) || "").trim();
  if (token) headers.authorization = "Bearer " + token;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ image }),
      cache: "no-store",
    });
  } catch (error) {
    return { ok: false, error: "Could not reach " + host + ": " + String((error && error.message) || error) };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: host + " rejected the relay token (HTTP " + response.status + ")." };
  }
  if (response.status === 503 || (payload && payload.error === "provider-unconfigured")) {
    return {
      ok: false,
      unavailable: true,
      error: host + " is reachable, but it has no face provider connected yet. Add one on the relay and try again.",
    };
  }
  if (response.status === 413 || response.status === 422) {
    return {
      ok: false,
      error:
        payload && payload.error === "no-face"
          ? "No face was found in that picture. Try again with your face filling the frame."
          : "That picture was not usable. Take a new one and try again.",
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: host + " answered HTTP " + response.status + (payload && payload.error ? " (" + payload.error + ")" : "") + ".",
    };
  }

  const verdict = String((payload && payload.verdict) || "").toLowerCase();
  if (["over", "under", "unclear"].indexOf(verdict) === -1) {
    return { ok: false, error: host + " answered without a verdict, so nothing was saved." };
  }

  return {
    ok: true,
    status: normalizeStatus({
      state: verdict === "over" ? "verified" : verdict,
      provider: (payload && payload.provider) || host,
      reference: payload && payload.reference,
      estimate: payload && payload.estimate,
      checkedAt: Date.now(),
    }),
  };
}
