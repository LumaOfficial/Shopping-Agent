// The face age check card. Everything that decides money lives on the relay and
// in the service worker; this module only shows the disclosure, takes one frame
// and reports what came back.
import {
  BOOST_RATE,
  MIN_AGE,
  consentFacts,
  isVerified,
  normalizeStatus,
  relayConfigured,
  statusCopy,
} from "./age-verify.js";
import { MIN_ASPECT, MIN_FACE_SHARE, MIN_FILL, MAX_ASPECT, motion, summarize } from "./age-local.js";

// One square frame, small enough for a free provider tier and big enough for a
// face to be recognisable in it.
const SIDE = 512;
const QUALITY = 0.86;

// The on-device check compares two frames this far apart, which is long enough
// for a person to shift and short enough to feel instant.
const MEASURE_SIDE = 256;
const GAP_MS = 420;

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
  let watcher = null;
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
    consentFacts(settings).forEach((fact) => {
      const item = document.createElement("li");
      item.textContent = fact;
      list.appendChild(item);
    });
  }

  function render() {
    const copy = statusCopy(status, settings);
    const verified = isVerified(status);
    const connected = relayConfigured(settings);

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

    // Both paths scan: on this device when no relay is configured, through the
    // relay's provider when one is.
    byId("age-facts-wrap").hidden = verified;
    byId("age-start").hidden = verified;
    byId("age-photo-btn").hidden = verified;
    // Only offered as an upgrade, never as a requirement.
    byId("age-settings").hidden = connected;
    byId("age-settings").textContent = "Use a provider instead";
    buildConsent();
    syncStartButton();
  }

  function syncStartButton() {
    const verified = isVerified(status);
    const ready = !verified && agree.checked && !busy;
    start.disabled = !ready;
    start.textContent = status.state === "none" ? "Check my face" : "Try the scan again";
  }

  function stopWatch() {
    if (watcher) {
      clearInterval(watcher);
      watcher = null;
    }
  }

  // While the preview is live, the frame is measured a few times a second so the
  // card can say whether a face is actually in it — the scan is not a guess taken
  // at whatever moment the button was pressed.
  function watchFace() {
    stopWatch();
    watcher = setInterval(() => {
      if (!stream || !video.videoWidth) return;
      const live = measure(video, true, 96);
      if (!live) return;
      const shaped =
        live.aspect >= MIN_ASPECT && live.aspect <= MAX_ASPECT && live.fill >= MIN_FILL;
      if (live.found && live.share >= MIN_FACE_SHARE && shaped) {
        setStatus("Face found — hold still, then take the scan.", "ok");
      } else if (live.found && live.share >= MIN_FACE_SHARE) {
        setStatus("Straighten up and fill the frame with your face, then take the scan.", "wait");
      } else {
        setStatus("Looking for your face — face the camera in even light.", "wait");
      }
    }, 450);
  }

  function stop() {
    stopWatch();
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

  // A small copy of the frame, measured in place: skin share, brightness and a
  // luma buffer the next frame is compared against for movement.
  function measure(source, sized, small) {
    const size = small || MEASURE_SIDE;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const box = sized ? { width: source.videoWidth || 0, height: source.videoHeight || 0 } : { width: source.width || 0, height: source.height || 0 };
    if (!box.width || !box.height) return null;
    const edge = Math.min(box.width, box.height);
    context.drawImage(
      source,
      (box.width - edge) / 2,
      (box.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      size,
      size
    );
    return summarize(context.getImageData(0, 0, size, size).data, size, size);
  }

  // What the worker judges. One frame describes the face; the pair says whether
  // it is a person in front of the camera or a picture of one moved across it.
  function localStats(first, second) {
    const best = second && second.share > first.share ? second : first;
    const box = best.box;
    return {
      faceFound: best.found,
      faceShare: best.share,
      fill: best.fill,
      aspect: best.aspect,
      contrast: best.contrast,
      brightness: second ? (first.brightness + second.brightness) / 2 : best.brightness,
      motion: second && box ? motion(first.luma, second.luma, box) : null,
      // The same figure under the older name, so a host that still reads it works.
      skinShare: best.share,
    };
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

  async function ask(message, waiting) {
    if (busy) return;
    busy = true;
    syncStartButton();
    setStatus(waiting, "wait");
    const reply = await send(message);
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
      setStatus("Couldn't confirm it — try again in even light, facing the camera.", "wait");
    }
    onChange(status);
  }

  function submit(image) {
    return ask({ type: "age:verify", image }, "Checking your face with the provider…");
  }

  // With no relay the numbers go to the worker, which judges them and decides —
  // the panel never marks an account verified on its own.
  function submitLocal(stats) {
    return ask({ type: "age:local", stats }, "Measuring the frame on this device…");
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
      setStatus("Looking for your face — face the camera in even light.", "wait");
      watchFace();
    } catch (error) {
      stop();
      // No camera here, or the browser will not hand one over: the scan carries
      // on with the device's own camera app or a photo, so it is never a dead end.
      const name = (error && error.name) || "";
      const missing =
        !navigator.mediaDevices ||
        name === "NotFoundError" ||
        name === "DevicesNotFoundError" ||
        name === "OverconstrainedError";
      setStatus(
        missing
          ? "This browser has no camera to open, so the scan continues with your camera app or a photo you pick."
          : "The camera could not be opened here, so the scan continues with your camera app or a photo you pick.",
        "wait"
      );
      photo.click();
    }
  }

  function takeShot() {
    if (relayConfigured(settings)) {
      const image = squareFromVideo();
      stop();
      if (!image) {
        setStatus("The camera was not ready yet. Give it a moment and take the scan again.", "wait");
        return;
      }
      submit(image);
      return;
    }

    stopWatch();
    const first = measure(video, true);
    if (!first) {
      setStatus("The camera was not ready yet. Give it a moment and take the scan again.", "wait");
      watchFace();
      return;
    }
    setStatus("Hold still for a moment…", "wait");
    // The second frame is what tells a person apart from a photo of one.
    setTimeout(() => {
      const second = measure(video, true);
      stop();
      if (!second) {
        setStatus("The camera closed before the scan finished. Try again.", "wait");
        return;
      }
      submitLocal(localStats(first, second));
    }, GAP_MS);
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
        if (!relayConfigured(settings)) {
          const stats = measure(image, false);
          if (!stats) {
            setStatus("That picture could not be read. Try another one.", "bad");
            return;
          }
          // A chosen picture cannot show movement, so only the face itself counts.
          submitLocal(localStats(stats, null));
          return;
        }
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
