// Classic (non-module) script loaded as a content script before content.js.
// Exposes window.CouponEngine: finds the store's promo field, types a code into
// it through native setters + real events, submits it, then reads the page's
// own confirmation/error text and the order total to decide whether it took.
(function (global) {
  "use strict";

  var FIELD_RE = /(coupon|promo|promotion|discount|voucher|offer\s*code|gift\s*card|source\s*code)/i;
  var APPLY_RE = /^(apply|redeem|submit|use\s*code|add\s*code|apply\s*code|apply\s*coupon|continue|go)$/i;
  var ERROR_RE =
    /(invalid|not\s+valid|isn'?t\s+valid|expired|no\s+longer|didn'?t\s+work|could\s+not\s+be\s+applied|cannot\s+be\s+applied|not\s+recognized|use\s+a\s+different|minimum|does\s+not\s+apply)/i;
  var SUCCESS_RE =
    /(applied|you\s+saved|savings|discount\s+of|code\s+accepted|has\s+been\s+added|success)/i;

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    var style = global.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return rect.width > 20 && rect.height > 6;
  }

  function describe(el) {
    return [
      el.id,
      el.name,
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("data-testid"),
      typeof el.className === "string" ? el.className : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  function findFields(root) {
    var scope = root || document;
    var inputs = scope.querySelectorAll(
      'input[type="text"], input[type="search"], input:not([type])'
    );
    return Array.prototype.filter.call(inputs, function (el) {
      return !el.disabled && !el.readOnly && isVisible(el) && FIELD_RE.test(describe(el));
    });
  }

  function findApplyButton(field) {
    var scope = field.form || (field.parentElement && field.parentElement.parentElement) || document;
    var candidates = Array.prototype.filter.call(
      scope.querySelectorAll('button, input[type="submit"], [role="button"]'),
      function (el) {
        return isVisible(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true";
      }
    );
    var labelled = candidates.find(function (el) {
      var text = (el.innerText || el.value || "").trim();
      return APPLY_RE.test(text);
    });
    if (labelled) return labelled;
    var submits = candidates.filter(function (el) {
      return el.type === "submit" || el.tagName === "BUTTON";
    });
    return submits.length === 1 ? submits[0] : null;
  }

  function setValue(field, value) {
    var proto =
      field instanceof global.HTMLTextAreaElement
        ? global.HTMLTextAreaElement.prototype
        : global.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    field.focus();
    setter.call(field, "");
    field.dispatchEvent(new Event("input", { bubbles: true }));
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function pressEnter(field) {
    ["keydown", "keypress", "keyup"].forEach(function (type) {
      field.dispatchEvent(
        new KeyboardEvent(type, {
          bubbles: true,
          cancelable: true,
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
        })
      );
    });
  }

  function feedbackNodes(field) {
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('[aria-live], [role="alert"], [role="status"]')
    );
    var parent = field.closest("form") || field.parentElement;
    for (var depth = 0; parent && depth < 4; depth += 1) {
      Array.prototype.push.apply(
        nodes,
        parent.querySelectorAll(
          '[class*="error" i], [class*="success" i], [class*="invalid" i], [class*="message" i], [class*="applied" i]'
        )
      );
      parent = parent.parentElement;
    }
    return nodes
      .map(function (node) {
        return (node.textContent || "").replace(/\s+/g, " ").trim();
      })
      .filter(function (text, index, all) {
        return text && text.length < 240 && all.indexOf(text) === index;
      });
  }

  var TOTAL_SELECTOR =
    '[class*="total" i], [data-testid*="total" i], [data-testid*="price" i], [id*="total" i], [class*="order-total" i]';

  function totalText() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(TOTAL_SELECTOR)).slice(0, 12);
    return nodes
      .map(function (node) {
        return (node.textContent || "").replace(/\s+/g, " ").trim();
      })
      .join(" | ")
      .slice(0, 600);
  }

  // Largest amount on the page is the most reliable "order total" signal; a
  // numeric drop after submitting is proof the code was accepted.
  function orderTotal() {
    var amounts = (totalText().match(/-?\$?\d[\d,]*\.\d{2}/g) || [])
      .map(function (raw) {
        return parseFloat(raw.replace(/[^0-9.\-]/g, ""));
      })
      .filter(function (value) {
        return isFinite(value);
      });
    return amounts.length ? Math.max.apply(null, amounts) : null;
  }

  /**
   * Types `code` into the store's promo field and submits it.
   * Resolves to {status, message, totalBefore, totalAfter}. status is one of
   * "applied" | "rejected" | "unverified" | "no-field".
   */
  async function applyCode(code, options) {
    var opts = options || {};
    var timeout = opts.timeout || 5000;
    var field = opts.field || findFields()[0];
    if (!field) {
      return { status: "no-field", message: "No coupon field on this page." };
    }

    var before = feedbackNodes(field);
    var totalBefore = orderTotal();
    var button = findApplyButton(field);

    field.scrollIntoView({ block: "center", behavior: "smooth" });
    setValue(field, code);
    if (button) {
      button.click();
    } else {
      pressEnter(field);
    }

    var started = Date.now();
    var deadline = started + timeout;
    while (Date.now() < deadline) {
      await sleep(250);
      var messages = feedbackNodes(field);
      var fresh = messages.filter(function (text) {
        return before.indexOf(text) === -1;
      });
      var totalAfter = orderTotal();
      if (totalBefore !== null && totalAfter !== null && totalAfter < totalBefore - 0.005) {
        return {
          status: "applied",
          message: "Order total dropped to $" + totalAfter.toFixed(2),
          totalBefore: totalBefore,
          totalAfter: totalAfter,
        };
      }
      var matched = fresh.find(function (text) {
        return ERROR_RE.test(text) || SUCCESS_RE.test(text);
      });
      if (matched) {
        var rejected = ERROR_RE.test(matched) && !SUCCESS_RE.test(matched);
        return {
          status: rejected ? "rejected" : "applied",
          message: matched,
          totalBefore: totalBefore,
          totalAfter: totalAfter,
        };
      }
      // Stores often repeat the identical error text, so a new string may never
      // appear. After a short grace period a visible error next to the field
      // still means the code was refused.
      if (Date.now() - started > 1200) {
        var visibleError = messages.find(function (text) {
          return ERROR_RE.test(text) && !SUCCESS_RE.test(text);
        });
        if (visibleError) {
          return {
            status: "rejected",
            message: visibleError,
            totalBefore: totalBefore,
            totalAfter: totalAfter,
          };
        }
      }
    }

    return {
      status: "unverified",
      message: "No confirmation from the store appeared — check your total before paying.",
      totalBefore: totalBefore,
      totalAfter: orderTotal(),
    };
  }

  global.CouponEngine = {
    applyCode: applyCode,
    findFields: findFields,
    findApplyButton: findApplyButton,
    orderTotal: orderTotal,
  };
})(window);
