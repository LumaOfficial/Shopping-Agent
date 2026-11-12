// Filling a card the shopper picked in the panel.
//
// The browser's own autofill is a dropdown that has to be opened, read and
// clicked, and it offers whatever card the browser guessed. This writes the
// values the shopper chose straight into the fields on the page and fires the
// events a keystroke would, so the page's own validation sees a real change and
// its formatting runs over the number.
//
// Nothing is remembered here. The card arrives in the message, goes into the
// fields and is dropped; this file keeps no copy and writes none to storage. The
// security code is never part of the message, because it is never stored.
(function () {
  "use strict";

  var NUMBER_RE = /(cc-number|ccnumber|card.?number|cardnumber|credit.?card|account.?number|pan\b)/i;
  var EXP_RE = /(cc-exp|expir|exp.?date|valid.?thru|card.?exp)/i;
  var MONTH_RE = /(cc-exp-month|exp.?month|expir.?month|card.?month|\bmm\b)/i;
  var YEAR_RE = /(cc-exp-year|exp.?year|expir.?year|card.?year|\byy\b|\byyyy\b)/i;
  var NAME_RE = /(cc-name|ccname|card.?holder|name.?on.?card|cardholder)/i;
  var CVC_RE = /(cc-csc|cc-cvv|security.?code|\bcvv\b|\bcvc\b|\bcsc\b|\bcid\b|verification)/i;
  var MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function describe(el) {
    return [
      el.getAttribute("autocomplete"),
      el.getAttribute("name"),
      el.id,
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("data-testid"),
    ]
      .filter(Boolean)
      .join(" ");
  }

  function usable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.tagName === "INPUT" && /^(hidden|submit|button|checkbox|radio|image)$/i.test(el.type || "")) {
      return false;
    }
    return el.getClientRects().length > 0;
  }

  // What a field is for, read the way the browser's own autofill reads it. The
  // security code is named and then skipped: it is recognised so that a field
  // holding a CVV is never mistaken for the number or the expiry.
  function kindOf(el) {
    var tag = el.tagName;
    if (tag !== "INPUT" && tag !== "SELECT") return "";

    // The autocomplete tokens are unambiguous, so they are read first. "cc-exp"
    // is one box for month and year; "cc-exp-month" is one half of a pair.
    var auto = String(el.getAttribute("autocomplete") || "").toLowerCase().trim();
    if (auto === "cc-number") return "number";
    if (auto === "cc-name" || auto === "cc-given-name" || auto === "cc-family-name") return "name";
    if (auto === "cc-exp") return "exp";
    if (auto === "cc-exp-month") return "month";
    if (auto === "cc-exp-year") return "year";
    if (auto === "cc-csc" || auto === "cc-cvv") return "cvc";

    var text = describe(el);
    if (!text) return "";
    if (CVC_RE.test(text)) return "cvc";
    // A placeholder such as "MM / YYYY" is one expiry box, not a month box.
    var monthish = MONTH_RE.test(text);
    var yearish = YEAR_RE.test(text);
    if (monthish && yearish) return "exp";
    if (monthish) return "month";
    if (yearish) return "year";
    if (EXP_RE.test(text)) return "exp";
    if (NUMBER_RE.test(text)) return "number";
    if (NAME_RE.test(text)) return "name";
    return "";
  }

  function scan() {
    var found = { number: null, exp: null, month: null, year: null, name: null, cvc: null };
    var nodes = document.querySelectorAll("input, select");
    for (var index = 0; index < nodes.length; index += 1) {
      var el = nodes[index];
      if (!usable(el)) continue;
      var kind = kindOf(el);
      if (!kind || found[kind]) continue;
      // A separate month and year pair beats a combined expiry box: filling only
      // the pair the page actually shows avoids typing into a hidden duplicate.
      found[kind] = el;
    }
    if (found.month && found.year) found.exp = null;
    return found;
  }

  function fire(el, name) {
    var event;
    if (name === "input" && typeof InputEvent === "function") {
      event = new InputEvent("input", { bubbles: true, cancelable: false, inputType: "insertText" });
    } else {
      event = new Event(name, { bubbles: true, cancelable: false });
    }
    el.dispatchEvent(event);
  }

  // The page may have wrapped `value` with its own setter (React does), so the
  // native one is used: this is what a keystroke would call, and it leaves the
  // framework's tracker agreeing with what is on screen.
  function setText(el, value) {
    var proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, "value");
    try {
      el.focus({ preventScroll: true });
    } catch (_error) {
      el.focus();
    }
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
    fire(el, "input");
    fire(el, "change");
  }

  function pad(value) {
    return String(value).padStart ? String(value).padStart(2, "0") : ("0" + value).slice(-2);
  }

  function normalize(text) {
    return String(text === undefined || text === null ? "" : text)
      .trim()
      .toLowerCase();
  }

  function stripLeadingZero(text) {
    return /\d/.test(text) ? text.replace(/^0+(?=\d)/, "") : text;
  }

  // A select wants the option the page shipped, not a string: the month may be
  // "09", "9" or "September", and the year "2029" or "29".
  function optionMatches(option, candidate) {
    var wanted = normalize(candidate);
    if (!wanted) return false;
    var value = normalize(option.value);
    var label = normalize(option.textContent);
    if (value === wanted || label === wanted) return true;
    // The same number spelled differently: "09" against "9".
    if (stripLeadingZero(value) === stripLeadingZero(wanted) && /\d/.test(wanted)) return true;
    // A year written in full against a two-digit option, and the other way.
    if (/\d/.test(wanted) && label.length > wanted.length && label.slice(-wanted.length) === wanted) return true;
    // "Sep" against "September".
    return wanted.length >= 3 && label.indexOf(wanted) === 0;
  }

  function fillSelect(el, candidates) {
    var options = Array.prototype.slice.call(el.options || []);
    for (var index = 0; index < candidates.length; index += 1) {
      var wanted = candidates[index];
      var found = options.find(function (option) {
        return optionMatches(option, wanted);
      });
      if (found) {
        setText(el, found.value);
        return true;
      }
    }
    return false;
  }

  function expiryText(el, month, year) {
    if (el.type === "month") return String(year) + "-" + pad(month);
    var maxlength = Number(el.getAttribute("maxlength")) || 0;
    var hint = describe(el);
    var fourDigit = maxlength >= 7 || /yyyy/.test(hint);
    return pad(month) + "/" + (fourDigit ? String(year) : String(year).slice(-2));
  }

  function groupNumber(number, brand) {
    var text = String(number || "").replace(/\D/g, "");
    var sizes = brand === "amex" ? [4, 6, 5] : [4, 4, 4, 4];
    var out = [];
    var at = 0;
    for (var index = 0; index < sizes.length && at < text.length; index += 1) {
      out.push(text.slice(at, at + sizes[index]));
      at += sizes[index];
    }
    if (at < text.length) out.push(text.slice(at));
    return out.join(" ");
  }

  function fill(card) {
    if (!card || !card.number) return { filled: [], missing: [] };
    var fields = scan();
    var filled = [];
    var missing = [];
    var number = String(card.number).replace(/\D/g, "");

    if (fields.number) {
      setText(fields.number, groupNumber(number, card.brand));
      filled.push("number");
    } else {
      missing.push("number");
    }

    var expiryDone = false;
    if (fields.month && fields.year) {
      var month = Number(card.expMonth);
      var year = Number(card.expYear);
      var monthName = MONTH_NAMES[month - 1] || "";
      var byMonth = fillSelect(fields.month, [pad(month), String(month), monthName, monthName.slice(0, 3)]);
      var byYear = fillSelect(fields.year, [String(year), String(year).slice(-2)]);
      expiryDone = byMonth && byYear;
    }
    if (!expiryDone && fields.exp) {
      setText(fields.exp, expiryText(fields.exp, card.expMonth, card.expYear));
      expiryDone = true;
    }
    if (expiryDone) filled.push("expiry");
    else missing.push("expiry");

    if (fields.name) {
      setText(fields.name, String(card.holder || ""));
      filled.push("name");
    }

    // The security code is deliberately not part of this: it is never stored, so
    // there is nothing to fill it with. The field is only reported, so the panel
    // can tell the shopper what is left for them to type.
    return { filled: filled, missing: missing, hasCvc: Boolean(fields.cvc) };
  }

  window.CardFill = {
    fields: scan,
    fill: fill,
  };
})();
