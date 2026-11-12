// Cosmetic ad blocking and counting, on the shops the extension covers. The
// declarative rules in rules/ads.json stop ad requests before they leave the
// browser; this hides the empty slots those requests would have filled and
// counts them, which is the number the panel turns into money. It only styles
// elements that are ad slots and never reads page content. The switch in
// Settings decides whether it runs at all.
(function (global) {
  "use strict";

  if (global.__savingsAdGuard) return;
  global.__savingsAdGuard = true;

  // Slots ad networks publish: a Google ad unit, a GPT container, a tag served
  // from a known ad domain. Anything else on the page is left alone.
  var SLOT_SELECTORS = [
    "ins.adsbygoogle",
    "[data-ad-slot]",
    "[data-ad-client]",
    "[data-google-query-id]",
    '[id^="google_ads"]',
    '[id^="div-gpt-ad"]',
    '[id^="ad-slot"]',
    '[id^="adslot"]',
    '[id^="ad-container"]',
    '[id^="adcontainer"]',
    '[class^="ad-slot"]',
    '[class^="adslot"]',
    '[class*=" ad-slot"]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="googleadservices"]',
    'iframe[src*="amazon-adsystem"]',
    'iframe[src*="criteo"]',
    'iframe[src*="taboola"]',
    'iframe[src*="outbrain"]',
    'iframe[src*="pubmatic"]',
    'iframe[src*="rubiconproject"]',
    'iframe[src*="adnxs"]',
    'iframe[src*="media.net"]'
  ];

  var hidden = [];
  // One measurement per hidden slot, in the order they were hidden, so a later
  // pass reports only the slots that arrived with lazy loading.
  var measured = [];
  var reported = 0;
  // Switched off means off: the ruleset stops blocking the requests and this
  // script leaves the page's slots alone, so nothing is hidden or counted.
  var enabled = true;

  function applySwitch(settings) {
    enabled = !(settings && settings.enabled && settings.enabled.adBlock === false);
  }

  var started = false;
  var agreed = false;
  // The last settings the extension wrote, so a gate change can re-apply the
  // switch without reading the page or storage again.
  var current = null;

  // The first pass waits for both the switch and the panel's gate: a shopper who
  // has not agreed sees the page's slots left alone, and a profile with ad
  // blocking off has them left alone from the first paint rather than after one
  // report.
  function start() {
    if (started || !agreed) return;
    started = true;
    settle();
    global.setTimeout(settle, 1200);
    global.setTimeout(settle, 4000);
  }

  // src/content/consent.js answers from the record the panel writes on its agree
  // button. Without that file there is no way to read the gate, so nothing runs.
  function gate() {
    if (typeof global.SavingsConsent !== "function") return;
    global.SavingsConsent(function (ok) {
      agreed = ok;
      if (!ok) {
        enabled = false;
        started = false;
        return;
      }
      applySwitch(current);
      start();
    });
  }

  try {
    chrome.storage.local.get("settings", function (stored) {
      current = stored && stored.settings;
      gate();
    });
  } catch (_error) {
    // No storage means no gate to read, so nothing runs.
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes.settings) {
      current = changes.settings.newValue;
      applySwitch(current);
    }
    if (changes.terms) gate();
  });

  // What the slot is worth to an advertiser: its rendered area reads the format,
  // and a video reads longer or shorter. The panel decides the rate; this only
  // says what kind of slot it hid. Nothing on the page is read.
  function measure(el) {
    var width = 0;
    var height = 0;
    try {
      var rect = el.getBoundingClientRect();
      width = Math.round(rect.width || 0);
      height = Math.round(rect.height || 0);
    } catch (_error) {
      // A frame that cannot be measured is worth the smallest package.
    }
    var video = null;
    try {
      video = el.tagName === "VIDEO" ? el : el.querySelector && el.querySelector("video");
    } catch (_error) {
      video = null;
    }
    var seconds = 0;
    if (video) {
      try {
        if (isFinite(video.duration)) seconds = Math.round(video.duration);
      } catch (_error) {
        seconds = 0;
      }
    }
    return { width: width, height: height, video: Boolean(video), seconds: seconds };
  }

  // Hides every slot it has not seen yet and answers with the page's total, so
  // a later pass only counts the slots that arrived with lazy loading.
  function scan() {
    var budget = 400;
    for (var index = 0; index < SLOT_SELECTORS.length && budget > 0; index += 1) {
      var nodes;
      try {
        nodes = document.querySelectorAll(SLOT_SELECTORS[index]);
      } catch (_error) {
        continue;
      }
      for (var node = 0; node < nodes.length && budget > 0; node += 1) {
        var el = nodes[node];
        budget -= 1;
        if (!el.isConnected || hidden.indexOf(el) !== -1) continue;
        el.setAttribute("data-savings-ad", "hidden");
        el.style.setProperty("display", "none", "important");
        hidden.push(el);
        measured.push(measure(el));
      }
    }
    return hidden.length;
  }

  // One report per page, carrying only the new slots. Ads that load late are
  // reported on a later pass instead of being recounted.
  function settle() {
    if (!enabled || !agreed) return;
    var count = scan();
    if (count <= reported) return;
    var fresh = measured.slice(reported);
    reported = count;
    try {
      chrome.runtime.sendMessage({ type: "ads:report", slots: fresh }, function () {
        // The running total stays in the worker; a closed frame is not an error.
        if (chrome.runtime.lastError) return;
      });
    } catch (_error) {
      // The extension was reloaded under the page.
    }
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || message.type !== "ads:probe") return undefined;
    sendResponse({ count: hidden.length });
    return undefined;
  });

  global.AdGuard = { count: function () { return hidden.length; }, scan: settle };
})(window);
