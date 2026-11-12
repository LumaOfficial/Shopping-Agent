// Classic content script (loads before content.js). Exposes window.PageScan:
//  - codes the shop publishes on the page the shopper is actually looking at
//  - "clip coupon" style offers the store exposes as a real control
//  - the product and price on a product page, for local price tracking
// Everything here is read from the live page. Nothing is invented, and anything
// the shopper cannot see is not treated as evidence.
(function (global) {
  "use strict";

  // "promo code: X", "voucher X", "use code X", "coupon X" — the shapes stores
  // actually publish. Every match still has to pass plausibleCode().
  var CODE_PATTERNS = [
    /(?:promo|coupon|voucher|discount|offer|referral|invite|redeem)s?\s*(?:codes?)?\s*(?:is|are|:|-|\u2013|\u2014)?\s*["'\u201c\u201d]?([A-Za-z0-9][A-Za-z0-9._-]{3,23})\b/gi,
    /\bcodes?\b\s*(?:is|are|:|-|\u2013|\u2014|=)?\s*["'\u201c\u201d]?([A-Za-z0-9][A-Za-z0-9._-]{3,23})\b/gi,
    // "use code SAVE20", "enter promo X", "apply voucher X", "redeem code X"
    /(?:use|enter|apply|redeem)\s+(?:the\s+)?(?:promo|coupon|voucher|discount|offer|referral)?\s*(?:code)?\s*["'\u201c\u201d]?([A-Za-z0-9][A-Za-z0-9._-]{3,23})\b/gi,
    // "SAVE20 for 20% off", "WELCOME gets you 10% off"
    /\b([A-Za-z0-9][A-Za-z0-9._-]{3,23})\s+(?:for|gives?|takes?|gets?|saves?)\s+\d{1,2}\s*(?:%|percent)\s*(?:off|discount)/gi,
    // "save 20% with SAVE20", "save $10 with code FALL"
    /(?:save|saving)\s+(?:\d{1,2}\s*%|[$€£]\s?\d+(?:\.\d{2})?)\s*(?:off\s*)?(?:with|using|when\s+you\s+use)\s+(?:code|voucher|coupon)?\s*["'\u201c\u201d]?([A-Za-z0-9][A-Za-z0-9._-]{3,23})\b/gi,
    // "take $10 off with SAVE10", "get 15% off with code SPRING"
    /(?:take|get|enjoy)\s+(?:\d{1,2}\s*%|[$€£]\s?\d+(?:\.\d{2})?)\s*off\s*(?:with|using)\s+(?:code|voucher|coupon)?\s*["'\u201c\u201d]?([A-Za-z0-9][A-Za-z0-9._-]{3,23})\b/gi,
    // "enter SAVE20 at checkout"
    /\benter\s+["'\u201c\u201d]?([A-Za-z0-9][A-Za-z0-9._-]{3,23})["'\u201c\u201d]?\s+(?:at|during|in)\s+(?:the\s+)?checkout/gi,
  ];

  // Words that sit next to "code" in ordinary prose and are never a code.
  var STOPWORDS = [
    "CODE", "CODES", "COUPON", "COUPONS", "DISCOUNT", "PROMO", "PROMOS", "VOUCHER", "OFFER",
    "OFFERS", "APPLIED", "APPLY", "CHECKOUT", "CART", "SHIPPING", "SALE", "SAVINGS", "SAVE",
    "PRICE", "ORDER", "ONLINE", "STORE", "FREE", "SHOP", "TOTAL", "SUBTOTAL", "TAX", "NOW",
    "MORE", "HERE", "TERMS", "DETAILS", "SELECT", "REQUIRED", "VALID", "EXPIRED", "AND", "THE",
    "THIS", "THAT", "YOUR", "FROM", "WITH", "HTML", "HTTPS", "HTTP", "WWW", "USD", "EUR", "GBP",
    "NEW", "ONLY", "TODAY", "DEAL", "DEALS", "ENDS", "STARTS", "SHOPPING", "BUY", "USE", "GET",
    "OFF", "EXTRA", "PLUS", "VIEW", "SHOW", "CLIP", "REVEAL", "COPY", "BASKET", "BAG", "ADD",
  ];

  // "postal code 90210", "country code US" and friends are identifiers on the
  // page, not savings. They are rejected unless a coupon word is right there.
  var NOT_A_COUPON = /(postal|zip|post\s*code|country|dial|area|error|status|model|item|product|barcode|tax|currency|swift|sort|tracking|shipping|order)\s*(?:number|no\.?|code|id)\b/i;
  var COUPON_WORD = /\b(promo|coupon|voucher|discount|offer|redeem|code)\b/i;

  var CLIP_RE =
    /(clip\s*(?:this\s*|the\s*)?(?:coupon|offer|deal|code)|clip\s*(?:&|and)\s*save|clip\s*for|clip\s*to\s*save|reveal\s*(?:the\s*)?(?:coupon|code|promo|offer|deal)|show\s*(?:the\s*)?(?:coupon|promo|code)|get\s*(?:the\s*)?(?:coupon|promo\s*)?code|unlock\s*(?:the\s*)?(?:coupon|code|offer|deal)|copy\s*(?:the\s*)?(?:coupon|promo\s*)?code|apply\s*coupon)/i;

  var clipTargets = [];

  // A shopper can only read what is rendered. Text inside a hidden template,
  // collapsed accordion or an aria-hidden copy is not evidence.
  function rendered(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest && el.closest('[hidden], [aria-hidden="true"]')) return false;
    var style = global.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
    if (el.getClientRects && el.getClientRects().length === 0) return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  }

  function isVisible(el) {
    return rendered(el);
  }

  function textOf(el) {
    return (el.innerText || el.value || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function roots() {
    var list = [document];
    var budget = 1500;
    for (var index = 0; index < list.length && budget > 0; index += 1) {
      var all;
      try {
        all = list[index].querySelectorAll("*");
      } catch (_error) {
        continue;
      }
      for (var node = 0; node < all.length && budget > 0; node += 1) {
        budget -= 1;
        if (all[node].shadowRoot) list.push(all[node].shadowRoot);
      }
    }
    return list;
  }

  function queryAll(selector) {
    var out = [];
    roots().forEach(function (scope) {
      var found;
      try {
        found = scope.querySelectorAll(selector);
      } catch (_error) {
        return;
      }
      Array.prototype.push.apply(out, Array.prototype.slice.call(found));
    });
    return out;
  }

  // ---- codes published on this page -------------------------------------
  // The sentence a code sits in, so a row reads "Save 20% with code SAVE20"
  // instead of a wall of banner copy.
  function snippet(source, index, length) {
    var start = Math.max(0, index - 52);
    var end = Math.min(source.length, index + length + 64);
    var text = source.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) text = "\u2026 " + text;
    if (end < source.length) text = text + " \u2026";
    return text.slice(0, 140);
  }

  function plausibleCode(rawToken, rawContext) {
    var original = String(rawToken || "").trim();
    var token = original
      .replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, "")
      .replace(/[._-]+$/, "")
      .toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]{2,23}$/.test(token)) return null;
    if (STOPWORDS.indexOf(token) !== -1) return null;

    var context = String(rawContext || "").replace(/\s+/g, " ").trim().slice(0, 160);
    var hasDigit = /[0-9]/.test(token);
    var hasSeparator = /[._-]/.test(token);
    var upper = original === original.toUpperCase();
    var couponish = COUPON_WORD.test(context);

    // A string of digits is a number on the page, not a code.
    if (/^\d+$/.test(token)) return null;
    // A word in lower case next to "code" is prose: "the code is simple".
    if (!upper && !hasDigit && !hasSeparator) return null;
    // Plain letters need a coupon word beside them to count.
    if (!hasDigit && !hasSeparator && !couponish) return null;
    if (!hasDigit && !hasSeparator && token.length < 5) return null;
    if (NOT_A_COUPON.test(context) && !/\b(promo|coupon|voucher|discount)\b/i.test(context)) {
      return null;
    }
    return { code: token, title: context || null, source: "page", strong: couponish };
  }

  // A code found in several places on the page is more likely real, so the
  // repeat raises the row's weight instead of being thrown away.
  function addCandidate(candidate, found, seen) {
    if (!candidate) return;
    var weight = candidate.strong ? 2 : 1;
    var existing = seen[candidate.code];
    if (existing) {
      existing.hits += weight;
      if (!existing.title && candidate.title) existing.title = candidate.title;
      return;
    }
    if (found.length >= 30) return;
    candidate.hits = weight;
    seen[candidate.code] = candidate;
    found.push(candidate);
  }

  // Pull every code-shaped token out of one piece of text.
  function codesInText(text, found, seen) {
    var source = String(text || "").replace(/\s+/g, " ").trim();
    if (source.length < 6) return;
    if (source.length > 1500) source = source.slice(0, 1500);
    for (var index = 0; index < CODE_PATTERNS.length; index += 1) {
      var pattern = CODE_PATTERNS[index];
      pattern.lastIndex = 0;
      var match;
      while ((match = pattern.exec(source))) {
        addCandidate(plausibleCode(match[1], snippet(source, match.index, match[0].length)), found, seen);
      }
    }
  }

  function codesFromText() {
    var found = [];
    var seen = {};
    var budget = 2500;

    var walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        var tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA") {
          return NodeFilter.FILTER_REJECT;
        }
        var text = (node.nodeValue || "").trim();
        if (text.length < 6 || text.length > 800) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var node;
    while (budget > 0 && (node = walker.nextNode())) {
      budget -= 1;
      // A hidden element still holds last season's banner in its markup.
      if (!rendered(node.parentElement)) continue;
      codesInText(node.nodeValue, found, seen);
      if (found.length >= 14) break;
    }
    return found;
  }

  var CODE_ATTRS = [
    "data-coupon-code",
    "data-promo-code",
    "data-discount-code",
    "data-voucher-code",
    "data-promotion-code",
    "data-apply-code",
    "data-code-value",
    "data-coupon-value",
    "data-promo-value",
    "data-coupon",
    "data-promo",
    "data-code",
    "data-clipboard-text",
    "data-copy-text",
  ];

  var CODE_ELEMENT_SELECTOR =
    "[data-coupon-code], [data-promo-code], [data-discount-code], [data-voucher-code], " +
    "[data-promotion-code], [data-apply-code], [data-code-value], [data-coupon-value], " +
    "[data-promo-value], [data-coupon], [data-promo], [data-code], [data-clipboard-text], " +
    "[data-copy-text], " +
    '[data-testid*="coupon" i], [data-testid*="promo" i], [data-testid*="voucher" i], ' +
    '[class*="coupon-code" i], [class*="promo-code" i], [class*="voucher-code" i], ' +
    '[class*="discount-code" i], [id*="coupon" i], [aria-label*="coupon" i], [title*="coupon" i]';

  function codesFromAttributes() {
    var found = [];
    var seen = {};
    var elements = queryAll(CODE_ELEMENT_SELECTOR);
    for (var index = 0; index < elements.length && index < 400; index += 1) {
      var el = elements[index];
      if (!isVisible(el)) continue;
      var context = textOf(el).slice(0, 140);
      for (var attr = 0; attr < CODE_ATTRS.length; attr += 1) {
        var value = el.getAttribute(CODE_ATTRS[attr]);
        // A copied URL or a block of markup in the attribute is not a code.
        if (!value || /[\/:<>@\s]{2,}/.test(value)) continue;
        addCandidate(plausibleCode(value, context || "Published by this page"), found, seen);
      }
      ["aria-label", "title"].forEach(function (name) {
        var label = el.getAttribute(name);
        if (label) codesInText(label, found, seen);
      });
      codesInText(context, found, seen);
    }
    return found;
  }

  // Meta descriptions and Product structured data often spell the promotion out.
  function codesFromMeta() {
    var found = [];
    var seen = {};
    [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      'meta[name="keywords"]',
    ].forEach(function (selector) {
      var el = document.querySelector(selector);
      if (el) codesInText(el.getAttribute("content"), found, seen);
    });
    return found;
  }

  function codesFromJsonLd() {
    var found = [];
    var seen = {};
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var index = 0; index < scripts.length && index < 20; index += 1) {
      var payload;
      try {
        payload = JSON.parse(scripts[index].textContent || "null");
      } catch (_error) {
        continue;
      }
      var queue = Array.isArray(payload) ? payload.slice() : [payload];
      var budget = 200;
      while (queue.length && budget > 0) {
        budget -= 1;
        var node = queue.shift();
        if (!node || typeof node !== "object") continue;
        if (typeof node.description === "string") codesInText(node.description, found, seen);
        if (typeof node.name === "string") codesInText(node.name, found, seen);
        if (Array.isArray(node["@graph"])) Array.prototype.push.apply(queue, node["@graph"]);
        if (node.offers) {
          Array.prototype.push.apply(queue, Array.isArray(node.offers) ? node.offers : [node.offers]);
        }
      }
    }
    return found;
  }

  // Attribute and banner codes come first because they are the ones the store
  // means a shopper to type; the strongest and most repeated surface to the top.
  function scanCodes() {
    var found = [];
    var seen = {};
    [codesFromAttributes(), codesFromText(), codesFromMeta(), codesFromJsonLd()].forEach(function (list) {
      list.forEach(function (item) {
        addCandidate(item, found, seen);
      });
    });
    return found
      .sort(function (a, b) {
        return b.hits - a.hits || a.code.localeCompare(b.code);
      })
      .slice(0, 10)
      .map(function (item) {
        return { code: item.code, title: item.title || null, source: "page", hits: item.hits };
      });
  }

  // ---- "clip coupon" controls -------------------------------------------
  function covered(el, list) {
    return list.some(function (other) {
      return other === el || (other.contains && other.contains(el));
    });
  }

  function scanClipOffers() {
    var targets = [];
    queryAll(
      'button, [role="button"], label, input[type="checkbox"], [data-testid*="coupon" i], [data-testid*="promotion" i]'
    ).forEach(function (el) {
      if (!isVisible(el)) return;
      if (el.disabled || el.getAttribute("aria-disabled") === "true") return;
      if (el.tagName === "INPUT" && el.type === "checkbox" && el.checked) return;
      if (covered(el, targets)) return;
      var label = textOf(el);
      var testId = el.getAttribute("data-testid") || "";
      var matches = CLIP_RE.test(label) || (label && /clip/i.test(label) && /coupon|offer|deal|promotion/i.test(label + " " + testId));
      if (!matches) return;
      targets.push(el);
    });
    clipTargets = targets.slice(0, 12);
    return clipTargets.map(function (el) {
      return { label: textOf(el).slice(0, 90) };
    });
  }

  async function clipOffers(index) {
    var targets = typeof index === "number" ? [clipTargets[index]].filter(Boolean) : clipTargets.slice();
    var clicked = 0;
    for (var i = 0; i < targets.length; i += 1) {
      var el = targets[i];
      if (!el || !el.isConnected) continue;
      try {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.click();
        clicked += 1;
      } catch (_error) {
        /* a control that refuses a synthetic click is skipped, not faked */
      }
      await new Promise(function (resolve) {
        setTimeout(resolve, 260);
      });
    }
    scanClipOffers();
    return { clicked: clicked, remaining: clipTargets.length };
  }

  // ---- product & price --------------------------------------------------
  function metaContent(name) {
    var el =
      document.querySelector('meta[property="' + name + '"]') ||
      document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute("content") : null;
  }

  function jsonLdProduct() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var index = 0; index < scripts.length && index < 20; index += 1) {
      var payload;
      try {
        payload = JSON.parse(scripts[index].textContent || "null");
      } catch (_error) {
        continue;
      }
      var queue = Array.isArray(payload) ? payload.slice() : [payload];
      var budget = 200;
      while (queue.length && budget > 0) {
        budget -= 1;
        var node = queue.shift();
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node["@graph"])) queue.push.apply(queue, node["@graph"]);
        if (Array.isArray(node.itemListElement)) queue.push.apply(queue, node.itemListElement);
        if (node.mainEntity && typeof node.mainEntity === "object") queue.push(node.mainEntity);
        var type = node["@type"];
        var types = Array.isArray(type) ? type : [type];
        if (
          types.some(function (value) {
            return /^(product|productgroup|individualproduct|productmodel)$/i.test(String(value));
          })
        ) {
          return node;
        }
      }
    }
    return null;
  }

  function toCents(value) {
    var number = typeof value === "number" ? value : parseFloat(String(value || "").replace(/[^0-9.]/g, ""));
    if (!isFinite(number) || number <= 0 || number > 1000000) return null;
    return Math.round(number * 100);
  }

  function currencyIn(text) {
    var found = String(text || "").match(/[$€£¥₹]/);
    if (!found) return null;
    return { $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR" }[found[0]] || null;
  }

  function offerPrice(offers) {
    if (!offers) return {};
    var list = Array.isArray(offers) ? offers : [offers];
    var prices = [];
    var currency = null;
    list.forEach(function (offer) {
      if (!offer || typeof offer !== "object") return;
      if (offer.priceCurrency && !currency) currency = offer.priceCurrency;
      var spec = offer.priceSpecification;
      var values = [offer.price, offer.lowPrice, offer.highPrice];
      if (spec && typeof spec === "object" && !Array.isArray(spec)) {
        values.push(spec.price, spec.minPrice, spec.maxPrice);
        if (spec.priceCurrency && !currency) currency = spec.priceCurrency;
      }
      values.forEach(function (value) {
        var cents = toCents(value);
        if (cents) prices.push(cents);
      });
    });
    if (!prices.length) return { currency: currency };
    return { price: Math.min.apply(null, prices), currency: currency };
  }

  // Crossed-out and "was" prices are the ones a shopper is *not* paying, and
  // shipping, tax or installment figures are not the product's price either.
  var PRICE_NOISE = /(was[-_ ]?price|old[-_ ]?price|list[-_ ]?price|strikethrough|line[-_ ]through|msrp|rrp|compare|saving|discount|installment|monthly|shipping|delivery|tax|total|subtotal)/i;

  function struckOrNoisy(el) {
    if (!el) return false;
    if (el.closest && el.closest("del, s, strike")) return true;
    for (var node = el, depth = 0; node && node.nodeType === 1 && depth < 3; node = node.parentElement, depth += 1) {
      var marks = [
        typeof node.className === "string" ? node.className : "",
        node.id || "",
        (node.getAttribute && node.getAttribute("data-testid")) || "",
        (node.getAttribute && node.getAttribute("aria-label")) || "",
      ];
      for (var index = 0; index < marks.length; index += 1) {
        if (marks[index] && PRICE_NOISE.test(marks[index])) return true;
      }
      try {
        var style = global.getComputedStyle(node);
        if (/line-through/.test(String(style.textDecorationLine || style.textDecoration || ""))) return true;
      } catch (_error) {
        /* a style this page will not share is not proof either way */
      }
    }
    return false;
  }

  // Ordered from the most authoritative figure to the most generic, so the
  // buy-box price wins over a "related items" price that happens to come first
  // in the document.
  var PRICE_SELECTORS = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
    '[itemprop="price"]',
    '[data-testid="product-price"]',
    '[data-testid="price-value"]',
    '[data-automation="product-price"]',
    "#corePrice_feature_div .a-offscreen",
    "#corePriceDisplay_desktop_feature_div .a-offscreen",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    ".priceToPay",
    ".a-price .a-offscreen",
    '[class*="current-price" i]',
    '[class*="sale-price" i]',
    '[class*="product-price" i]',
  ];

  function priceFromDom() {
    for (var index = 0; index < PRICE_SELECTORS.length; index += 1) {
      var elements;
      try {
        elements = document.querySelectorAll(PRICE_SELECTORS[index]);
      } catch (_error) {
        continue;
      }
      for (var node = 0; node < elements.length && node < 24; node += 1) {
        var el = elements[node];
        if (el.tagName === "META") {
          var content = el.getAttribute("content");
          var cents = toCents(content);
          if (cents) return { price: cents, currency: metaContent("product:price:currency") || currencyIn(content) };
          continue;
        }
        if (!rendered(el) || struckOrNoisy(el)) continue;
        var raw = el.getAttribute("content") || el.getAttribute("value") || textOf(el);
        var value = toCents(raw);
        if (value) {
          return {
            price: value,
            currency: metaContent("product:price:currency") || currencyIn(raw),
          };
        }
      }
    }
    return {};
  }

  function productKey() {
    var canonical = document.querySelector('link[rel="canonical"]');
    var href = (canonical && canonical.getAttribute("href")) || metaContent("og:url") || location.href;
    try {
      var url = new URL(href, location.href);
      // Amazon ASINs are stable across locale domains and tracking params.
      var asin = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
      if (asin) return "asin:" + asin[1].toUpperCase();
      return url.origin + url.pathname.replace(/\/+$/, "");
    } catch (_error) {
      return null;
    }
  }

  function looksLikeProductPage() {
    if (/product/i.test(metaContent("og:type") || "")) return true;
    if (metaContent("product:price:amount")) return true;
    if (jsonLdProduct()) return true;
    if (document.querySelector('[itemtype*="schema.org/Product" i]')) return true;
    return /\/(dp|gp\/product|ip|p|pd|product|products|item|items|sku)\/[^/]+/i.test(location.pathname);
  }

  function readProduct() {
    if (!looksLikeProductPage()) return null;
    var ld = jsonLdProduct();
    var fromLd = offerPrice(ld && ld.offers);
    var fromDom = priceFromDom();
    var price = fromLd.price || fromDom.price || null;
    if (!price) return null;
    var key = productKey();
    if (!key) return null;
    return {
      key: key,
      title: String((ld && ld.name) || metaContent("og:title") || document.title || "").slice(0, 120),
      price: price,
      currency: fromLd.currency || fromDom.currency || "USD",
    };
  }

  global.PageScan = {
    codes: scanCodes,
    clipOffers: scanClipOffers,
    clipAll: clipOffers,
    product: readProduct,
  };
})(window);
