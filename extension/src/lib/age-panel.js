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
import { motion, summarize } from "./age-local.js";
import { HOLD, STEPS, compareModel, judgePose, poseFrom } from "./face-rotate.js";

// One square frame, small enough for a free provider tier and big enough for a
// face to be recognisable in it.
const SIDE = 512;
const QUALITY = 0.86;

// The on-device check compares two frames this far apart, which is long enough
// for a person to shift and short enough to feel instant.
const MEASURE_SIDE = 256;
// How often the frame is measured while the guided rotation is running.
const GUIDE_MS = 200;

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

  // One guided scan: the angle being asked for, the views already kept, and the
  // straight-on one they are all measured against.
  const guide = {
    timer: null,
    index: 0,
    // The last few verdicts for the angle being asked for. An angle counts once
    // it has held across them, so one blurred frame cannot throw a turn away.
    window: [],
    baseline: null,
    views: [],
    lastLuma: null,
    moved: 0,
    samples: 0,
    image: null,
  };

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

  // ---- guided rotation ------------------------------------------------
  // The scan is a few angles in turn, not one press of a button: the straight-on
  // view, then each turn. Each angle is measured as the preview runs and kept
  // only once the face has actually reached it.

  function setHint(message) {
    const tip = byId("age-guide-tip");
    if (tip) tip.textContent = message;
  }

  function paintGuide() {
    const step = STEPS[Math.min(guide.index, STEPS.length - 1)];
    const label = byId("age-guide-label");
    const ring = byId("age-ring");
    const head = byId("age-head");
    const steps = byId("age-steps");
    if (label) label.textContent = step.label;
    setHint(step.tip);
    if (head) {
      head.style.setProperty("--ry", (step.turn.x || 0) + "deg");
      head.style.setProperty("--rx", (step.turn.y || 0) + "deg");
    }
    if (ring) paintProgress(0, false);
    if (steps) {
      while (steps.firstChild) steps.removeChild(steps.firstChild);
      STEPS.forEach((_step, at) => {
        const dot = document.createElement("i");
        if (at < guide.index) dot.className = "on";
        steps.appendChild(dot);
      });
    }
  }

  // The ring fills with how far the current angle has come — not only once it is
  // reached — and dims while no face is in the frame, so the shopper can see the
  // scan responding to them instead of waiting on a blank ring.
  function paintProgress(progress, lost) {
    const ring = byId("age-ring");
    if (!ring) return;
    const share = (guide.index + Math.max(0, Math.min(1, Number(progress) || 0))) / STEPS.length;
    ring.style.setProperty("--turn", String(Math.round(share * 100)));
    ring.classList.toggle("near", !lost && Number(progress) >= 0.75);
    ring.classList.toggle("lost", Boolean(lost));
  }

  function armGuide(text) {
    const shot = byId("age-shot");
    shot.disabled = false;
    shot.textContent = text || "Start over";
    syncStartButton();
  }

  function stopGuide() {
    if (guide.timer) {
      clearInterval(guide.timer);
      guide.timer = null;
    }
  }

  function restartGuide() {
    stopGuide();
    guide.index = 0;
    guide.window = [];
    guide.baseline = null;
    guide.views = [];
    guide.lastLuma = null;
    guide.moved = 0;
    guide.samples = 0;
    guide.image = null;
    // The model line belongs to the scan that just ended; a new one starts clean.
    const model = byId("age-model");
    if (model) {
      model.hidden = true;
      model.className = "age-model";
      model.textContent = "";
    }
    setStatus("");
    paintGuide();
  }

  function startGuide() {
    if (!stream || !video.videoWidth) return;
    restartGuide();
    const shot = byId("age-shot");
    shot.disabled = true;
    shot.textContent = "Scanning…";
    guide.timer = setInterval(tickGuide, GUIDE_MS);
    tickGuide();
  }

  function tickGuide() {
    if (!stream || !video.videoWidth) return;
    const stats = measure(video, true);
    const pose = poseFrom(stats, MEASURE_SIDE);
    const verdict = judgePose(STEPS[guide.index], pose, guide.baseline);
    paintProgress(verdict.progress, !pose);
    guide.window.push(verdict.ok ? 1 : 0);
    if (guide.window.length > HOLD + 1) guide.window.shift();
    if (!verdict.ok) {
      setHint(verdict.hint);
      return;
    }
    // Held across the recent frames rather than required of every single one.
    const held = guide.window.reduce((total, sample) => total + sample, 0);
    if (guide.window.length < HOLD || held < HOLD) {
      setHint("Hold it there…");
      return;
    }
    keepView(STEPS[guide.index], pose, stats);
  }

  // One angle reached: keep the measurement (never the picture) and move on.
  function keepView(step, pose, stats) {
    guide.window = [];
    if (step.axis === "center") {
      guide.baseline = pose;
      // The relay path needs one frame; the straight-on view is the one it gets.
      guide.image = relayConfigured(settings) ? squareFromVideo() : null;
    }
    if (guide.lastLuma) {
      const moved = motion(guide.lastLuma, stats.luma, stats.box);
      if (moved !== null) {
        guide.moved += moved;
        guide.samples += 1;
      }
    }
    guide.lastLuma = stats.luma;
    guide.views.push({ id: step.id, pose, stats });
    guide.index += 1;
    paintGuide();
    if (guide.index >= STEPS.length) finishGuide();
  }

  // Every angle is in: the views are compared as one temporary face model before
  // anything is judged, and a scan that does not hold together is not submitted.
  function finishGuide() {
    stopGuide();
    const label = byId("age-guide-label");
    if (label) label.textContent = "Double-checking your face model…";
    setHint("Comparing the angles you just turned through");
    const verdict = compareModel(guide.views);
    const line = byId("age-model");
    if (line) {
      line.hidden = false;
      line.className = "age-model " + (verdict.ok ? "ok" : "bad");
      line.textContent = verdict.ok
        ? "Face model held up across all " + guide.views.length + " angles."
        : "Face model did not match — " + verdict.message + ".";
    }
    if (!verdict.ok) {
      // Nothing is submitted: the camera stays open and the angles start again.
      restartGuide();
      setStatus("That scan did not hold together (" + verdict.message + "). Keep your face in the ring and scan again.", "wait");
      setHint("Straighten up, then start the scan again.");
      armGuide("Scan again");
      return;
    }

    const centre = guide.views[0].stats;
    const averageMoved = guide.samples ? guide.moved / guide.samples : null;
    const image = guide.image;
    stop();
    if (relayConfigured(settings)) {
      if (!image) {
        setStatus("The camera was not ready when the scan started. Try again.", "wait");
        return;
      }
      submit(image);
      return;
    }
    submitLocal(statsFromView(centre, averageMoved));
  }

  function stop() {
    stopGuide();
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
  // luma buffer the next frame is compared against for movement. The scratch
  // canvas is made once — the guide measures five frames a second, and a new
  // canvas each time would only feed the garbage collector.
  let scratch = null;
  let scratchContext = null;

  function measure(source, sized) {
    const box = sized
      ? { width: source.videoWidth || 0, height: source.videoHeight || 0 }
      : { width: source.width || 0, height: source.height || 0 };
    if (!box.width || !box.height) return null;
    if (!scratch) {
      scratch = document.createElement("canvas");
      scratch.width = MEASURE_SIDE;
      scratch.height = MEASURE_SIDE;
      scratchContext = scratch.getContext("2d", { willReadFrequently: true });
    }
    const edge = Math.min(box.width, box.height);
    scratchContext.drawImage(
      source,
      (box.width - edge) / 2,
      (box.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      MEASURE_SIDE,
      MEASURE_SIDE
    );
    return summarize(
      scratchContext.getImageData(0, 0, MEASURE_SIDE, MEASURE_SIDE).data,
      MEASURE_SIDE,
      MEASURE_SIDE
    );
  }

  // One kept view, in the shape the worker judges: the straight-on numbers, with
  // the movement seen across the turns standing in for a second frame.
  function statsFromView(stats, moved) {
    return {
      faceFound: stats.found,
      faceShare: stats.share,
      fill: stats.fill,
      aspect: stats.aspect,
      contrast: stats.contrast,
      brightness: stats.brightness,
      motion: typeof moved === "number" ? moved : null,
      skinShare: stats.share,
    };
  }

  // What the worker judges for a chosen photo. One frame describes the face; the
  // pair says whether it is a person in front of the camera or a picture of one
  // moved across it.
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
      // A camera that is taken away (unplugged, revoked, or the tab closed)
      // should end the scan rather than leave the guide ticking on a dead frame.
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", stop));
      await video.play().catch(() => {});
      cam.hidden = false;
      armGuide();
      byId("age-shot").focus();
      setStatus("");
      startGuide();
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

  // Anything short of a finished scan is simply run again, from the straight-on
  // view, with the camera still open.
  function restartScan() {
    if (!stream) {
      openCamera();
      return;
    }
    startGuide();
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
  byId("age-shot").addEventListener("click", restartScan);
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
