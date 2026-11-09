// Deciding whether the page the shopper is on is a shop we can cover. The only
// inputs are what the page itself declares (see src/content/site-detect.js), so
// a site is added on evidence, never on a hostname guess — and a page that does
// not prove it is a shop is removed instead of waiting in a review queue.

export const ADDED_CATEGORY = "Added by you";
const MIN_EVIDENCE = 3;

const PLATFORM_LABELS = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  bigcommerce: "BigCommerce",
  magento: "Magento",
  prestashop: "PrestaShop",
  squarespace: "Squarespace",
  shopware: "Shopware",
};

export function platformLabel(id) {
  return PLATFORM_LABELS[id] || String(id || "");
}

export function decideSite(detection, host) {
  const d = detection || {};
  const structured = d.structured || {};
  const evidence = [];
  let score = 0;

  if (structured.store) {
    score += 2;
    evidence.push("store markup");
  }
  if (structured.product) {
    score += 2;
    evidence.push("product markup");
  }
  if (d.platform) {
    score += 2;
    evidence.push(platformLabel(d.platform));
  }
  if (d.cart) {
    score += 1;
    evidence.push("cart");
  }
  if (d.checkout) {
    score += 1;
    evidence.push("checkout");
  }
  if (d.addToCart) {
    score += 1;
    evidence.push("add to cart");
  }
  if (String(d.ogType || "").toLowerCase() === "product") {
    score += 1;
    evidence.push("product page");
  }

  // Trusted means the page names itself as a shop: schema.org store markup, a
  // known storefront platform, a product with a real offer behind it, or a
  // working add-to-cart next to a cart. A lone cart link on a blog is not enough.
  const trusted = Boolean(
    structured.store ||
      d.platform ||
      (structured.product && (structured.offer || d.addToCart)) ||
      (d.addToCart && d.cart)
  );

  if (trusted && score >= MIN_EVIDENCE) {
    return {
      add: true,
      name: clean(d.name) || String(host || ""),
      category: ADDED_CATEGORY,
      evidence,
      reason: "Confirmed as a shop from its own " + evidence.join(", ") + " data.",
    };
  }

  return {
    add: false,
    name: null,
    category: null,
    evidence,
    reason: evidence.length
      ? "Not enough storefront data (" + evidence.join(", ") + ") to cover this site."
      : "No storefront data on this page — no store or product markup, no shop platform and no cart.",
  };
}

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
