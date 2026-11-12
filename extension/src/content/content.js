// Content script bridge. The side panel asks it to scan the page, apply a code,
// clip the store's own coupon controls, find card fields, and (only when the
// shopper picks a saved card) type that card into them. All UI lives in the side
// panel — nothing is injected here.
//
// Frames: carts and checkouts are often rendered in an iframe, so this runs in
// every frame. A frame without a coupon field stays silent, which lets the
// frame that does have one answer a broadcast message.
(function () {
  "use strict";

  // Checkout detection reads field *attributes* only. It never touches .value,
  // so card numbers, expiry dates and security codes stay out of the extension.
  var PAYMENT_META_RE =
    /(cc-number|cc-exp|cc-csc|cc-name|card.?number|cardnumber|credit.?card|security.?code|\bcvv\b|\bcvc\b)/i;

  function isTop() {
    try {
      return window.top === window;
    } catch (_error) {
      return false;
    }
  }

  function describeField(el) {
    return [
      el.getAttribute("autocomplete"),
      el.getAttribute("name"),
      el.id,
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
    ]
      .filter(Boolean)
      .join(" ");
  }

  function paymentFields() {
    var inputs = document.querySelectorAll("input");
    return Array.prototype.filter.call(inputs, function (el) {
      if (el.type === "hidden" || el.disabled) return false;
      if (!PAYMENT_META_RE.test(describeField(el))) return false;
      return el.getClientRects().length > 0;
    });
  }

  function focusPaymentField() {
    var fields = paymentFields();
    if (!fields.length) return { focused: false };
    var target = fields[0];
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    try {
      target.focus({ preventScroll: true });
    } catch (_error) {
      target.focus();
    }
    return { focused: document.activeElement === target };
  }

  function scanPage() {
    var codes = window.PageScan ? window.PageScan.codes() : [];
    var clips = window.PageScan ? window.PageScan.clipOffers() : [];
    var product = window.PageScan ? window.PageScan.product() : null;
    return {
      top: isTop(),
      url: location.href,
      codes: codes,
      clips: clips,
      clipCount: clips.length,
      product: product,
    };
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message || !message.type) return undefined;

    if (message.type === "page:ping") {
      sendResponse({ ok: true, top: isTop() });
      return undefined;
    }

    if (message.type === "page:scan") {
      // Only the top frame describes the page the shopper is looking at.
      if (!isTop()) return undefined;
      try {
        sendResponse(scanPage());
      } catch (error) {
        sendResponse({ error: String((error && error.message) || error) });
      }
      return undefined;
    }

    if (message.type === "page:clip") {
      // The panel scanned the top frame, so only the top frame's targets map to
      // what it displayed.
      if (!isTop() || !window.PageScan) return undefined;
      window.PageScan.clipAll(typeof message.index === "number" ? message.index : undefined).then(
        function (result) {
          sendResponse(Object.assign({ ok: true }, result, { clips: window.PageScan.clipOffers() }));
        },
        function (error) {
          sendResponse({ ok: false, error: String((error && error.message) || error) });
        }
      );
      return true;
    }

    if (message.type === "coupon:probe") {
      var fields = window.CouponEngine ? window.CouponEngine.findFields() : [];
      if (!fields.length) return undefined; // another frame may hold the field
      sendResponse({ hasField: true });
      return undefined;
    }

    if (message.type === "checkout:probe") {
      if (!paymentFields().length) return undefined;
      sendResponse({ hasPaymentFields: true });
      return undefined;
    }

    if (message.type === "checkout:focus") {
      var result = focusPaymentField();
      if (!result.focused) return undefined;
      sendResponse(result);
      return undefined;
    }

    // The card itself only ever arrives in this message, from the worker, after
    // the shopper picked it in the panel. A frame that cannot fill anything stays
    // silent so the frame holding the fields is the one that answers.
    if (message.type === "card:fill") {
      if (!window.CardFill) return undefined;
      var filled;
      try {
        filled = window.CardFill.fill(message.card);
      } catch (error) {
        sendResponse({ error: String((error && error.message) || error) });
        return undefined;
      }
      if (!filled.filled.length) return undefined;
      sendResponse(filled);
      return undefined;
    }

    if (message.type !== "coupon:apply") return undefined;

    var candidates = window.CouponEngine ? window.CouponEngine.findFields() : [];
    if (!candidates.length) return undefined; // another frame may hold the field

    window.CouponEngine.applyCode(message.code, { timeout: message.timeout }).then(sendResponse, function (error) {
      sendResponse({ status: "error", message: String((error && error.message) || error) });
    });
    return true;
  });
})();
