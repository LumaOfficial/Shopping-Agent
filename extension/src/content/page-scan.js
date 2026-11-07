// Classic content script (loads before content.js). Exposes window.PageScan:
//  - codes the shop publishes on the page the shopper is actually looking at
//  - "clip coupon" style offers the store exposes as a real control
//  - the product and price on a product page, for local price tracking
// Everything here is read from the live page. Nothing is invented.
(function (global) {
  "use strict";

  var CODE_CONTEXT_RE =
    /(?:promo|coupon|voucher|discount|offer|referral|invite|redeem)\s*(?:code)?\s*(?:is|:|-|\u2013|\u2014)?\s*["'\u201c\u201d]?([A-Za-z0-9][A-Za-z0-9._-]{3,23})\b/g;

  var STOPWORDS = [
    "CODE", "CODES", "COUPON", "COUPONS", "DISCOUNT", "PROMO", "PROMOS", "VOUCHER", "OFFER",
    "OFFERS", "APPLIED", "APPLY", "CHECKOUT", "CART", "SHIPPING", "SALE", "SAVINGS", "SAVE",
    "PRICE", "ORDER", "ONLINE", "STORE", "FREE", "SHOP", "TOTAL", "SUBTOTAL", "TAX", "NOW",
    "MORE", "HERE", "TERMS", "DETAILS", "SELECT", "REQUIRED", "VALID", "EXPIRED", "AND", "THE",
    "THIS", "THAT", "YOUR", "FROM", "WITH", "HTML", "HTTPS", "HTTP", "WWW", "USD", "EUR", "GBP",
  ];

  var CLIP_RE = /(clip\s*(?:this\s*|the\s*)?coupon|clip\s*(?:&|and)\s*save|clip\s*offer|clip\s*deal|clip\s*coupon|apply\s*coupon|clip\s*for|save\s*\$)/i;

  var clipTargets = [];

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    var style = global.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 10 && rect.height > 4;
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
  function plausibleCode(rawToken, rawContext) {
    var token = String(rawToken || "").trim();
    if (!/^[A-Z0-9][A-Z0-9._-]{3,23}$/.test(token)) return null;
    if (STOPWORDS.indexOf(token) !== -1) return null;
    if (/^\d+$/.test(token)) return null;
    var hasDigit = /[0-9]/.test(token);
    var hasSeparator = /[._-]/.test(token);
    if (!hasDigit && !hasSeparator && token.length < 6) return null;
    var context = String(rawContext || "").replace(/\s+/g, " ").trim().slice(0, 140);
    return { code: token, title: context || null, source: "page" };
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
        if (text.length < 8 || text.length > 600) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var node;
    while (budget > 0 && (node = walker.nextNode())) {
      budget -= 1;
      var text = node.nodeValue;
      CODE_CONTEXT_RE.lastIndex = 0;
      var match;
      while ((match = CODE_CONTEXT_RE.exec(text))) {
        // The token must be upper-case on the page; a lower-case word after
        // "code is" is prose, not a code.
        var raw = match[1];
        if (raw !== raw.toUpperCase()) continue;
        var candidate = plausibleCode(raw, text);
        if (candidate && !seen[candidate.code]) {
          seen[candidate.code] = true;
          found.push(candidate);
        }
      }
      if (found.length >= 10) break;
    }
    return found;
  }

  function codesFromAttributes() {
    var found = [];
    queryAll("[data-coupon-code], [data-promo-code], [data-discount-code]").forEach(function (el) {
      if (!isVisible(el)) return;
      var value = el.getAttribute("data-coupon-code") || el.getAttribute("data-promo-code") || el.getAttribute("data-discount-code");
      var candidate = plausibleCode(String(value || "").toUpperCase(), textOf(el));
      if (candidate) found.push(candidate);
    });
    return found;
  }

  function scanCodes() {
    var all = codesFromAttributes().concat(codesFromText());
    var seen = {};
    return all
      .filter(function (item) {
        if (!item || seen[item.code]) return false;
        seen[item.code] = true;
        return true;
      })
      .slice(0, 8);
  }

  // ---- "clip coupon" controls -------------------------------------------
  function scanClipOffers() {
    var targets = [];
    queryAll('button, [role="button"], label, input[type="checkbox"], [data-testid*="coupon" i], [data-testid*="promotion" i]')
      .forEach(function (el) {
        if (!isVisible(el)) return;
        if (el.tagName === "INPUT" && el.type === "checkbox" && el.checked) return;
        var label = textOf(el);
        var testId = el.getAttribute("data-testid") || "";
        var matches = CLIP_RE.test(label) || (label && /clip/i.test(label) && /coupon|offer|deal|promotion/i.test(label + " " + testId));
        if (!matches) return;
        if (targets.indexOf(el) !== -1) return;
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
      while (queue.length) {
        var node = queue.shift();
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node["@graph"])) queue.push.apply(queue, node["@graph"]);
        var type = node["@type"];
        var types = Array.isArray(type) ? type : [type];
        if (types.some(function (value) { return String(value).toLowerCase() === "product"; })) {
          return node;
        }
      }
    }
    return null;
  }

  function toCents(value) {
    var number = typeof value === "number" ? value : parseFloat(String(value || "").replace(/[^0-9.]/g, ""));
    if (!isFinite(number) || number <= 0) return null;
    return Math.round(number * 100);
  }

  function offerPrice(offers) {
    if (!offers) return {};
    var list = Array.isArray(offers) ? offers : [offers];
    var prices = [];
    var currency = null;
    list.forEach(function (offer) {
      if (!offer || typeof offer !== "object") return;
      if (offer.priceCurrency && !currency) currency = offer.priceCurrency;
      [offer.price, offer.lowPrice, offer.highPrice].forEach(function (value) {
        var cents = toCents(value);
        if (cents) prices.push(cents);
      });
    });
    if (!prices.length) return { currency: currency };
    return { price: Math.min.apply(null, prices), currency: currency };
  }

  function priceFromDom() {
    var selectors = [
      'meta[property="product:price:amount"]',
      'meta[itemprop="price"]',
      '[itemprop="price"]',
      ".a-price .a-offscreen",
      "#corePrice_feature_div .a-offscreen",
      "#corePriceDisplay_desktop_feature_div .a-offscreen",
      '[data-testid="product-price"]',
      '[data-testid*="price" i]',
    ];
    for (var index = 0; index < selectors.length; index += 1) {
      var el = document.querySelector(selectors[index]);
      if (!el) continue;
      if (el.tagName === "META") {
        return { price: toCents(el.getAttribute("content")), currency: metaContent("product:price:currency") };
      }
      var raw = el.getAttribute("content") || el.getAttribute("value") || textOf(el);
      var cents = toCents(raw);
      if (cents) return { price: cents, currency: metaContent("product:price:currency") };
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
    var type = metaContent("og:type") || "";
    if (/product/i.test(type)) return true;
    if (jsonLdProduct()) return true;
    return /\/(dp|gp\/product|ip|product|products|p|item)\//i.test(location.pathname);
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
