// The deals feed: partner-platform offers, each paired automatically with a
// popular product that already meets the offer's terms. The shopper is offered
// the product, not the fine print — the pairing is what makes them eligible.
//
// Two rules shape this data:
//
//   1. No saving is invented. A row carries a `percent` only when the store
//      publishes it as a standing rate (its own card, its own subscription
//      program). A program with no fixed number carries none, and the card then
//      describes the program instead of inventing a figure.
//   2. The bar is enforced, not advertised. `minSpend` decides which product a
//      row may be paired with; it never appears in the copy the shopper reads
//      (see offerLines), because the product beside it already clears it. The
//      price in the card is the price that qualifies.
import { money } from "./format.js";

export const DEALS_VERSION = 1;
export const DEALS_UPDATED = "2026-11-12";

const deal = (id, store, label, category, note, extra) =>
  Object.assign({ id, store, label, category, note, minSpend: 0, percent: null, ends: null }, extra);

const product = (id, store, name, category, price, popularity, q) => ({
  id,
  store,
  name,
  category,
  price,
  popularity,
  q,
});

// Popular products, per store, with the list price in minor units and a search
// term the store's own search understands. `popularity` is only a ranking
// weight: it decides which qualifying product is offered first.
export const POPULAR_PRODUCTS = [
  // Laptops
  product("p-macbook-air-walmart", "walmart", "Apple MacBook Air 13-inch (M4)", "laptop", 99900, 97, "MacBook Air M4"),
  product("p-macbook-pro-walmart", "walmart", "Apple MacBook Pro 14-inch (M4 Pro)", "laptop", 199900, 90, "MacBook Pro 14 M4 Pro"),
  product("p-macbook-air-bestbuy", "bestbuy", "Apple MacBook Air 13-inch (M4)", "laptop", 99900, 96, "MacBook Air M4"),
  product("p-xps13-bestbuy", "bestbuy", "Dell XPS 13", "laptop", 119900, 78, "Dell XPS 13"),
  product("p-macbook-air-amazon", "amazon", "Apple MacBook Air 13-inch (M4)", "laptop", 99400, 98, "MacBook Air M4"),
  product("p-macbook-pro-apple", "apple", "MacBook Pro 14-inch (M4 Pro)", "laptop", 199900, 94, "MacBook Pro 14"),
  product("p-macbook-air-apple", "apple", "MacBook Air 13-inch (M4)", "laptop", 99900, 92, "MacBook Air 13"),
  product("p-xps14-dell", "dell", "Dell XPS 14", "laptop", 149900, 74, "XPS 14"),
  product("p-macbook-pro-costco", "costco", "Apple MacBook Pro 14-inch (M4)", "laptop", 159900, 85, "MacBook Pro 14"),

  // Phones and tablets
  product("p-ipad-air-target", "target", "Apple iPad Air 11-inch (M3)", "tablet", 59900, 92, "iPad Air 11"),
  product("p-iphone17-walmart", "walmart", "Apple iPhone 17", "phone", 79900, 93, "iPhone 17"),
  product("p-iphone17pro-apple", "apple", "iPhone 17 Pro", "phone", 109900, 95, "iPhone 17 Pro"),
  product("p-s26-samsung", "samsung", "Galaxy S26 Ultra", "phone", 129900, 88, "Galaxy S26 Ultra"),
  product("p-pixel10-bestbuy", "bestbuy", "Google Pixel 10 Pro", "phone", 99900, 80, "Pixel 10 Pro"),

  // TVs
  product("p-oled55-bestbuy", "bestbuy", "LG C5 55-inch OLED", "tv", 129900, 89, "LG C5 55 OLED"),
  product("p-qled65-walmart", "walmart", "Samsung 65-inch QLED", "tv", 89700, 84, "Samsung 65 QLED"),
  product("p-bravia-costco", "costco", "Sony Bravia 7 65-inch", "tv", 139900, 76, "Sony Bravia 7 65"),
  product("p-tcl55-target", "target", "TCL 55-inch QM6", "tv", 59900, 70, "TCL QM6 55"),

  // Audio
  product("p-xm6-bestbuy", "bestbuy", "Sony WH-1000XM6", "audio", 44900, 91, "Sony WH-1000XM6"),
  product("p-airpods-amazon", "amazon", "Apple AirPods Pro 3", "audio", 24900, 95, "AirPods Pro 3"),
  product("p-wf-sony", "sony", "Sony WF-1000XM6", "audio", 29900, 72, "Sony WF-1000XM6"),
  product("p-bose-quietcomfort", "bose", "Bose QuietComfort Ultra", "audio", 42900, 74, "Bose QuietComfort Ultra"),

  // Kitchen
  product("p-mixer-target", "target", "KitchenAid Artisan 5-quart mixer", "kitchen", 44900, 82, "KitchenAid Artisan mixer"),
  product("p-mixer-kitchenaid", "kitchenaid", "KitchenAid Artisan 5-quart mixer", "kitchen", 44900, 66, "Artisan 5-quart mixer"),
  product("p-vitamix-williamssonoma", "williamssonoma", "Vitamix 5200 blender", "kitchen", 54900, 68, "Vitamix 5200"),
  product("p-creami-costco", "costco", "Ninja Creami", "kitchen", 19900, 79, "Ninja Creami"),
  product("p-instantpot-amazon", "amazon", "Instant Pot Duo 6-quart", "kitchen", 8900, 86, "Instant Pot Duo 6 quart"),

  // Home, tools and appliances
  product("p-dyson15-bestbuy", "bestbuy", "Dyson V15 Detect", "home", 74900, 77, "Dyson V15 Detect"),
  product("p-shark-walmart", "walmart", "Shark Navigator upright", "home", 19900, 71, "Shark Navigator"),
  product("p-dewalt-homedepot", "homedepot", "DeWalt 20V drill kit", "home", 17900, 84, "DeWalt 20V drill kit"),

  // Beauty
  product("p-airwrap-sephora", "sephora", "Dyson Airwrap", "beauty", 59900, 88, "Dyson Airwrap"),
  product("p-airwrap-ulta", "ulta", "Dyson Airwrap", "beauty", 59900, 80, "Dyson Airwrap"),

  // Shoes
  product("p-af1-nike", "nike", "Nike Air Force 1 '07", "shoes", 11500, 90, "Air Force 1"),
  product("p-samba-adidas", "adidas", "adidas Samba OG", "shoes", 10000, 87, "Samba OG"),

  // Furniture
  product("p-poang-ikea", "ikea", "IKEA POÄNG armchair", "furniture", 24900, 65, "POÄNG armchair"),

  // Pet
  product("p-proplan-chewy", "chewy", "Purina Pro Plan 30-lb", "pet", 6899, 75, "Purina Pro Plan 30 lb"),
];

