// Merchant catalog. A page is a "store" when its host matches one of these
// entries; the content script only listens on those hosts. Keep the
// content_scripts.matches list in manifest.json in sync with this file
// (`node tools/check-catalog.mjs` verifies it).
//
// Sites the shopper explicitly enables from the panel are handled separately by
// resolveStore(url, settings.enabledSites).
export const STORES = [
  // Marketplace & general
  { id: "amazon", name: "Amazon", hosts: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca", "amazon.com.au", "amazon.co.jp", "amazon.fr", "amazon.it", "amazon.es"], category: "Marketplace" },
  { id: "ebay", name: "eBay", hosts: ["ebay.com", "ebay.co.uk", "ebay.de", "ebay.ca", "ebay.com.au"], category: "Marketplace" },
  { id: "etsy", name: "Etsy", host: "etsy.com", category: "Marketplace" },
  { id: "aliexpress", name: "AliExpress", host: "aliexpress.com", category: "Marketplace" },
  { id: "temu", name: "Temu", host: "temu.com", category: "Marketplace" },
  { id: "target", name: "Target", host: "target.com", category: "General" },
  { id: "walmart", name: "Walmart", host: "walmart.com", category: "General" },
  { id: "kohls", name: "Kohl's", host: "kohls.com", category: "General" },
  { id: "jcpenney", name: "JCPenney", host: "jcpenney.com", category: "General" },
  { id: "costco", name: "Costco", host: "costco.com", category: "Warehouse" },
  { id: "samsclub", name: "Sam's Club", host: "samsclub.com", category: "Warehouse" },
  { id: "woot", name: "Woot", host: "woot.com", category: "Marketplace" },
  { id: "zulily", name: "Zulily", host: "zulily.com", category: "Marketplace" },

  // Electronics & devices
  { id: "bestbuy", name: "Best Buy", host: "bestbuy.com", category: "Electronics" },
  { id: "newegg", name: "Newegg", host: "newegg.com", category: "Electronics" },
  { id: "bhphotovideo", name: "B&H Photo", host: "bhphotovideo.com", category: "Electronics" },
  { id: "microcenter", name: "Micro Center", host: "microcenter.com", category: "Electronics" },
  { id: "gamestop", name: "GameStop", host: "gamestop.com", category: "Gaming" },
  { id: "apple", name: "Apple", host: "apple.com", category: "Electronics" },
  { id: "samsung", name: "Samsung", host: "samsung.com", category: "Electronics" },
  { id: "dell", name: "Dell", host: "dell.com", category: "Electronics" },
  { id: "hp", name: "HP", host: "hp.com", category: "Electronics" },
  { id: "lenovo", name: "Lenovo", host: "lenovo.com", category: "Electronics" },
  { id: "logitech", name: "Logitech", host: "logitech.com", category: "Electronics" },
  { id: "amazfit", name: "Amazfit", host: "amazfit.com", category: "Wearables" },
  { id: "garmin", name: "Garmin", host: "garmin.com", category: "Wearables" },

  // Home, furniture & hardware
  { id: "homedepot", name: "Home Depot", host: "homedepot.com", category: "Home" },
  { id: "lowes", name: "Lowe's", host: "lowes.com", category: "Home" },
  { id: "wayfair", name: "Wayfair", host: "wayfair.com", category: "Home" },
  { id: "ikea", name: "IKEA", host: "ikea.com", category: "Home" },
  { id: "westelm", name: "West Elm", host: "westelm.com", category: "Home" },
  { id: "potterybarn", name: "Pottery Barn", host: "potterybarn.com", category: "Home" },
  { id: "williamssonoma", name: "Williams Sonoma", host: "williams-sonoma.com", category: "Home" },
  { id: "crateandbarrel", name: "Crate & Barrel", host: "crateandbarrel.com", category: "Home" },
  { id: "bedbathandbeyond", name: "Bed Bath & Beyond", host: "bedbathandbeyond.com", category: "Home" },
  { id: "overstock", name: "Overstock", host: "overstock.com", category: "Home" },
  { id: "houzz", name: "Houzz", host: "houzz.com", category: "Home" },
  { id: "dyson", name: "Dyson", host: "dyson.com", category: "Home" },
  { id: "nespresso", name: "Nespresso", host: "nespresso.com", category: "Home" },
  { id: "ashleyfurniture", name: "Ashley Furniture", host: "ashleyfurniture.com", category: "Home" },
  { id: "menards", name: "Menards", host: "menards.com", category: "Home" },
  { id: "acehardware", name: "Ace Hardware", host: "acehardware.com", category: "Home" },
  { id: "tractorsupply", name: "Tractor Supply", host: "tractorsupply.com", category: "Home" },
  { id: "brooklinen", name: "Brooklinen", host: "brooklinen.com", category: "Home" },
  { id: "casper", name: "Casper", host: "casper.com", category: "Home" },
  { id: "ruggable", name: "Ruggable", host: "ruggable.com", category: "Home" },

  // Fashion
  { id: "macys", name: "Macy's", host: "macys.com", category: "Fashion" },
  { id: "nordstrom", name: "Nordstrom", host: "nordstrom.com", category: "Fashion" },
  { id: "nordstromrack", name: "Nordstrom Rack", host: "nordstromrack.com", category: "Fashion" },
  { id: "bloomingdales", name: "Bloomingdale's", host: "bloomingdales.com", category: "Fashion" },
  { id: "saks", name: "Saks Fifth Avenue", host: "saks.com", category: "Fashion" },
  { id: "neimanmarcus", name: "Neiman Marcus", host: "neimanmarcus.com", category: "Fashion" },
  { id: "nike", name: "Nike", host: "nike.com", category: "Fashion" },
  { id: "adidas", name: "adidas", host: "adidas.com", category: "Fashion" },
  { id: "lululemon", name: "lululemon", host: "lululemon.com", category: "Fashion" },
  { id: "underarmour", name: "Under Armour", host: "underarmour.com", category: "Fashion" },
  { id: "footlocker", name: "Foot Locker", host: "footlocker.com", category: "Fashion" },
  { id: "gap", name: "Gap", host: "gap.com", category: "Fashion" },
  { id: "oldnavy", name: "Old Navy", host: "oldnavy.com", category: "Fashion" },
  { id: "bananarepublic", name: "Banana Republic", host: "bananarepublic.com", category: "Fashion" },
  { id: "hm", name: "H&M", host: "hm.com", category: "Fashion" },
  { id: "zara", name: "Zara", host: "zara.com", category: "Fashion" },
  { id: "uniqlo", name: "Uniqlo", host: "uniqlo.com", category: "Fashion" },
  { id: "asos", name: "ASOS", host: "asos.com", category: "Fashion" },
  { id: "shein", name: "SHEIN", host: "shein.com", category: "Fashion" },
  { id: "urbanoutfitters", name: "Urban Outfitters", host: "urbanoutfitters.com", category: "Fashion" },
  { id: "anthropologie", name: "Anthropologie", host: "anthropologie.com", category: "Fashion" },
  { id: "freepeople", name: "Free People", host: "freepeople.com", category: "Fashion" },
  { id: "ae", name: "American Eagle", host: "ae.com", category: "Fashion" },
  { id: "abercrombie", name: "Abercrombie & Fitch", host: "abercrombie.com", category: "Fashion" },
  { id: "zappos", name: "Zappos", host: "zappos.com", category: "Fashion" },
  { id: "6pm", name: "6pm", host: "6pm.com", category: "Fashion" },
  { id: "newbalance", name: "New Balance", host: "newbalance.com", category: "Fashion" },
  { id: "puma", name: "PUMA", host: "puma.com", category: "Fashion" },
  { id: "reebok", name: "Reebok", host: "reebok.com", category: "Fashion" },
  { id: "victoriassecret", name: "Victoria's Secret", host: "victoriassecret.com", category: "Fashion" },
  { id: "warbyparker", name: "Warby Parker", host: "warbyparker.com", category: "Fashion" },
  { id: "rayban", name: "Ray-Ban", host: "ray-ban.com", category: "Fashion" },
  { id: "thredup", name: "thredUP", host: "thredup.com", category: "Fashion" },
  { id: "poshmark", name: "Poshmark", host: "poshmark.com", category: "Fashion" },
  { id: "stockx", name: "StockX", host: "stockx.com", category: "Fashion" },

  // Outdoor
  { id: "rei", name: "REI", host: "rei.com", category: "Outdoor" },
  { id: "dickssportinggoods", name: "Dick's Sporting Goods", host: "dickssportinggoods.com", category: "Outdoor" },
  { id: "onepeloton", name: "Peloton", host: "onepeloton.com", category: "Fitness" },
  { id: "backcountry", name: "Backcountry", host: "backcountry.com", category: "Outdoor" },
  { id: "cabelas", name: "Cabela's", host: "cabelas.com", category: "Outdoor" },
  { id: "basspro", name: "Bass Pro Shops", host: "basspro.com", category: "Outdoor" },
  { id: "patagonia", name: "Patagonia", host: "patagonia.com", category: "Outdoor" },
  { id: "thenorthface", name: "The North Face", host: "thenorthface.com", category: "Outdoor" },
  { id: "columbia", name: "Columbia", host: "columbia.com", category: "Outdoor" },

  // Beauty & personal care
  { id: "sephora", name: "Sephora", host: "sephora.com", category: "Beauty" },
  { id: "ulta", name: "Ulta Beauty", host: "ulta.com", category: "Beauty" },
  { id: "glossier", name: "Glossier", host: "glossier.com", category: "Beauty" },
  { id: "bathandbodyworks", name: "Bath & Body Works", host: "bathandbodyworks.com", category: "Beauty" },

  // Pets
  { id: "chewy", name: "Chewy", host: "chewy.com", category: "Pets" },
  { id: "petco", name: "Petco", host: "petco.com", category: "Pets" },
  { id: "petsmart", name: "PetSmart", host: "petsmart.com", category: "Pets" },

  // Grocery, pharmacy & office
  { id: "kroger", name: "Kroger", host: "kroger.com", category: "Grocery" },
  { id: "instacart", name: "Instacart", host: "instacart.com", category: "Grocery" },
  { id: "walgreens", name: "Walgreens", host: "walgreens.com", category: "Pharmacy" },
  { id: "cvs", name: "CVS", host: "cvs.com", category: "Pharmacy" },
  { id: "staples", name: "Staples", host: "staples.com", category: "Office" },
  { id: "officedepot", name: "Office Depot", host: "officedepot.com", category: "Office" },
  { id: "iherb", name: "iHerb", host: "iherb.com", category: "Grocery" },
  { id: "grove", name: "Grove Collaborative", host: "grove.co", category: "Grocery" },
  { id: "thrivemarket", name: "Thrive Market", host: "thrivemarket.com", category: "Grocery" },

  // Books, tools & auto
  { id: "barnesandnoble", name: "Barnes & Noble", host: "barnesandnoble.com", category: "Books" },
  { id: "harborfreight", name: "Harbor Freight", host: "harborfreight.com", category: "Tools" },
  { id: "autozone", name: "AutoZone", host: "autozone.com", category: "Auto" },

  // More electronics & refurbished
  { id: "adorama", name: "Adorama", host: "adorama.com", category: "Electronics" },
  { id: "monoprice", name: "Monoprice", host: "monoprice.com", category: "Electronics" },
  { id: "anker", name: "Anker", host: "anker.com", category: "Electronics" },
  { id: "backmarket", name: "Back Market", host: "backmarket.com", category: "Electronics" },

  // More home
  { id: "cb2", name: "CB2", host: "cb2.com", category: "Home" },
  { id: "article", name: "Article", host: "article.com", category: "Home" },
  { id: "surlatable", name: "Sur La Table", host: "surlatable.com", category: "Home" },
  { id: "purple", name: "Purple", host: "purple.com", category: "Home" },

  // More fashion & shoes
  { id: "dsw", name: "DSW", host: "dsw.com", category: "Fashion" },
  { id: "famousfootwear", name: "Famous Footwear", host: "famousfootwear.com", category: "Fashion" },
  { id: "finishline", name: "Finish Line", host: "finishline.com", category: "Fashion" },
  { id: "skechers", name: "Skechers", host: "skechers.com", category: "Fashion" },
  { id: "crocs", name: "Crocs", host: "crocs.com", category: "Fashion" },
  { id: "converse", name: "Converse", host: "converse.com", category: "Fashion" },
  { id: "vans", name: "Vans", host: "vans.com", category: "Fashion" },
  { id: "goat", name: "GOAT", host: "goat.com", category: "Fashion" },

  // Kids & toys
  { id: "carters", name: "Carter's", host: "carters.com", category: "Kids" },
  { id: "oshkosh", name: "OshKosh B'gosh", host: "oshkosh.com", category: "Kids" },
  { id: "buildabear", name: "Build-A-Bear", host: "buildabear.com", category: "Kids" },

  // Deals, pets & grocery
  { id: "groupon", name: "Groupon", host: "groupon.com", category: "Deals" },
  { id: "petsuppliesplus", name: "Pet Supplies Plus", host: "petsuppliesplus.com", category: "Pets" },
  { id: "vitacost", name: "Vitacost", host: "vitacost.com", category: "Grocery" },

  // Travel & delivery
  { id: "expedia", name: "Expedia", host: "expedia.com", category: "Travel" },
  { id: "booking", name: "Booking.com", host: "booking.com", category: "Travel" },
  { id: "hotels", name: "Hotels.com", host: "hotels.com", category: "Travel" },
  { id: "doordash", name: "DoorDash", host: "doordash.com", category: "Delivery" },
  { id: "grubhub", name: "Grubhub", host: "grubhub.com", category: "Delivery" },
  { id: "ubereats", name: "Uber Eats", host: "ubereats.com", category: "Delivery" },
];

// Every entry may list one host or several regional hosts.
export function hostsOf(store) {
  return store.hosts || [store.host];
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function storeById(id) {
  return STORES.find((store) => store.id === id) || null;
}

// A site the shopper enabled from the panel behaves like a store with the
// hostname as its id, so saved and verified codes need no extra registry.
function customStore(host) {
  const name = host.replace(/^www\./, "");
  return { id: host, name, hosts: [host], category: "Your site", custom: true };
}

export function resolveStore(url, enabledSites) {
  const host = hostOf(url);
  if (!host) return null;
  const known = STORES.find((store) =>
    hostsOf(store).some((candidate) => host === candidate || host.endsWith(`.${candidate}`))
  );
  if (known) return known;
  const enabled = Array.isArray(enabledSites) ? enabledSites : [];
  if (enabled.some((site) => host === site || host.endsWith(`.${site}`))) {
    return customStore(host);
  }
  return null;
}

export function storeCount() {
  return STORES.length;
}

// Used by tools/check-catalog.mjs to keep manifest.json in sync.
export function matchesFor(host) {
  return [`*://*.${host}/*`, `*://${host}/*`];
}
