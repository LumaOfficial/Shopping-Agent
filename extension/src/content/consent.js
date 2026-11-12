// The panel's gate, read where a page script runs.
//
// The panel writes `terms` only from a deliberate tap on its agree button
// (src/lib/terms.js), and a record for another version, or one without a real
// timestamp, is no consent at all. Page scripts ask here before they touch a
// page, so the ad-slot script does nothing for a shopper who has not agreed —
// the network ruleset is held back the same way in the service worker.
(function (global) {
  "use strict";

  // Kept equal to TERMS_VERSION in src/lib/terms.js; test/policies.test.mjs
  // fails if the two drift.
  var TERMS_VERSION = "1.2";

  global.SavingsConsent = function (done) {
    function answer(record) {
      var ok =
        !!record &&
        typeof record === "object" &&
        !Array.isArray(record) &&
        record.version === TERMS_VERSION &&
        typeof record.at === "number" &&
        isFinite(record.at) &&
        record.at > 0;
      done(ok);
    }

    try {
      chrome.storage.local.get("terms", function (stored) {
        answer(stored && stored.terms);
      });
    } catch (_error) {
      answer(null);
    }
  };
})(window);
