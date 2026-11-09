// Cosmetic ad blocking and counting. The declarative rules in
// rules/ads.json stop ad requests before they leave the browser; this hides the
// empty slots those requests would have filled and counts them, which is the
// number the panel turns into money. It only styles elements that are ad slots
// and never reads page content.
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
  var reported = 0;

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
      }
    }
    return hidden.length;
  }

  // One report per page, carrying only the new count. Ads that load late are
  // reported on a later pass instead of being recounted.
  function settle() {
    var count = scan();
    if (count <= reported) return;
    var add = count - reported;
    reported = count;
    try {
      chrome.runtime.sendMessage({ type: "ads:report", count: add }, function () {
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

  settle();
  global.setTimeout(settle, 1200);
  global.setTimeout(settle, 4000);

  global.AdGuard = { count: function () { return hidden.length; }, scan: settle };
})(window);
