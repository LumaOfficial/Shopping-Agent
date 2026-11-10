// The marks the Animate trailer leads with.
//
// Curated by hand rather than read from the catalog: the show is about the
// storefronts a shopper recognises at a glance, not every merchant Savings
// covers. `ink` is the brand's own colour — it tints the tile's glow and the
// lettering, so a mark that fails to load still reads as that brand.
export const BRAND_MARKS = [
  { id: "amazon", name: "Amazon", host: "amazon.com", ink: "#ff9900" },
  { id: "walmart", name: "Walmart", host: "walmart.com", ink: "#0071ce" },
  { id: "target", name: "Target", host: "target.com", ink: "#cc0000" },
  { id: "apple", name: "Apple", host: "apple.com", ink: "#1d1d1f" },
  { id: "bestbuy", name: "Best Buy", host: "bestbuy.com", ink: "#0046be" },
  { id: "ikea", name: "IKEA", host: "ikea.com", ink: "#0058a3" },
  { id: "costco", name: "Costco", host: "costco.com", ink: "#e31837" },
  { id: "ebay", name: "eBay", host: "ebay.com", ink: "#0064d2" },
  { id: "etsy", name: "Etsy", host: "etsy.com", ink: "#f1641e" },
  { id: "nike", name: "Nike", host: "nike.com", ink: "#111111" },
  { id: "adidas", name: "adidas", host: "adidas.com", ink: "#111111" },
  { id: "sephora", name: "Sephora", host: "sephora.com", ink: "#111111" },
  { id: "ulta", name: "Ulta Beauty", host: "ulta.com", ink: "#f26b21" },
  { id: "homedepot", name: "Home Depot", host: "homedepot.com", ink: "#f96302" },
  { id: "lowes", name: "Lowe's", host: "lowes.com", ink: "#004990" },
  { id: "wayfair", name: "Wayfair", host: "wayfair.com", ink: "#7f187f" },
  { id: "chewy", name: "Chewy", host: "chewy.com", ink: "#1c49c2" },
  { id: "newegg", name: "Newegg", host: "newegg.com", ink: "#e94e1b" },
  { id: "nordstrom", name: "Nordstrom", host: "nordstrom.com", ink: "#111111" },
  { id: "macys", name: "Macy's", host: "macys.com", ink: "#e21a2c" },
  { id: "zara", name: "Zara", host: "zara.com", ink: "#111111" },
  { id: "hm", name: "H&M", host: "hm.com", ink: "#e50010" },
  { id: "uniqlo", name: "Uniqlo", host: "uniqlo.com", ink: "#ff0000" },
  { id: "samsung", name: "Samsung", host: "samsung.com", ink: "#1428a0" },
  { id: "dell", name: "Dell", host: "dell.com", ink: "#007db8" },
  { id: "sony", name: "Sony", host: "sony.com", ink: "#111111" },
  { id: "microsoft", name: "Microsoft", host: "microsoft.com", ink: "#00a4ef" },
  { id: "starbucks", name: "Starbucks", host: "starbucks.com", ink: "#006241" },
  { id: "airbnb", name: "Airbnb", host: "airbnb.com", ink: "#ff5a5f" },
  { id: "booking", name: "Booking.com", host: "booking.com", ink: "#003580" },
  { id: "expedia", name: "Expedia", host: "expedia.com", ink: "#00355f" },
  { id: "shein", name: "SHEIN", host: "shein.com", ink: "#111111" },
  { id: "lululemon", name: "lululemon", host: "lululemon.com", ink: "#c8102e" },
  { id: "gap", name: "Gap", host: "gap.com", ink: "#003087" },
  { id: "coach", name: "Coach", host: "coach.com", ink: "#111111" },
  { id: "puma", name: "PUMA", host: "puma.com", ink: "#111111" },
  { id: "underarmour", name: "Under Armour", host: "underarmour.com", ink: "#111111" },
  { id: "victoriassecret", name: "Victoria's Secret", host: "victoriassecret.com", ink: "#e5007d" },
  { id: "bathandbodyworks", name: "Bath & Body Works", host: "bathandbodyworks.com", ink: "#003da5" },
  { id: "cvs", name: "CVS", host: "cvs.com", ink: "#cc0000" },
  { id: "walgreens", name: "Walgreens", host: "walgreens.com", ink: "#e31837" },
  { id: "staples", name: "Staples", host: "staples.com", ink: "#cc0000" },
  { id: "petco", name: "Petco", host: "petco.com", ink: "#001489" },
  { id: "levis", name: "Levi's", host: "levi.com", ink: "#c8102e" },
  { id: "vans", name: "Vans", host: "vans.com", ink: "#111111" },
  { id: "converse", name: "Converse", host: "converse.com", ink: "#111111" },
  { id: "rei", name: "REI", host: "rei.com", ink: "#36622b" },
  { id: "doordash", name: "DoorDash", host: "doordash.com", ink: "#ff3008" },
  { id: "instacart", name: "Instacart", host: "instacart.com", ink: "#43b02a" },
];

export function initials(name) {
  return name
    .replace(/[^A-Za-z0-9& ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// One mark, at a size big enough to read on a dark stage. The tiles render it
// small, so the browser cache is what keeps the show free of pop-in.
export function markUrl(host) {
  return "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=128";
}
