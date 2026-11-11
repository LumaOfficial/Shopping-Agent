// The face age check card. Everything that decides money lives on the relay and
// in the service worker; this module only shows the disclosure, takes one frame
// and reports what came back.
import {
  BOOST_RATE,
  CONSENT_FACTS,
  MIN_AGE,
  isVerified,
  normalizeStatus,
  relayConfigured,
  relayHost,
  statusCopy,
} from "./age-verify.js";

// One square frame, small enough for a free provider tier and big enough for a
// face to be recognisable in it.
const SIDE = 512;
const QUALITY = 0.86;

const byId = (id) => document.getElementById(id);

function send(message) {
  return chrome.runtime.sendMessage(message).catch(() => null);
}

function when(timestamp) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch (_error) {
    return "";
  }
}

export function startAgeCheck(options) {
  const onChange = (options && options.onChange) || function () {};
  const root = byId("age-block");
  const video = byId("age-video");
  const agree = byId("age-agree");
  const start = byId("age-start");
  const photo = byId("age-photo");
  const cam = byId("age-cam");

  let settings = null;
  let status = normalizeStatus(null);
  let stream = null;
  let busy = false;

  function setStatus(message, kind) {
    const line = byId("age-status");
    line.hidden = !message;
    line.className = "status " + (kind || "wait");
    line.textContent = message || "";
  }

  function buildConsent() {
    const list = byId("age-facts");
    if (list.children.length) return;
    CONSENT_FACTS.forEach((fact) => {
      const item = document.createElement("li");
      item.textContent = fact;
      list.appendChild(item);
    });
  }

  function render() {
    const copy = statusCopy(status, settings);
    const verified = isVerified(status);
    const connected = relayConfigured(settings);
    const host = relayHost(settings);

    byId("age-state").textContent = copy.headline;
    byId("age-note").textContent = copy.detail;

    const boost = byId("age-boost");
    boost.textContent = verified ? Math.round(BOOST_RATE * 100) + "% boost on" : Math.round(BOOST_RATE * 100) + "% boost locked";
    boost.className = "chip " + (verified ? "verified" : "pending");

    const meta = byId("age-meta");
    const parts = [];
    if (status.provider) parts.push(status.provider);
    if (status.estimate) parts.push("estimate " + status.estimate);
    if (status.checkedAt) parts.push("checked " + when(status.checkedAt));
    meta.textContent = parts.join(" · ");
    meta.hidden = !parts.length;

    byId("age-facts-wrap").hidden = verified || !connected;
    byId("age-start").hidden = verified || !connected;
    byId("age-photo-btn").hidden = verified || !connected;
    byId("age-settings").hidden = connected;
    if (!connected) {
      setStatus("Face check isn't connected on this build yet — add an age check relay in Settings.", "wait");
    }
    buildConsent();
    syncStartButton();
  }

  function syncStartButton() {
    const connected = relayConfigured(settings);
    const verified = isVerified(status);
    const ready = connected && !verified && agree.checked && !busy;
    start.disabled = !ready;
    start.textContent = status.state === "none" ? "Verify with a face scan" : "Try the scan again";
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (video.srcObject) video.srcObject = null;
    cam.hidden = true;
  }

  async function load() {
    settings = await send({ type: "settings:get" });
    const reply = await send({ type: "age:status" });
    status = normalizeStatus(reply);
    render();
  }

  // Frames only ever exist as a canvas here: drawn once, encoded once, sent once.
  function encode(canvas) {
    return canvas.toDataURL("image/jpeg", QUALITY);
  }

  function squareFromVideo() {
    const side = Math.min(video.videoWidth || 0, video.videoHeight || 0);
    if (!side) return null;
    const canvas = document.createElement("canvas");
    canvas.width = SIDE;
    canvas.height = SIDE;
    const context = canvas.getContext("2d");
    context.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      SIDE,
      SIDE
    );
    return encode(canvas);
  }

  function scaledFromImage(image) {
    const longest = Math.max(image.width || 0, image.height || 0);
    if (!longest) return null;
    const scale = Math.min(1, SIDE / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.width || 0) * scale));
    canvas.height = Math.max(1, Math.round((image.height || 0) * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return encode(canvas);
  }

  async function submit(image) {
    if (busy) return;
    busy = true;
    syncStartButton();
    setStatus("Checking your face with the provider…", "wait");
    const reply = await send({ type: "age:verify", image });
    busy = false;

    if (!reply || reply.error || !reply.state) {
      setStatus((reply && reply.error) || "The check did not finish. Try again.", "bad");
      syncStartButton();
      return;
    }

    status = normalizeStatus(reply);
    render();
    if (status.state === "verified") {
      setStatus("Verified — cash outs are unlocked and new earnings carry the boost.", "ok");
    } else if (status.state === "under") {
      setStatus("The check put you under " + MIN_AGE + ", so cash outs stay locked.", "bad");
    } else {
      setStatus("Couldn't confirm your age — try again in even light, facing the camera.", "wait");
    }
    onChange(status);
  }

  async function openCamera() {
    setStatus("");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("no-camera");
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      cam.hidden = false;
      byId("age-shot").focus();
    } catch (error) {
      stop();
      const denied = error && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setStatus(
        denied
          ? "Camera access was blocked. Allow it for this panel, or use a photo instead."
          : "No camera is available here — use a photo instead.",
        "wait"
      );
    }
  }

  function takeShot() {
    const image = squareFromVideo();
    stop();
    if (!image) {
      setStatus("The camera was not ready yet. Give it a moment and take the scan again.", "wait");
      return;
    }
    submit(image);
  }

  photo.addEventListener("change", () => {
    const file = photo.files && photo.files[0];
    photo.value = "";
    if (!file) return;
    if (!/^image\//i.test(file.type)) {
      setStatus("That file is not a picture. Choose a photo of your face.", "bad");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const frame = scaledFromImage(image);
        if (!frame) {
          setStatus("That picture could not be read. Try another one.", "bad");
          return;
        }
        submit(frame);
      };
      image.onerror = () => setStatus("That picture could not be read. Try another one.", "bad");
      image.src = String(reader.result || "");
    };
    reader.onerror = () => setStatus("That picture could not be read. Try another one.", "bad");
    reader.readAsDataURL(file);
  });

  start.addEventListener("click", openCamera);
  byId("age-shot").addEventListener("click", takeShot);
  byId("age-cancel").addEventListener("click", () => {
    stop();
    setStatus("");
  });
  byId("age-photo-btn").addEventListener("click", () => photo.click());
  byId("age-settings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  agree.addEventListener("change", () => {
    setStatus("");
    syncStartButton();
  });

  return {
    load,
    state() {
      return status;
    },
    // The card belongs to the signed-in account, so signing out takes it away
    // and drops any camera that was still open.
    show(active) {
      stop();
      root.hidden = !active;
      if (active) {
        load();
      } else {
        agree.checked = false;
        setStatus("");
      }
    },
    stop,
  };
}
