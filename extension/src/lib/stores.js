// Merchant catalog. A store is supported when its host matches one of these
// entries; the content script only listens on those hosts. Keep the
// content_scripts.matches list in manifest.json in sync with this file.
export const STORES = [
  // Marketplace & general
  { id: "amazon", name: "Amazon", host: "amazon.com", category: "Marketplace" },
  { id: "ebay", name: "eBay", host: "ebay.com", category: "Marketplace" },
  { id: "etsy", name: "Etsy", host: "etsy.com", category: "Marketplace" },
  { id: "aliexpress", name: "AliExpress", host: "aliexpress.com", category: "Marketplace" },
  { id: "temu", name: "Temu", host: "temu.com", category: "Marketplace" },
  { id: "target", name: "Target", host: "target.com", category: "General" },
  { id: "walmart", name: "Walmart", host: "walmart.com", category: "General" },
  { id: "kohls", name: "Kohl's", host: "kohls.com", category: "General" },
  { id: "jcpenney", name: "JCPenney", host: "jcpenney.com", category: "General" },
  { id: "costco", name: "Costco", host: "costco.com", category: "Warehouse" },
  { id: "samsclub", name: "Sam's Club", host: "samsclub.com", category: "Warehouse" },

  // Electronics
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

  // Beauty
  { id: "sephora", name: "Sephora", host: "sephora.com", category: "Beauty" },
  { id: "ulta", name: "Ulta Beauty", host: "ulta.com", category: "Beauty" },
  { id: "glossier", name: "Glossier", host: "glossier.com", category: "Beauty" },
  { id: "bathandbodyworks", name: "Bath & Body Works", host: "bathandbodyworks.com", category: "Beauty" },

  // Pets
  { id: "chewy", name: "Chewy", host: "chewy.com", category: "Pets" },
  { id: "petco", name: "Petco", host: "petco.com", category: "Pets" },
  { id: "petsmart", name: "PetSmart", host: "petsmart.com", category: "Pets" },

  // Outdoor & fitness
  { id: "rei", name: "REI", host: "rei.com", category: "Outdoor" },
  { id: "dickssportinggoods", name: "Dick's Sporting Goods", host: "dickssportinggoods.com", category: "Outdoor" },
  { id: "onepeloton", name: "Peloton", host: "onepeloton.com", category: "Fitness" },

  // Grocery, pharmacy & office
  { id: "kroger", name: "Kroger", host: "kroger.com", category: "Grocery" },
  { id: "instacart", name: "Instacart", host: "instacart.com", category: "Grocery" },
  { id: "walgreens", name: "Walgreens", host: "walgreens.com", category: "Pharmacy" },
  { id: "cvs", name: "CVS", host: "cvs.com", category: "Pharmacy" },
  { id: "staples", name: "Staples", host: "staples.com", category: "Office" },
  { id: "officedepot", name: "Office Depot", host: "officedepot.com", category: "Office" },

  // Travel & delivery
  { id: "expedia", name: "Expedia", host: "expedia.com", category: "Travel" },
  { id: "booking", name: "Booking.com", host: "booking.com", category: "Travel" },
  { id: "hotels", name: "Hotels.com", host: "hotels.com", category: "Travel" },
  { id: "doordash", name: "DoorDash", host: "doordash.com", category: "Delivery" },
  { id: "grubhub", name: "Grubhub", host: "grubhub.com", category: "Delivery" },
  { id: "ubereats", name: "Uber Eats", host: "ubereats.com", category: "Delivery" },
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

export function storeCount() {
  return STORES.length;
}