// The partner offers. `category` narrows a row to one kind of product; a row
// with no category applies to anything that clears its bar. `note` is the whole
// of what the shopper reads about the offer, so it never states a threshold and
// never promises a figure the store has not published.
export const PARTNER_DEALS = [
  deal(
    "walmart-laptops",
    "walmart",
    "Laptop deals",
    "laptop",
    "In Walmart's current laptop deals, so the offer applies in the cart."
  ),
  deal("walmart-shipping", "walmart", "Free shipping", null, "Ships free at Walmart's own free-shipping bar.", { minSpend: 3500 }),
  deal("walmart-tv", "walmart", "TV rollbacks", "tv", "Sitting in Walmart's current TV rollbacks."),

  deal(
    "bestbuy-openbox-laptops",
    "bestbuy",
    "Open-box laptops",
    "laptop",
    "Best Buy's open-box stock on this model sits under the new price."
  ),
  deal("bestbuy-shipping", "bestbuy", "Free shipping", null, "Ships free at Best Buy's own free-shipping bar.", { minSpend: 3500 }),

  deal(
    "target-redcard",
    "target",
    "RedCard 5%",
    null,
    "RedCard holders take another 5% off at checkout, and the card has no fee.",
    { percent: 5 }
  ),
  deal("target-shipping", "target", "Free shipping", null, "Ships free at Target's own free-shipping bar.", { minSpend: 3500 }),

  deal("amazon-renewed", "amazon", "Renewed laptops", "laptop", "Amazon Renewed lists this model below its new price."),
  deal("apple-refurbished", "apple", "Certified refurbished", "laptop", "Apple's refurbished stock carries the same one-year warranty."),
  deal("dell-outlet", "dell", "Dell Outlet", "laptop", "Dell Outlet lists returned and refurbished machines here."),
  deal("costco-member", "costco", "Member savings", "tv", "Costco instant savings on this set come off at the register."),

  deal("sephora-insider", "sephora", "Beauty Insider offers", "beauty", "Beauty Insider points and member sets apply on this order."),
  deal("ulta-rewards", "ulta", "Ultamate Rewards", "beauty", "Ultamate Rewards points apply on this order."),

  deal("nike-clearance", "nike", "Nike clearance", "shoes", "Nike clearance pricing applies on selected pairs."),
  deal("adidas-outlet", "adidas", "adidas Outlet", "shoes", "adidas Outlet pricing applies on past-season pairs."),

  deal("homedepot-pro", "homedepot", "Pro pricing", "home", "A pro account can lower the unit price on this tool."),
  deal("ikea-family", "ikea", "IKEA Family offers", "furniture", "IKEA Family member pricing applies on selected pieces."),
  deal("kitchenaid-refurbished", "kitchenaid", "Refurbished", "kitchen", "Factory-refurbished mixers keep KitchenAid's warranty."),

  deal(
    "chewy-autoship",
    "chewy",
    "Autoship 5%",
    "pet",
    "Autoship takes 5% off every repeat delivery, and the first one arrives sooner.",
    { percent: 5 }
  ),
  deal("bose-refurbished", "bose", "Certified refurbished", "audio", "Factory-renewed audio keeps the same warranty as new."),
];

