// Merchant catalog. A store is supported when its host matches one of these
// entries; the content script never runs anywhere else.
export const STORES = [
  { id: "amazon", name: "Amazon", host: "amazon.com", category: "Marketplace" },
  { id: "target", name: "Target", host: "target.com", category: "General" },
  { id: "walmart", name: "Walmart", host: "walmart.com", category: "General" },
  { id: "bestbuy", name: "Best Buy", host: "bestbuy.com", category: "Electronics" },
  { id: "homedepot", name: "Home Depot", host: "homedepot.com", category: "Home" },
  { id: "lowes", name: "Lowe's", host: "lowes.com", category: "Home" },
  { id: "macys", name: "Macy's", host: "macys.com", category: "Fashion" },
  { id: "nordstrom", name: "Nordstrom", host: "nordstrom.com", category: "Fashion" },
  { id: "sephora", name: "Sephora", host: "sephora.com", category: "Beauty" },
  { id: "chewy", name: "Chewy", host: "chewy.com", category: "Pets" },
  { id: "wayfair", name: "Wayfair", host: "wayfair.com", category: "Home" },
  { id: "nike", name: "Nike", host: "nike.com", category: "Fashion" },
  { id: "adidas", name: "adidas", host: "adidas.com", category: "Fashion" },
  { id: "ikea", name: "IKEA", host: "ikea.com", category: "Home" },
  { id: "expedia", name: "Expedia", host: "expedia.com", category: "Travel" },
  { id: "etsy", name: "Etsy", host: "etsy.com", category: "Marketplace" },
  { id: "ebay", name: "eBay", host: "ebay.com", category: "Marketplace" },
  { id: "booking", name: "Booking.com", host: "booking.com", category: "Travel" },
];

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function resolveStore(url) {
  const host = hostOf(url);
  if (!host) return null;
  return (
    STORES.find((store) => host === store.host || host.endsWith(`.${store.host}`)) || null
  );
}

export function matchesHost(matchPattern, url) {
  const host = hostOf(url);
  if (!host) return false;
  const wanted = matchPattern.replace(/^\*:\/\//, "").replace(/^\./, "").replace(/\/\*$/, "");
  return host === wanted || host.endsWith(`.${wanted}`);
}
