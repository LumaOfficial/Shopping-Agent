// What this page says about itself as a shop. Read from the page alone: its
// schema.org markup, the storefront platform it runs on, and real cart or
// checkout controls. This is the evidence the panel adds a site on — nothing is
// inferred from the hostname. Injected by the service worker with
// chrome.scripting.executeScript on a page the shopper has allowed.
(function (global) {
  "use strict";

  var STORE_TYPES = [
    "store",
    "onlinestore",
    "retailstore",
    "departmentstore",
    "grocery_store",
    "grocerystore",
    "hardwarestore",
    "electronicsstore",
    "clothingstore",
    "shoestore",
    "bookstore",
    "petstore",
    "sportinggoodsstore",
    "furniturestore",
    "jewelrystore",
    "toystore",
    "homestore",
  ];
  var PRODUCT_TYPES = ["product", "productgroup", "individualproduct", "productmodel"];
  var OFFER_TYPES = ["offer", "aggregateoffer"];

  var PLATFORMS = [
    {
      id: "shopify",
      test: function () {
        return Boolean(global.Shopify) || Boolean(document.querySelector('script[src*="cdn.shopify.com"], script[src*="shopifycloud"], link[href*="cdn.shopify.com"]'));
      },
    },
    {
      id: "woocommerce",
      test: function () {
        var body = document.body;
        return (
          Boolean(body && /\bwoocommerce\b/.test(body.className || "")) ||
          Boolean(document.querySelector('script[src*="woocommerce"], link[href*="woocommerce"]'))
        );
      },
    },
    {
      id: "bigcommerce",
      test: function () {
        return Boolean(document.querySelector('script[src*="bigcommerce"], script[src*="mybigcommerce"]'));
      },
    },
    {
      id: "magento",
      test: function () {
        return Boolean(document.querySelector('script[src*="/mage/"], script[type="text/x-magento-init"]'));
      },
    },
    {
      id: "prestashop",
      test: function () {
        return Boolean(document.querySelector('script[src*="prestashop"], link[href*="prestashop"]')) || /prestashop/i.test(meta('meta[name="generator"]'));
      },
    },
    {
      id: "squarespace",
      test: function () {
        return Boolean(document.querySelector('script[src*="squarespace"], link[href*="squarespace"]'));
      },
    },
    {
      id: "shopware",
      test: function () {
        return Boolean(document.querySelector('script[src*="shopware"]'));
      },
    },
  ];

  var CART_RE = /(^|\/)(cart|basket|bag|shopping-cart|my-cart)(\/|$|\?|#)/i;
  var CHECKOUT_RE = /(^|\/)(checkout|check-out)(\/|$|\?|#)/i;
  var ADD_RE = /add\s*(to|)(cart|bag|basket)|add to bag|add to cart/i;

  function clean(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  function meta(selector) {
    var el = document.querySelector(selector);
    return el ? clean(el.getAttribute("content") || "") : "";
  }

  function isVisible(el) {
    if (!el || !el.getClientRects) return false;
    return el.getClientRects().length > 0;
  }

  // JSON-LD blocks, flattened through @graph and lists so nested shops and
  // products are still found.
  function nodes() {
    var out = [];
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var index = 0; index < scripts.length && index < 40; index += 1) {
      var queue;
      try {
        queue = [JSON.parse(scripts[index].textContent || "{}")];
      } catch (_error) {
        continue; // an unreadable block is not evidence
      }
      var budget = 300;
      while (queue.length && budget > 0) {
        budget -= 1;
        var node = queue.shift();
        if (!node) continue;
        if (Array.isArray(node)) {
          queue.push.apply(queue, node);
          continue;
        }
        if (typeof node !== "object") continue;
        out.push(node);
        if (node["@graph"]) queue.push(node["@graph"]);
        if (node.itemListElement) queue.push(node.itemListElement);
        if (node.mainEntity) queue.push(node.mainEntity);
      }
    }
    return out;
  }

  function typesOf(node) {
    var type = node && node["@type"];
    if (!type) return [];
    return (Array.isArray(type) ? type : [type]).map(function (value) {
      return String(value).toLowerCase().replace(/^schema:/, "").split("/").pop();
    });
  }

  function firstOfType(list, types) {
    for (var index = 0; index < list.length; index += 1) {
      var found = typesOf(list[index]).some(function (value) {
        return types.indexOf(value) !== -1;
      });
      if (found) return list[index];
    }
    return null;
  }

  function nameOf(node) {
    var name = node && node.name;
    if (name && typeof name === "object") name = name.name || name["@value"];
    return clean(name);
  }

  function platform() {
    for (var index = 0; index < PLATFORMS.length; index += 1) {
      try {
        if (PLATFORMS[index].test()) return PLATFORMS[index].id;
      } catch (_error) {
        // A blocked global is not proof either way.
      }
    }
    return null;
  }

  function hasLink(pattern) {
    var anchors = document.querySelectorAll("a[href]");
    for (var index = 0; index < anchors.length && index < 1500; index += 1) {
      if (!pattern.test(anchors[index].getAttribute("href") || "")) continue;
      if (isVisible(anchors[index])) return true;
    }
    return false;
  }

  function hasAddToCart() {
    if (document.querySelector('form[action*="/cart/add"], [data-add-to-cart]')) return true;
    var buttons = document.querySelectorAll('button, input[type="submit"], a[role="button"]');
    for (var index = 0; index < buttons.length && index < 400; index += 1) {
      var label = clean(buttons[index].innerText || buttons[index].value || buttons[index].getAttribute("aria-label"));
      if (ADD_RE.test(label) && isVisible(buttons[index])) return true;
    }
    return false;
  }

  function titleName() {
    return clean(String(document.title || "").split(/\s[|–—-]\s/)[0]);
  }

  function scan() {
    var list = nodes();
    var store = firstOfType(list, STORE_TYPES);
    var product = firstOfType(list, PRODUCT_TYPES);
    var offer = (product && product.offers) || firstOfType(list, OFFER_TYPES);
    var name = nameOf(store) || meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]') || titleName();

    return {
      url: location.href,
      title: clean(document.title),
      name: name,
      platform: platform(),
      structured: {
        store: Boolean(store),
        product: Boolean(product),
        offer: Boolean(offer),
      },
      ogType: meta('meta[property="og:type"]').toLowerCase(),
      cart: hasLink(CART_RE),
      checkout: hasLink(CHECKOUT_RE),
      addToCart: hasAddToCart(),
    };
  }

  global.SiteDetect = { scan: scan };
})(window);
