// Content script: the side panel asks it to apply a code, and it hands the work
// to CouponEngine. All UI lives in the side panel — nothing is injected here.
(function () {
  "use strict";

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message) return undefined;

    if (message.type === "coupon:probe") {
      sendResponse({ hasField: window.CouponEngine.findFields().length > 0 });
      return undefined;
    }

    if (message.type !== "coupon:apply") return undefined;

    window.CouponEngine.applyCode(message.code).then(sendResponse, function (error) {
      sendResponse({ status: "error", message: String((error && error.message) || error) });
    });
    return true;
  });
})();
