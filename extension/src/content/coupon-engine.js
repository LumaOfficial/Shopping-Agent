// Classic (non-module) script loaded as a content script before content.js.
// Exposes window.CouponEngine: finds the store's promo field, types a code into
// it through native setters + real events, submits it, then reads the page's
// own confirmation/error text, discount lines and order total to decide whether
// it took. Nothing here is injected into the page.
(function (global) {
  "use strict";

  // Coupon-ish field wording. Deliberately excludes "gift card": that field is
  // for a serial number, not a promo code.
  var FIELD_RE = /(coupon|promo|promotion|voucher|discount|offer\s*code|source\s*code|redeem)/i;
  var NEVER_RE = /(search|query|gift\s*card|giftcard|zip|postal|email|password|card\s*number|cardnumber|cvv)/i;
  var APPLY_RE = /^(apply|redeem|submit|use\s*code|add\s*code|apply\s*code|apply\s*coupon|use\s*coupon|go)$/i;
  var ERROR_RE = /(invalid|not\s+valid|isn'?t\s+valid|expired|no\s+longer|didn'?t\s+work|could\s+not\s+be\s+applied|cannot\s+be\s+applied|not\s+recognized|not\s+applicable|use\s+a\s+different|minimum|does\s+not\s+apply|unable\s+to\s+apply|enter\s+a\s+valid)/i;
  var SUCCESS_RE = /(applied|you\s+saved|you\s+save|congratulations|discount\s+of|code\s+accepted|has\s+been\s+added|promo\s+code\s+added|success)/i;
  var AMOUNT_RE = /(?:[$€£¥]|USD|EUR|GBP|CAD|AUD)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/;

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
    if (style.clip === "rect(0px, 0px, 0px, 0px)") return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 12 && rect.height > 4;
  }

  function textOf(el) {
    return (el.innerText || el.value || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  // ---- DOM access -------------------------------------------------------
  // Stores increasingly render their cart inside shadow roots, so every query
  // walks open shadow trees too (bounded, so a huge page stays fast).
  var SHADOW_BUDGET = 4000;

  function rootsFrom(root) {
    var roots = [root || document];
    var budget = SHADOW_BUDGET;
    for (var index = 0; index < roots.length && budget > 0; index += 1) {
      var all;
      try {
        all = roots[index].querySelectorAll("*");
      } catch (_error) {
        continue;
      }
      for (var node = 0; node < all.length && budget > 0; node += 1) {
        budget -= 1;
        if (all[node].shadowRoot) roots.push(all[node].shadowRoot);
      }
    }
    return roots;
  }

  function queryAll(selector, root) {
    var results = [];
    rootsFrom(root).forEach(function (scope) {
      var found;
      try {
        found = scope.querySelectorAll(selector);
      } catch (_error) {
        return;
      }
      Array.prototype.push.apply(results, Array.prototype.slice.call(found));
    });
    return results;
  }

  function describe(el) {
    return [
      el.id,
      el.name,
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("data-testid"),
      el.getAttribute("autocomplete"),
      typeof el.className === "string" ? el.className : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  // ---- promo field ------------------------------------------------------
  function scoreField(el) {
    var meta = describe(el);
    if (NEVER_RE.test(meta)) return 0;
    if (!FIELD_RE.test(meta)) return 0;
    var score = 1;
    if (/(coupon|promo|voucher)/i.test(meta)) score += 2;
    if (el.tagName === "INPUT") score += 1;
    return score;
  }

  function findFields(root) {
    var inputs = queryAll('input[type="text"], input[type="search"], input:not([type]), textarea', root);
    return inputs
      .map(function (el, index) {
        return { el: el, score: scoreField(el), index: index };
      })
      .filter(function (entry) {
        return entry.score > 0 && !entry.el.disabled && !entry.el.readOnly && isVisible(entry.el);
      })
      .sort(function (a, b) {
        return b.score - a.score || a.index - b.index;
      })
      .map(function (entry) {
        return entry.el;
      });
  }

  function containerCandidates(field) {
    var scopes = [];
    if (field.form) scopes.push(field.form);
    var parent = field.parentElement;
    for (var depth = 0; parent && depth < 4; depth += 1) {
      scopes.push(parent);
      parent = parent.parentElement;
    }
    return scopes;
  }

  function findApplyButton(field) {
    var scopes = containerCandidates(field);
    for (var index = 0; index < scopes.length; index += 1) {
      var candidates = Array.prototype.filter.call(
        queryAll('button, input[type="submit"], [role="button"]', scopes[index]),
        function (el) {
          return isVisible(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true";
        }
      );
      var labelled = candidates.find(function (el) {
        return APPLY_RE.test(textOf(el).toLowerCase().replace(/\s+/g, " ").trim());
      });
      if (labelled) return labelled;
      // A single unlabelled submit button next to the field is almost always it.
      var submits = candidates.filter(function (el) {
        return el.type === "submit";
      });
      if (scopes[index] === field.form && submits.length === 1) return submits[0];
    }
    return null;
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

  // ---- order signals ----------------------------------------------------
  var TOTAL_SELECTOR =
    '[class*="total" i], [data-testid*="total" i], [id*="total" i], [aria-label*="total" i], [class*="amount-due" i], [class*="order-summary" i]';
  var DISCOUNT_SELECTOR =
    '[class*="discount" i], [class*="promo" i], [class*="coupon" i], [class*="saving" i], [data-testid*="discount" i], [data-testid*="promo" i]';

  function amountsIn(text) {
    var amounts = [];
    var matches = String(text || "").match(/(?:[$€£¥]\s?\d[\d,]*(?:\.\d{2})?|\d[\d,]*\.\d{2})/g) || [];
    matches.forEach(function (raw) {
      var value = parseFloat(raw.replace(/[^0-9.]/g, ""));
      if (isFinite(value) && value > 0) amounts.push(value);
    });
    return amounts;
  }

  function orderTotal() {
    var values = [];
    queryAll(TOTAL_SELECTOR).slice(0, 40).forEach(function (node) {
      if (!isVisible(node)) return;
      Array.prototype.push.apply(values, amountsIn(textOf(node)));
    });
    if (!values.length) return null;
    return Math.max.apply(null, values);
  }

  function discountSignals() {
    var signals = [];
    queryAll(DISCOUNT_SELECTOR).slice(0, 60).forEach(function (node) {
      if (!isVisible(node)) return;
      var text = textOf(node);
      if (!text || text.length > 200) return;
      if (ERROR_RE.test(text)) return;
      signals.push(text);
    });
    return signals;
  }

  function feedbackNodes(field) {
    var nodes = queryAll('[aria-live], [role="alert"], [role="status"]');
    var parent = field.closest("form") || field.parentElement;
    for (var depth = 0; parent && depth < 4; depth += 1) {
      Array.prototype.push.apply(
        nodes,
        Array.prototype.filter.call(
          parent.querySelectorAll(
            '[class*="error" i], [class*="success" i], [class*="invalid" i], [class*="message" i], [class*="applied" i], [class*="alert" i]'
          ),
          function (node) {
            return !field.contains(node) && node !== field;
          }
        )
      );
      parent = parent.parentElement;
    }
    var texts = [];
    nodes.forEach(function (node) {
      if (!isVisible(node)) return;
      var text = textOf(node);
      if (!text || text.length > 240) return;
      if (texts.indexOf(text) === -1) texts.push(text);
    });
    return texts;
  }

  function snapshot(field) {
    return {
      total: orderTotal(),
      discounts: discountSignals(),
      feedback: feedbackNodes(field),
    };
  }

  function fresh(before, after) {
    return after.filter(function (text) {
      return before.indexOf(text) === -1;
    });
  }

  /**
   * Types `code` into the store's promo field and submits it.
   * Resolves to {status, message, totalBefore, totalAfter, saving} where status
   * is "applied" | "rejected" | "unverified" | "no-field".
   */
  async function applyCode(code, options) {
    var opts = options || {};
    var timeout = opts.timeout || 6000;
    var field = opts.field || findFields()[0];
    if (!field) {
      return { status: "no-field", message: "No coupon field on this page." };
    }

    var before = snapshot(field);
    var button = findApplyButton(field);

    field.scrollIntoView({ block: "center", behavior: "smooth" });
    setValue(field, code);
    await sleep(120);
    if (button) {
      button.click();
    } else {
      pressEnter(field);
    }

    var started = Date.now();
    var deadline = started + timeout;
    while (Date.now() < deadline) {
      await sleep(220);
      var after = snapshot(field);
      var totalAfter = after.total;

      if (before.total !== null && totalAfter !== null && totalAfter < before.total - 0.009) {
        return {
          status: "applied",
          message: "Order total dropped to $" + totalAfter.toFixed(2),
          totalBefore: before.total,
          totalAfter: totalAfter,
          saving: before.total - totalAfter,
        };
      }

      var newDiscount = fresh(before.discounts, after.discounts).find(function (text) {
        return AMOUNT_RE.test(text) || /applied|added/i.test(text);
      });
      if (newDiscount) {
        var match = newDiscount.match(AMOUNT_RE);
        var saving = match ? parseFloat(String(match[1]).replace(/,/g, "")) : null;
        return {
          status: "applied",
          message: newDiscount,
          totalBefore: before.total,
          totalAfter: totalAfter,
          saving: saving,
        };
      }

      var newFeedback = fresh(before.feedback, after.feedback);
      var matched = newFeedback.find(function (text) {
        return ERROR_RE.test(text) || SUCCESS_RE.test(text);
      });
      if (matched) {
        var rejected = ERROR_RE.test(matched) && !SUCCESS_RE.test(matched);
        return {
          status: rejected ? "rejected" : "applied",
          message: matched,
          totalBefore: before.total,
          totalAfter: totalAfter,
          saving: null,
        };
      }

      // Stores repeat the identical error text for a wrong code, so no new
      // string may ever appear. A visible error beside the field still counts.
      if (Date.now() - started > 1400) {
        var visibleError = after.feedback.find(function (text) {
          return ERROR_RE.test(text) && !SUCCESS_RE.test(text);
        });
        if (visibleError) {
          return {
            status: "rejected",
            message: visibleError,
            totalBefore: before.total,
            totalAfter: totalAfter,
            saving: null,
          };
        }
      }
    }

    return {
      status: "unverified",
      message: "The store gave no confirmation — check your total before paying.",
      totalBefore: before.total,
      totalAfter: orderTotal(),
      saving: null,
    };
  }

  global.CouponEngine = {
    applyCode: applyCode,
    findFields: findFields,
    findApplyButton: findApplyButton,
    orderTotal: orderTotal,
  };
})(window);
