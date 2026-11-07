// Content script: the side panel asks it to apply a code, and it hands the work
// to CouponEngine. All UI lives in the side panel — nothing is injected here.
(function () {
  "use strict";

  // Checkout detection reads field *attributes* only. It never touches .value,
  // so card numbers, expiry dates and security codes stay out of the extension.
  var PAYMENT_META_RE =
    /(cc-number|cc-exp|cc-csc|cc-name|card.?number|cardnumber|credit.?card|security.?code|\bcvv\b|\bcvc\b)/i;

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
      var meta = describeField(el);
      if (!PAYMENT_META_RE.test(meta)) return false;
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
    return { focused: document.activeElement === target || fields.length > 0 };
  }

  chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
    if (!message) return undefined;

    if (message.type === "coupon:probe") {
      sendResponse({ hasField: window.CouponEngine.findFields().length > 0 });
      return undefined;
    }

    if (message.type === "checkout:probe") {
      sendResponse({ hasPaymentFields: paymentFields().length > 0 });
      return undefined;
    }

    if (message.type === "checkout:focus") {
      sendResponse(focusPaymentField());
      return undefined;
    }

    if (message.type !== "coupon:apply") return undefined;

    window.CouponEngine.applyCode(message.code).then(sendResponse, function (error) {
      sendResponse({ status: "error", message: String((error && error.message) || error) });
    });
    return true;
  });
})();