// The store's own search for that product. Nothing else is fetched from the
// panel: a tap hands the shopper to the store it names.
const SEARCH = {
  walmart: "https://www.walmart.com/search?q={q}",
  target: "https://www.target.com/s?searchTerm={q}",
  bestbuy: "https://www.bestbuy.com/site/searchpage.jsp?st={q}",
  amazon: "https://www.amazon.com/s?k={q}",
  apple: "https://www.apple.com/shop/buy-mac",
  dell: "https://www.dell.com/en-us/search/{q}",
  costco: "https://www.costco.com/CatalogSearch?dept=All&keyword={q}",
  samsung: "https://www.samsung.com/us/search/searchMain/?listType=g&searchTerm={q}",
  sony: "https://electronics.sony.com/search?q={q}",
  bose: "https://www.bose.com/search?q={q}",
  sephora: "https://www.sephora.com/search?keyword={q}",
  ulta: "https://www.ulta.com/search?search={q}",
  nike: "https://www.nike.com/w?q={q}",
  adidas: "https://www.adidas.com/us/search?q={q}",
  homedepot: "https://www.homedepot.com/s/{q}",
  ikea: "https://www.ikea.com/us/en/search/?q={q}",
  kitchenaid: "https://www.kitchenaid.com/search?q={q}",
  williamssonoma: "https://www.williams-sonoma.com/search/results.html?words={q}",
  chewy: "https://www.chewy.com/s?query={q}",
};

export function productUrl(item) {
  const template = SEARCH[item.store];
  if (!template) return "";
  return template.replace("{q}", encodeURIComponent(item.q || item.name));
}

// Whether a product clears everything a deal asks for. The store has to be the
// same one, the category has to match when the deal names one, and the price
// has to reach the bar.
export function qualifies(item, offer) {
  if (!item || !offer) return false;
  if (item.store !== offer.store) return false;
  if (offer.category && item.category !== offer.category) return false;
  return Number(item.price) >= Number(offer.minSpend || 0);
}

export function expired(offer, now) {
  if (!offer || !offer.ends) return false;
  const ends = Date.parse(offer.ends);
  return Number.isFinite(ends) && ends <= now;
}

// A published rate becomes a figure; a program without one becomes no figure at
// all, rather than a guess.
export function offerFor(offer, item) {
  const rate = Number(offer.percent);
  const savings = Number.isFinite(rate) && rate > 0 ? Math.round((item.price * rate) / 100) : null;
  return {
    id: offer.id + ":" + item.id,
    deal: offer,
    product: item,
    price: item.price,
    savings,
    pay: savings == null ? null : item.price - savings,
  };
}

// The feed itself: for each live deal, the most popular product at that store
// that clears it, and no product offered twice. Ranked by the biggest published
// saving first, then by how popular the product is.
export function matchDeals(deals = PARTNER_DEALS, products = POPULAR_PRODUCTS, now = Date.now()) {
  const used = new Set();
  const offers = [];
  deals.forEach((offer) => {
    if (!offer || !offer.store || expired(offer, now)) return;
    const paired = products
      .filter((item) => qualifies(item, offer))
      .sort((a, b) => b.popularity - a.popularity || a.price - b.price)
      .find((item) => !used.has(item.id));
    if (!paired) return;
    used.add(paired.id);
    offers.push(offerFor(offer, paired));
  });
  return offers.sort(
    (a, b) => (b.savings || 0) - (a.savings || 0) || b.product.popularity - a.product.popularity
  );
}

// What the card prints. The threshold is deliberately absent: the product named
// here is the thing that clears it, so restating the bar would only invite the
// shopper to go around the extension to meet it themselves.
export function offerLines(offer) {
  return {
    store: offer.deal.store,
    label: offer.deal.label,
    title: offer.product.name,
    price: money(offer.price),
    savings: offer.savings == null ? null : money(offer.savings),
    note: offer.deal.note,
    terms: "Store terms apply at checkout.",
  };
}
