// Merchant catalog. A page is a "store" when its host matches one of these
// entries; the content script only listens on those hosts. Keep the
// content_scripts.matches list in manifest.json in sync with this file
// (`node tools/check-catalog.mjs` verifies it).
//
// Sites the shopper explicitly enables from the panel are handled separately by
// resolveStore(url, settings.enabledSites).
export const STORES = [
  // Marketplace & general
  { id: "amazon", name: "Amazon", hosts: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca", "amazon.com.au", "amazon.co.jp", "amazon.fr", "amazon.it", "amazon.es", "amazon.in", "amazon.com.mx", "amazon.com.br", "amazon.nl", "amazon.se", "amazon.pl"], category: "Marketplace" },
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

  // Off-price & discount
  { id: "tjmaxx", name: "TJ Maxx", host: "tjmaxx.com", category: "Discount" },
  { id: "marshalls", name: "Marshalls", host: "marshalls.com", category: "Discount" },
  { id: "homegoods", name: "HomeGoods", host: "homegoods.com", category: "Discount" },
  { id: "ross", name: "Ross Dress for Less", host: "rossstores.com", category: "Discount" },
  { id: "burlington", name: "Burlington", host: "burlington.com", category: "Discount" },
  { id: "biglots", name: "Big Lots", host: "biglots.com", category: "Discount" },
  { id: "dollartree", name: "Dollar Tree", host: "dollartree.com", category: "Discount" },
  { id: "dollargeneral", name: "Dollar General", host: "dollargeneral.com", category: "Discount" },
  { id: "fivebelow", name: "Five Below", host: "fivebelow.com", category: "Discount" },
  { id: "bjs", name: "BJ's Wholesale Club", host: "bjs.com", category: "Warehouse" },

  // More marketplaces
  { id: "wish", name: "Wish", host: "wish.com", category: "Marketplace" },
  { id: "mercari", name: "Mercari", host: "mercari.com", category: "Marketplace" },
  { id: "offerup", name: "OfferUp", host: "offerup.com", category: "Marketplace" },
  { id: "uncommongoods", name: "Uncommon Goods", host: "uncommongoods.com", category: "General" },

  // More electronics & computing
  { id: "microsoft", name: "Microsoft", host: "microsoft.com", category: "Electronics" },
  { id: "asus", name: "ASUS", host: "asus.com", category: "Electronics" },
  { id: "acer", name: "Acer", host: "acer.com", category: "Electronics" },
  { id: "msi", name: "MSI", host: "msi.com", category: "Electronics" },
  { id: "sony", name: "Sony", host: "sony.com", category: "Electronics" },
  { id: "lg", name: "LG", host: "lg.com", category: "Electronics" },
  { id: "bose", name: "Bose", host: "bose.com", category: "Electronics" },
  { id: "sonos", name: "Sonos", host: "sonos.com", category: "Electronics" },
  { id: "jbl", name: "JBL", host: "jbl.com", category: "Electronics" },
  { id: "sandisk", name: "SanDisk", host: "sandisk.com", category: "Electronics" },
  { id: "canon", name: "Canon", host: "canon.com", category: "Electronics" },
  { id: "nikon", name: "Nikon", host: "nikon.com", category: "Electronics" },
  { id: "lensrentals", name: "Lensrentals", host: "lensrentals.com", category: "Electronics" },
  { id: "mpb", name: "MPB", host: "mpb.com", category: "Electronics" },

  // More gaming
  { id: "razer", name: "Razer", host: "razer.com", category: "Gaming" },
  { id: "corsair", name: "Corsair", host: "corsair.com", category: "Gaming" },
  { id: "steelseries", name: "SteelSeries", host: "steelseries.com", category: "Gaming" },
  { id: "playstation", name: "PlayStation", host: "playstation.com", category: "Gaming" },
  { id: "xbox", name: "Xbox", host: "xbox.com", category: "Gaming" },
  { id: "nintendo", name: "Nintendo", host: "nintendo.com", category: "Gaming" },
  { id: "steam", name: "Steam", host: "steampowered.com", category: "Gaming" },
  { id: "epicgames", name: "Epic Games Store", host: "epicgames.com", category: "Gaming" },
  { id: "cdkeys", name: "CDKeys", host: "cdkeys.com", category: "Gaming" },
  { id: "greenmangaming", name: "Green Man Gaming", host: "greenmangaming.com", category: "Gaming" },

  // More home, kitchen & mattress
  { id: "containerstore", name: "The Container Store", host: "containerstore.com", category: "Home" },
  { id: "worldmarket", name: "World Market", host: "worldmarket.com", category: "Home" },
  { id: "athome", name: "At Home", host: "athome.com", category: "Home" },
  { id: "roomstogo", name: "Rooms To Go", host: "roomstogo.com", category: "Home" },
  { id: "lazboy", name: "La-Z-Boy", host: "lazboy.com", category: "Home" },
  { id: "lecreuset", name: "Le Creuset", host: "lecreuset.com", category: "Home" },
  { id: "allclad", name: "All-Clad", host: "allclad.com", category: "Home" },
  { id: "kitchenaid", name: "KitchenAid", host: "kitchenaid.com", category: "Home" },
  { id: "ninjakitchen", name: "Ninja", host: "ninjakitchen.com", category: "Home" },
  { id: "whirlpool", name: "Whirlpool", host: "whirlpool.com", category: "Home" },
  { id: "geappliances", name: "GE Appliances", host: "geappliances.com", category: "Home" },
  { id: "build", name: "Build.com", host: "build.com", category: "Home" },
  { id: "lampsplus", name: "Lamps Plus", host: "lampsplus.com", category: "Home" },
  { id: "saatva", name: "Saatva", host: "saatva.com", category: "Home" },
  { id: "tempurpedic", name: "Tempur-Pedic", host: "tempurpedic.com", category: "Home" },
  { id: "sleepnumber", name: "Sleep Number", host: "sleepnumber.com", category: "Home" },
  { id: "nectar", name: "Nectar Sleep", host: "nectar.com", category: "Home" },
  { id: "leesa", name: "Leesa", host: "leesa.com", category: "Home" },
  { id: "helixsleep", name: "Helix Sleep", host: "helixsleep.com", category: "Home" },
  { id: "burpee", name: "Burpee", host: "burpee.com", category: "Home" },
  { id: "gardeners", name: "Gardener's Supply", host: "gardeners.com", category: "Home" },

  // More fashion
  { id: "jcrew", name: "J.Crew", host: "jcrew.com", category: "Fashion" },
  { id: "madewell", name: "Madewell", host: "madewell.com", category: "Fashion" },
  { id: "express", name: "Express", host: "express.com", category: "Fashion" },
  { id: "talbots", name: "Talbots", host: "talbots.com", category: "Fashion" },
  { id: "chicos", name: "Chico's", host: "chicos.com", category: "Fashion" },
  { id: "loft", name: "LOFT", host: "loft.com", category: "Fashion" },
  { id: "anntaylor", name: "Ann Taylor", host: "anntaylor.com", category: "Fashion" },
  { id: "whitehouseblackmarket", name: "White House Black Market", host: "whitehouseblackmarket.com", category: "Fashion" },
  { id: "everlane", name: "Everlane", host: "everlane.com", category: "Fashion" },
  { id: "jjill", name: "J.Jill", host: "jjill.com", category: "Fashion" },
  { id: "landsend", name: "Lands' End", host: "landsend.com", category: "Fashion" },
  { id: "vineyardvines", name: "vineyard vines", host: "vineyardvines.com", category: "Fashion" },
  { id: "brooksbrothers", name: "Brooks Brothers", host: "brooksbrothers.com", category: "Fashion" },
  { id: "ralphlauren", name: "Ralph Lauren", host: "ralphlauren.com", category: "Fashion" },
  { id: "tommyhilfiger", name: "Tommy Hilfiger", host: "tommy.com", category: "Fashion" },
  { id: "levis", name: "Levi's", host: "levi.com", category: "Fashion" },
  { id: "coach", name: "Coach", host: "coach.com", category: "Fashion" },
  { id: "michaelkors", name: "Michael Kors", host: "michaelkors.com", category: "Fashion" },
  { id: "katespade", name: "Kate Spade", host: "katespade.com", category: "Fashion" },
  { id: "toryburch", name: "Tory Burch", host: "toryburch.com", category: "Fashion" },
  { id: "farfetch", name: "Farfetch", host: "farfetch.com", category: "Fashion" },
  { id: "revolve", name: "Revolve", host: "revolve.com", category: "Fashion" },
  { id: "shopbop", name: "Shopbop", host: "shopbop.com", category: "Fashion" },
  { id: "fashionnova", name: "Fashion Nova", host: "fashionnova.com", category: "Fashion" },
  { id: "boohoo", name: "boohoo", host: "boohoo.com", category: "Fashion" },
  { id: "torrid", name: "Torrid", host: "torrid.com", category: "Fashion" },
  { id: "lanebryant", name: "Lane Bryant", host: "lanebryant.com", category: "Fashion" },
  { id: "bonobos", name: "Bonobos", host: "bonobos.com", category: "Fashion" },
  { id: "untuckit", name: "UNTUCKit", host: "untuckit.com", category: "Fashion" },
  { id: "herschel", name: "Herschel Supply", host: "herschel.com", category: "Fashion" },
  { id: "tumi", name: "TUMI", host: "tumi.com", category: "Fashion" },
  { id: "away", name: "Away", host: "away.com", category: "Fashion" },
  { id: "samsonite", name: "Samsonite", host: "samsonite.com", category: "Fashion" },

  // More shoes & athleisure
  { id: "stevemadden", name: "Steve Madden", host: "stevemadden.com", category: "Fashion" },
  { id: "aldoshoes", name: "ALDO", host: "aldoshoes.com", category: "Fashion" },
  { id: "clarksusa", name: "Clarks", host: "clarksusa.com", category: "Fashion" },
  { id: "drmartens", name: "Dr. Martens", host: "drmartens.com", category: "Fashion" },
  { id: "timberland", name: "Timberland", host: "timberland.com", category: "Fashion" },
  { id: "birkenstock", name: "Birkenstock", host: "birkenstock.com", category: "Fashion" },
  { id: "hoka", name: "HOKA", host: "hoka.com", category: "Fashion" },
  { id: "brooksrunning", name: "Brooks Running", host: "brooksrunning.com", category: "Fashion" },
  { id: "saucony", name: "Saucony", host: "saucony.com", category: "Fashion" },
  { id: "gymshark", name: "Gymshark", host: "gymshark.com", category: "Fashion" },
  { id: "fabletics", name: "Fabletics", host: "fabletics.com", category: "Fashion" },
  { id: "vuoriclothing", name: "Vuori", host: "vuoriclothing.com", category: "Fashion" },
  { id: "aloyoga", name: "Alo Yoga", host: "aloyoga.com", category: "Fashion" },

  // More outdoor
  { id: "llbean", name: "L.L.Bean", host: "llbean.com", category: "Outdoor" },
  { id: "eddiebauer", name: "Eddie Bauer", host: "eddiebauer.com", category: "Outdoor" },
  { id: "salomon", name: "Salomon", host: "salomon.com", category: "Outdoor" },
  { id: "merrell", name: "Merrell", host: "merrell.com", category: "Outdoor" },
  { id: "arcteryx", name: "Arc'teryx", host: "arcteryx.com", category: "Outdoor" },
  { id: "yeti", name: "YETI", host: "yeti.com", category: "Outdoor" },
  { id: "hydroflask", name: "Hydro Flask", host: "hydroflask.com", category: "Outdoor" },
  { id: "coleman", name: "Coleman", host: "coleman.com", category: "Outdoor" },

  // More beauty
  { id: "maccosmetics", name: "MAC Cosmetics", host: "maccosmetics.com", category: "Beauty" },
  { id: "clinique", name: "Clinique", host: "clinique.com", category: "Beauty" },
  { id: "esteelauder", name: "Estée Lauder", host: "esteelauder.com", category: "Beauty" },
  { id: "kiehls", name: "Kiehl's", host: "kiehls.com", category: "Beauty" },
  { id: "lush", name: "Lush", host: "lush.com", category: "Beauty" },
  { id: "elfcosmetics", name: "e.l.f. Cosmetics", host: "elfcosmetics.com", category: "Beauty" },
  { id: "colourpop", name: "ColourPop", host: "colourpop.com", category: "Beauty" },
  { id: "drunk-elephant", name: "Drunk Elephant", host: "drunk-elephant.com", category: "Beauty" },
  { id: "cerave", name: "CeraVe", host: "cerave.com", category: "Beauty" },
  { id: "dermstore", name: "Dermstore", host: "dermstore.com", category: "Beauty" },
  { id: "lookfantastic", name: "LookFantastic", host: "lookfantastic.com", category: "Beauty" },
  { id: "sallybeauty", name: "Sally Beauty", host: "sallybeauty.com", category: "Beauty" },
  { id: "olaplex", name: "OLAPLEX", host: "olaplex.com", category: "Beauty" },

  // Health & fitness
  { id: "gnc", name: "GNC", host: "gnc.com", category: "Health" },
  { id: "vitaminshoppe", name: "The Vitamin Shoppe", host: "vitaminshoppe.com", category: "Health" },
  { id: "myprotein", name: "Myprotein", host: "myprotein.com", category: "Health" },
  { id: "roguefitness", name: "Rogue Fitness", host: "roguefitness.com", category: "Fitness" },
  { id: "nordictrack", name: "NordicTrack", host: "nordictrack.com", category: "Fitness" },
  { id: "goodrx", name: "GoodRx", host: "goodrx.com", category: "Health" },
  { id: "riteaid", name: "Rite Aid", host: "riteaid.com", category: "Pharmacy" },

  // More grocery, meal & delivery
  { id: "safeway", name: "Safeway", host: "safeway.com", category: "Grocery" },
  { id: "albertsons", name: "Albertsons", host: "albertsons.com", category: "Grocery" },
  { id: "publix", name: "Publix", host: "publix.com", category: "Grocery" },
  { id: "heb", name: "H-E-B", host: "heb.com", category: "Grocery" },
  { id: "meijer", name: "Meijer", host: "meijer.com", category: "Grocery" },
  { id: "wegmans", name: "Wegmans", host: "wegmans.com", category: "Grocery" },
  { id: "wholefoodsmarket", name: "Whole Foods Market", host: "wholefoodsmarket.com", category: "Grocery" },
  { id: "sprouts", name: "Sprouts Farmers Market", host: "sprouts.com", category: "Grocery" },
  { id: "aldi", name: "ALDI", host: "aldi.us", category: "Grocery" },
  { id: "hellofresh", name: "HelloFresh", host: "hellofresh.com", category: "Grocery" },
  { id: "gopuff", name: "Gopuff", host: "gopuff.com", category: "Delivery" },
  { id: "shipt", name: "Shipt", host: "shipt.com", category: "Delivery" },
  { id: "petfoodexpress", name: "Pet Food Express", host: "petfoodexpress.com", category: "Pets" },

  // More kids & toys
  { id: "childrensplace", name: "The Children's Place", host: "childrensplace.com", category: "Kids" },
  { id: "hannaandersson", name: "Hanna Andersson", host: "hannaandersson.com", category: "Kids" },
  { id: "lego", name: "LEGO", host: "lego.com", category: "Kids" },
  { id: "mattel", name: "Mattel", host: "mattel.com", category: "Kids" },
  { id: "melissaanddoug", name: "Melissa & Doug", host: "melissaanddoug.com", category: "Kids" },
  { id: "orientaltrading", name: "Oriental Trading", host: "orientaltrading.com", category: "Kids" },

  // More sporting goods
  { id: "academy", name: "Academy Sports + Outdoors", host: "academy.com", category: "Outdoor" },
  { id: "scheels", name: "SCHEELS", host: "scheels.com", category: "Outdoor" },
  { id: "big5sportinggoods", name: "Big 5 Sporting Goods", host: "big5sportinggoods.com", category: "Outdoor" },
  { id: "golfgalaxy", name: "Golf Galaxy", host: "golfgalaxy.com", category: "Outdoor" },
  { id: "trekbikes", name: "Trek Bikes", host: "trekbikes.com", category: "Outdoor" },
  { id: "evo", name: "evo", host: "evo.com", category: "Outdoor" },

  // Craft, hobby & music
  { id: "michaels", name: "Michaels", host: "michaels.com", category: "Craft" },
  { id: "joann", name: "JOANN", host: "joann.com", category: "Craft" },
  { id: "hobbylobby", name: "Hobby Lobby", host: "hobbylobby.com", category: "Craft" },
  { id: "sweetwater", name: "Sweetwater", host: "sweetwater.com", category: "Music" },
  { id: "guitarcenter", name: "Guitar Center", host: "guitarcenter.com", category: "Music" },

  // Prints & photo
  { id: "shutterfly", name: "Shutterfly", host: "shutterfly.com", category: "Photo" },
  { id: "minted", name: "Minted", host: "minted.com", category: "Photo" },
  { id: "vistaprint", name: "Vistaprint", host: "vistaprint.com", category: "Photo" },

  // Auto parts
  { id: "advanceautoparts", name: "Advance Auto Parts", host: "advanceautoparts.com", category: "Auto" },
  { id: "oreillyauto", name: "O'Reilly Auto Parts", host: "oreillyauto.com", category: "Auto" },
  { id: "rockauto", name: "RockAuto", host: "rockauto.com", category: "Auto" },
  { id: "tirerack", name: "Tire Rack", host: "tirerack.com", category: "Auto" },
  { id: "discounttire", name: "Discount Tire", host: "discounttire.com", category: "Auto" },
  { id: "summitracing", name: "Summit Racing", host: "summitracing.com", category: "Auto" },

  // More books
  { id: "bookshop", name: "Bookshop.org", host: "bookshop.org", category: "Books" },
  { id: "thriftbooks", name: "ThriftBooks", host: "thriftbooks.com", category: "Books" },
  { id: "booksamillion", name: "Books-A-Million", host: "booksamillion.com", category: "Books" },

  // More travel
  { id: "priceline", name: "Priceline", host: "priceline.com", category: "Travel" },
  { id: "kayak", name: "KAYAK", host: "kayak.com", category: "Travel" },
  { id: "orbitz", name: "Orbitz", host: "orbitz.com", category: "Travel" },
  { id: "hotwire", name: "Hotwire", host: "hotwire.com", category: "Travel" },
  { id: "agoda", name: "Agoda", host: "agoda.com", category: "Travel" },
  { id: "vrbo", name: "Vrbo", host: "vrbo.com", category: "Travel" },
  { id: "airbnb", name: "Airbnb", host: "airbnb.com", category: "Travel" },
  { id: "marriott", name: "Marriott", host: "marriott.com", category: "Travel" },
  { id: "hilton", name: "Hilton", host: "hilton.com", category: "Travel" },
  { id: "hyatt", name: "Hyatt", host: "hyatt.com", category: "Travel" },
  { id: "enterprise", name: "Enterprise Rent-A-Car", host: "enterprise.com", category: "Travel" },
  { id: "hertz", name: "Hertz", host: "hertz.com", category: "Travel" },
  { id: "turo", name: "Turo", host: "turo.com", category: "Travel" },
  { id: "viator", name: "Viator", host: "viator.com", category: "Travel" },
  { id: "amtrak", name: "Amtrak", host: "amtrak.com", category: "Travel" },
  { id: "united", name: "United Airlines", host: "united.com", category: "Travel" },
  { id: "delta", name: "Delta Air Lines", host: "delta.com", category: "Travel" },
  { id: "aa", name: "American Airlines", host: "aa.com", category: "Travel" },
  { id: "southwest", name: "Southwest Airlines", host: "southwest.com", category: "Travel" },
  { id: "royalcaribbean", name: "Royal Caribbean", host: "royalcaribbean.com", category: "Travel" },

  // Services & software
  { id: "taskrabbit", name: "Taskrabbit", host: "taskrabbit.com", category: "Services" },
  { id: "thumbtack", name: "Thumbtack", host: "thumbtack.com", category: "Services" },
  { id: "rover", name: "Rover", host: "rover.com", category: "Services" },
  { id: "adobe", name: "Adobe", host: "adobe.com", category: "Software" },

  // United Kingdom
  { id: "argos", name: "Argos", host: "argos.co.uk", category: "General" },
  { id: "johnlewis", name: "John Lewis", host: "johnlewis.com", category: "General" },
  { id: "very", name: "Very", host: "very.co.uk", category: "General" },
  { id: "next", name: "Next", host: "next.co.uk", category: "Fashion" },
  { id: "marksandspencer", name: "Marks & Spencer", host: "marksandspencer.com", category: "General" },
  { id: "currys", name: "Currys", host: "currys.co.uk", category: "Electronics" },
  { id: "boots", name: "Boots", host: "boots.com", category: "Pharmacy" },
  { id: "screwfix", name: "Screwfix", host: "screwfix.com", category: "Tools" },
  { id: "jdsports", name: "JD Sports", host: "jdsports.co.uk", category: "Fashion" },

  // Canada & Australia
  { id: "canadiantire", name: "Canadian Tire", host: "canadiantire.ca", category: "General" },
  { id: "bestbuyca", name: "Best Buy Canada", host: "bestbuy.ca", category: "Electronics" },
  { id: "walmartca", name: "Walmart Canada", host: "walmart.ca", category: "General" },
  { id: "thebay", name: "Hudson's Bay", host: "thebay.com", category: "General" },
  { id: "jbhifi", name: "JB Hi-Fi", host: "jbhifi.com.au", category: "Electronics" },
  { id: "kmartau", name: "Kmart Australia", host: "kmart.com.au", category: "Discount" },
  { id: "bunnings", name: "Bunnings", host: "bunnings.com.au", category: "Home" },

  // Europe & Asia
  { id: "mediamarkt", name: "MediaMarkt", host: "mediamarkt.de", category: "Electronics" },
  { id: "zalando", name: "Zalando", host: "zalando.de", category: "Fashion" },
  { id: "bol", name: "bol.com", host: "bol.com", category: "General" },
  { id: "flipkart", name: "Flipkart", host: "flipkart.com", category: "Marketplace" },
  { id: "myntra", name: "Myntra", host: "myntra.com", category: "Fashion" },
  { id: "noon", name: "noon", host: "noon.com", category: "Marketplace" },
  { id: "rakuten", name: "Rakuten", host: "rakuten.com", category: "Marketplace" },

  // More fashion & shoes
  { id: "aritzia", name: "Aritzia", host: "aritzia.com", category: "Fashion" },
  { id: "reformation", name: "Reformation", host: "thereformation.com", category: "Fashion" },
  { id: "skims", name: "SKIMS", host: "skims.com", category: "Fashion" },
  { id: "allbirds", name: "Allbirds", host: "allbirds.com", category: "Fashion" },
  { id: "onrunning", name: "On", host: "on.com", category: "Fashion" },
  { id: "ugg", name: "UGG", host: "ugg.com", category: "Fashion" },
  { id: "sperry", name: "Sperry", host: "sperry.com", category: "Fashion" },
  { id: "pacsun", name: "PacSun", host: "pacsun.com", category: "Fashion" },
  { id: "mango", name: "MANGO", host: "mango.com", category: "Fashion" },
  { id: "cos", name: "COS", host: "cos.com", category: "Fashion" },
  { id: "shoecarnival", name: "Shoe Carnival", host: "shoecarnival.com", category: "Fashion" },
  { id: "rackroomshoes", name: "Rack Room Shoes", host: "rackroomshoes.com", category: "Fashion" },
  { id: "tillys", name: "Tillys", host: "tillys.com", category: "Fashion" },

  // More beauty
  { id: "fentybeauty", name: "Fenty Beauty", host: "fentybeauty.com", category: "Beauty" },
  { id: "rarebeauty", name: "Rare Beauty", host: "rarebeauty.com", category: "Beauty" },
  { id: "glowrecipe", name: "Glow Recipe", host: "glowrecipe.com", category: "Beauty" },
  { id: "deciem", name: "The Ordinary", host: "deciem.com", category: "Beauty" },
  { id: "ipsy", name: "IPSY", host: "ipsy.com", category: "Beauty" },

  // More home
  { id: "arhaus", name: "Arhaus", host: "arhaus.com", category: "Home" },
  { id: "serenaandlily", name: "Serena & Lily", host: "serenaandlily.com", category: "Home" },
  { id: "ballarddesigns", name: "Ballard Designs", host: "ballarddesigns.com", category: "Home" },
  { id: "frontgate", name: "Frontgate", host: "frontgate.com", category: "Home" },
  { id: "flooranddecor", name: "Floor & Decor", host: "flooranddecor.com", category: "Home" },
  { id: "rejuvenation", name: "Rejuvenation", host: "rejuvenation.com", category: "Home" },

  // More electronics & mobile
  { id: "verizon", name: "Verizon", host: "verizon.com", category: "Electronics" },
  { id: "att", name: "AT&T", host: "att.com", category: "Electronics" },
  { id: "tmobile", name: "T-Mobile", host: "t-mobile.com", category: "Electronics" },

  // More grocery
  { id: "foodlion", name: "Food Lion", host: "foodlion.com", category: "Grocery" },
  { id: "stopandshop", name: "Stop & Shop", host: "stopandshop.com", category: "Grocery" },
  { id: "gianteagle", name: "Giant Eagle", host: "gianteagle.com", category: "Grocery" },

  // More books
  { id: "abebooks", name: "AbeBooks", host: "abebooks.com", category: "Books" },
  { id: "betterworldbooks", name: "Better World Books", host: "betterworldbooks.com", category: "Books" },

  // More outdoor & sporting
  { id: "decathlon", name: "Decathlon", host: "decathlon.com", category: "Outdoor" },
  { id: "moosejaw", name: "Moosejaw", host: "moosejaw.com", category: "Outdoor" },
  { id: "sierra", name: "Sierra", host: "sierra.com", category: "Outdoor" },
  { id: "publiclands", name: "Public Lands", host: "publiclands.com", category: "Outdoor" },

  // More kids
  { id: "fatbraintoys", name: "Fat Brain Toys", host: "fatbraintoys.com", category: "Kids" },

  // More services & software
  { id: "canva", name: "Canva", host: "canva.com", category: "Software" },
  { id: "grammarly", name: "Grammarly", host: "grammarly.com", category: "Software" },
  { id: "nordvpn", name: "NordVPN", host: "nordvpn.com", category: "Software" },
  { id: "squarespace", name: "Squarespace", host: "squarespace.com", category: "Software" },

  // More travel
  { id: "jetblue", name: "JetBlue", host: "jetblue.com", category: "Travel" },
  { id: "alaskaair", name: "Alaska Airlines", host: "alaskaair.com", category: "Travel" },

  // More United Kingdom
  { id: "halfords", name: "Halfords", host: "halfords.com", category: "Electronics" },
  { id: "selfridges", name: "Selfridges", host: "selfridges.com", category: "Fashion" },
  { id: "sportsdirect", name: "Sports Direct", host: "sportsdirect.com", category: "Fashion" },
  { id: "tesco", name: "Tesco", host: "tesco.com", category: "Grocery" },
  { id: "ao", name: "AO", host: "ao.com", category: "Electronics" },

  // More Australia
  { id: "kogan", name: "Kogan", host: "kogan.com", category: "General" },
  { id: "theiconic", name: "THE ICONIC", host: "theiconic.com.au", category: "Fashion" },
  { id: "myer", name: "Myer", host: "myer.com.au", category: "General" },

  // More fashion & footwear
  { id: "aerie", name: "Aerie", host: "aerie.com", category: "Fashion" },
  { id: "forever21", name: "Forever 21", host: "forever21.com", category: "Fashion" },
  { id: "prettylittlething", name: "PrettyLittleThing", host: "prettylittlething.com", category: "Fashion" },
  { id: "dollskill", name: "Dolls Kill", host: "dollskill.com", category: "Fashion" },
  { id: "zumiez", name: "Zumiez", host: "zumiez.com", category: "Fashion" },
  { id: "journeys", name: "Journeys", host: "journeys.com", category: "Fashion" },
  { id: "stitchfix", name: "Stitch Fix", host: "stitchfix.com", category: "Fashion" },
  { id: "savagex", name: "Savage X Fenty", host: "savagex.com", category: "Fashion" },
  { id: "thirdlove", name: "ThirdLove", host: "thirdlove.com", category: "Fashion" },
  { id: "bombas", name: "Bombas", host: "bombas.com", category: "Fashion" },
  { id: "meundies", name: "MeUndies", host: "meundies.com", category: "Fashion" },
  { id: "wearpact", name: "Pact", host: "wearpact.com", category: "Fashion" },
  { id: "rothys", name: "Rothy's", host: "rothys.com", category: "Fashion" },
  { id: "buckmason", name: "Buck Mason", host: "buckmason.com", category: "Fashion" },
  { id: "marinelayer", name: "Marine Layer", host: "marinelayer.com", category: "Fashion" },
  { id: "outdoorvoices", name: "Outdoor Voices", host: "outdoorvoices.com", category: "Fashion" },
  { id: "colehaan", name: "Cole Haan", host: "colehaan.com", category: "Fashion" },
  { id: "fashionphile", name: "Fashionphile", host: "fashionphile.com", category: "Fashion" },
  { id: "rebag", name: "Rebag", host: "rebag.com", category: "Fashion" },
  { id: "vestiairecollective", name: "Vestiaire Collective", host: "vestiairecollective.com", category: "Fashion" },
  { id: "asics", name: "ASICS", host: "asics.com", category: "Fashion" },
  { id: "mizuno", name: "Mizuno", host: "mizuno.com", category: "Fashion" },
  { id: "nobull", name: "NOBULL", host: "nobullproject.com", category: "Fashion" },
  { id: "rapha", name: "Rapha", host: "rapha.cc", category: "Fashion" },

  // More beauty & skincare
  { id: "supergoop", name: "Supergoop!", host: "supergoop.com", category: "Beauty" },
  { id: "tatcha", name: "Tatcha", host: "tatcha.com", category: "Beauty" },
  { id: "farmacy", name: "Farmacy", host: "farmacybeauty.com", category: "Beauty" },
  { id: "youthtothepeople", name: "Youth To The People", host: "youthtothepeople.com", category: "Beauty" },
  { id: "paulaschoice", name: "Paula's Choice", host: "paulaschoice.com", category: "Beauty" },
  { id: "firstaidbeauty", name: "First Aid Beauty", host: "firstaidbeauty.com", category: "Beauty" },
  { id: "mariobadescu", name: "Mario Badescu", host: "mariobadescu.com", category: "Beauty" },
  { id: "thebodyshop", name: "The Body Shop", host: "thebodyshop.com", category: "Beauty" },
  { id: "bareminerals", name: "bareMinerals", host: "bareminerals.com", category: "Beauty" },
  { id: "toofaced", name: "Too Faced", host: "toofaced.com", category: "Beauty" },
  { id: "benefitcosmetics", name: "Benefit Cosmetics", host: "benefitcosmetics.com", category: "Beauty" },
  { id: "urbandecay", name: "Urban Decay", host: "urbandecay.com", category: "Beauty" },
  { id: "nyxcosmetics", name: "NYX Professional Makeup", host: "nyxcosmetics.com", category: "Beauty" },
  { id: "fragrancenet", name: "FragranceNet", host: "fragrancenet.com", category: "Beauty" },
  { id: "sokoglam", name: "Soko Glam", host: "sokoglam.com", category: "Beauty" },
  { id: "yesstyle", name: "YesStyle", host: "yesstyle.com", category: "Beauty" },
  { id: "beautybay", name: "Beauty Bay", host: "beautybay.com", category: "Beauty" },
  { id: "cultbeauty", name: "Cult Beauty", host: "cultbeauty.co.uk", category: "Beauty" },

  // More electronics, cameras & storage
  { id: "gopro", name: "GoPro", host: "gopro.com", category: "Electronics" },
  { id: "dji", name: "DJI", host: "dji.com", category: "Electronics" },
  { id: "insta360", name: "Insta360", host: "insta360.com", category: "Electronics" },
  { id: "wyze", name: "Wyze", host: "wyze.com", category: "Electronics" },
  { id: "govee", name: "Govee", host: "govee.com", category: "Electronics" },
  { id: "belkin", name: "Belkin", host: "belkin.com", category: "Electronics" },
  { id: "netgear", name: "NETGEAR", host: "netgear.com", category: "Electronics" },
  { id: "westerndigital", name: "Western Digital", host: "westerndigital.com", category: "Electronics" },
  { id: "seagate", name: "Seagate", host: "seagate.com", category: "Electronics" },
  { id: "crucial", name: "Crucial", host: "crucial.com", category: "Electronics" },
  { id: "kingston", name: "Kingston", host: "kingston.com", category: "Electronics" },

  // More wearables
  { id: "fitbit", name: "Fitbit", host: "fitbit.com", category: "Wearables" },
  { id: "withings", name: "Withings", host: "withings.com", category: "Wearables" },
  { id: "polar", name: "Polar", host: "polar.com", category: "Wearables" },
  { id: "suunto", name: "Suunto", host: "suunto.com", category: "Wearables" },

  // More gaming & PC
  { id: "elgato", name: "Elgato", host: "elgato.com", category: "Gaming" },
  { id: "hyperx", name: "HyperX", host: "hyperx.com", category: "Gaming" },
  { id: "turtlebeach", name: "Turtle Beach", host: "turtlebeach.com", category: "Gaming" },
  { id: "nzxt", name: "NZXT", host: "nzxt.com", category: "Gaming" },
  { id: "ibuypower", name: "iBUYPOWER", host: "ibuypower.com", category: "Gaming" },
  { id: "cyberpowerpc", name: "CyberPowerPC", host: "cyberpowerpc.com", category: "Gaming" },
  { id: "humblebundle", name: "Humble Bundle", host: "humblebundle.com", category: "Gaming" },
  { id: "fanatical", name: "Fanatical", host: "fanatical.com", category: "Gaming" },
  { id: "eneba", name: "Eneba", host: "eneba.com", category: "Gaming" },
  { id: "instantgaming", name: "Instant Gaming", host: "instant-gaming.com", category: "Gaming" },
  { id: "g2a", name: "G2A", host: "g2a.com", category: "Gaming" },
  { id: "kinguin", name: "Kinguin", host: "kinguin.net", category: "Gaming" },

  // More home, bedding & kitchen
  { id: "bollandbranch", name: "Boll & Branch", host: "bollandbranch.com", category: "Home" },
  { id: "parachutehome", name: "Parachute", host: "parachutehome.com", category: "Home" },
  { id: "tuftandneedle", name: "Tuft & Needle", host: "tuftandneedle.com", category: "Home" },
  { id: "avocadomattress", name: "Avocado", host: "avocadomattress.com", category: "Home" },
  { id: "caraway", name: "Caraway", host: "carawayhome.com", category: "Home" },
  { id: "fromourplace", name: "Our Place", host: "fromourplace.com", category: "Home" },
  { id: "madeincookware", name: "Made In", host: "madeincookware.com", category: "Home" },
  { id: "materialkitchen", name: "Material", host: "materialkitchen.com", category: "Home" },
  { id: "vitamix", name: "Vitamix", host: "vitamix.com", category: "Home" },
  { id: "breville", name: "Breville", host: "breville.com", category: "Home" },
  { id: "oxo", name: "OXO", host: "oxo.com", category: "Home" },
  { id: "solostove", name: "Solo Stove", host: "solostove.com", category: "Home" },
  { id: "traeger", name: "Traeger", host: "traeger.com", category: "Home" },
  { id: "weber", name: "Weber", host: "weber.com", category: "Home" },
  { id: "blackstone", name: "Blackstone", host: "blackstoneproducts.com", category: "Home" },
  { id: "luluandgeorgia", name: "Lulu and Georgia", host: "luluandgeorgia.com", category: "Home" },

  // More grocery
  { id: "hyvee", name: "Hy-Vee", host: "hy-vee.com", category: "Grocery" },
  { id: "groceryoutlet", name: "Grocery Outlet", host: "groceryoutlet.com", category: "Grocery" },
  { id: "smartandfinal", name: "Smart & Final", host: "smartandfinal.com", category: "Grocery" },
  { id: "wincofoods", name: "WinCo Foods", host: "wincofoods.com", category: "Grocery" },
  { id: "freshdirect", name: "FreshDirect", host: "freshdirect.com", category: "Grocery" },
  { id: "sayweee", name: "Weee!", host: "sayweee.com", category: "Grocery" },
  { id: "hmart", name: "H Mart", host: "hmart.com", category: "Grocery" },

  // More pets
  { id: "barkbox", name: "BarkBox", host: "barkbox.com", category: "Pets" },
  { id: "thefarmersdog", name: "The Farmer's Dog", host: "thefarmersdog.com", category: "Pets" },
  { id: "openfarm", name: "Open Farm", host: "openfarmpet.com", category: "Pets" },
  { id: "myollie", name: "Ollie", host: "myollie.com", category: "Pets" },

  // More kids & toys
  { id: "hasbro", name: "Hasbro", host: "hasbro.com", category: "Kids" },
  { id: "crayola", name: "Crayola", host: "crayola.com", category: "Kids" },
  { id: "playmobil", name: "Playmobil", host: "playmobil.com", category: "Kids" },
  { id: "spinmaster", name: "Spin Master", host: "spinmaster.com", category: "Kids" },
  { id: "potterybarnkids", name: "Pottery Barn Kids", host: "potterybarnkids.com", category: "Kids" },
  { id: "janieandjack", name: "Janie and Jack", host: "janieandjack.com", category: "Kids" },
  { id: "teacollection", name: "Tea Collection", host: "teacollection.com", category: "Kids" },
  { id: "gymboree", name: "Gymboree", host: "gymboree.com", category: "Kids" },

  // More auto
  { id: "napaonline", name: "NAPA Auto Parts", host: "napaonline.com", category: "Auto" },
  { id: "carparts", name: "CarParts.com", host: "carparts.com", category: "Auto" },
  { id: "weathertech", name: "WeatherTech", host: "weathertech.com", category: "Auto" },
  { id: "pepboys", name: "Pep Boys", host: "pepboys.com", category: "Auto" },
  { id: "carmax", name: "CarMax", host: "carmax.com", category: "Auto" },
  { id: "carvana", name: "Carvana", host: "carvana.com", category: "Auto" },
  { id: "4wheelparts", name: "4 Wheel Parts", host: "4wheelparts.com", category: "Auto" },

  // More office & industrial
  { id: "quill", name: "Quill", host: "quill.com", category: "Office" },
  { id: "uline", name: "Uline", host: "uline.com", category: "Office" },
  { id: "grainger", name: "Grainger", host: "grainger.com", category: "Office" },
  { id: "zoro", name: "Zoro", host: "zoro.com", category: "Office" },
  { id: "globalindustrial", name: "Global Industrial", host: "globalindustrial.com", category: "Office" },
  { id: "mscdirect", name: "MSC Industrial", host: "mscdirect.com", category: "Office" },
  { id: "moleskine", name: "Moleskine", host: "moleskine.com", category: "Office" },

  // More travel
  { id: "ihg", name: "IHG", host: "ihg.com", category: "Travel" },
  { id: "wyndham", name: "Wyndham", host: "wyndhamhotels.com", category: "Travel" },
  { id: "choicehotels", name: "Choice Hotels", host: "choicehotels.com", category: "Travel" },
  { id: "bestwestern", name: "Best Western", host: "bestwestern.com", category: "Travel" },
  { id: "avis", name: "Avis", host: "avis.com", category: "Travel" },
  { id: "budget", name: "Budget", host: "budget.com", category: "Travel" },
  { id: "sixt", name: "SIXT", host: "sixt.com", category: "Travel" },
  { id: "nationalcar", name: "National Car Rental", host: "nationalcar.com", category: "Travel" },
  { id: "tripadvisor", name: "Tripadvisor", host: "tripadvisor.com", category: "Travel" },
  { id: "trivago", name: "trivago", host: "trivago.com", category: "Travel" },
  { id: "flixbus", name: "FlixBus", host: "flixbus.com", category: "Travel" },
  { id: "omio", name: "Omio", host: "omio.com", category: "Travel" },
  { id: "ncl", name: "Norwegian Cruise Line", host: "ncl.com", category: "Travel" },
  { id: "carnival", name: "Carnival", host: "carnival.com", category: "Travel" },
  { id: "princess", name: "Princess Cruises", host: "princess.com", category: "Travel" },
  { id: "celebritycruises", name: "Celebrity Cruises", host: "celebritycruises.com", category: "Travel" },
  { id: "hostelworld", name: "Hostelworld", host: "hostelworld.com", category: "Travel" },

  // More books
  { id: "hpb", name: "Half Price Books", host: "hpb.com", category: "Books" },
  { id: "alibris", name: "Alibris", host: "alibris.com", category: "Books" },
  { id: "waterstones", name: "Waterstones", host: "waterstones.com", category: "Books" },
  { id: "indigo", name: "Indigo", host: "indigo.ca", category: "Books" },
  { id: "kinokuniya", name: "Kinokuniya", host: "kinokuniya.com", category: "Books" },

  // More fitness
  { id: "titan", name: "Titan Fitness", host: "titan.fitness", category: "Fitness" },
  { id: "repfitness", name: "REP Fitness", host: "repfitness.com", category: "Fitness" },
  { id: "bowflex", name: "Bowflex", host: "bowflex.com", category: "Fitness" },
  { id: "schwinnfitness", name: "Schwinn", host: "schwinnfitness.com", category: "Fitness" },
  { id: "concept2", name: "Concept2", host: "concept2.com", category: "Fitness" },

  // More Europe & New Zealand
  { id: "elcorteingles", name: "El Corte Inglés", host: "elcorteingles.es", category: "International" },
  { id: "fnac", name: "Fnac", host: "fnac.com", category: "International" },
  { id: "darty", name: "Darty", host: "darty.com", category: "International" },
  { id: "cdiscount", name: "Cdiscount", host: "cdiscount.com", category: "International" },
  { id: "otto", name: "OTTO", host: "otto.de", category: "International" },
  { id: "allegro", name: "Allegro", host: "allegro.pl", category: "International" },
  { id: "sainsburys", name: "Sainsbury's", host: "sainsburys.co.uk", category: "International" },
  { id: "asda", name: "ASDA", host: "asda.com", category: "International" },
  { id: "morrisons", name: "Morrisons", host: "morrisons.com", category: "International" },
  { id: "waitrose", name: "Waitrose", host: "waitrose.com", category: "International" },
  { id: "ocado", name: "Ocado", host: "ocado.com", category: "International" },
  { id: "davidjones", name: "David Jones", host: "davidjones.com", category: "International" },
  { id: "harveynorman", name: "Harvey Norman", host: "harveynorman.com.au", category: "International" },
  { id: "officeworks", name: "Officeworks", host: "officeworks.com.au", category: "International" },
  { id: "woolworthsau", name: "Woolworths", host: "woolworths.com.au", category: "International" },
  { id: "coles", name: "Coles", host: "coles.com.au", category: "International" },
  { id: "trademe", name: "Trade Me", host: "trademe.co.nz", category: "International" },

  // ---- Added after a catalog sweep: stores shoppers asked for ----

  // Marketplaces & resale
  { id: "alibaba", name: "Alibaba", host: "alibaba.com", category: "Marketplace" },
  { id: "dhgate", name: "DHgate", host: "dhgate.com", category: "Marketplace" },
  { id: "faire", name: "Faire", host: "faire.com", category: "Marketplace" },
  { id: "swappa", name: "Swappa", host: "swappa.com", category: "Electronics" },
  { id: "gazelle", name: "Gazelle", host: "gazelle.com", category: "Electronics" },

  // General
  { id: "belk", name: "Belk", host: "belk.com", category: "General" },

  // Fashion
  { id: "depop", name: "Depop", host: "depop.com", category: "Fashion" },
  { id: "vinted", name: "Vinted", host: "vinted.com", category: "Fashion" },
  { id: "dillards", name: "Dillard's", host: "dillards.com", category: "Fashion" },
  { id: "saksoff5th", name: "Saks Off 5th", host: "saksoff5th.com", category: "Fashion" },
  { id: "netaporter", name: "Net-A-Porter", host: "net-a-porter.com", category: "Fashion" },
  { id: "mrporter", name: "MR PORTER", host: "mrporter.com", category: "Fashion" },
  { id: "ssense", name: "SSENSE", host: "ssense.com", category: "Fashion" },
  { id: "endclothing", name: "END.", host: "endclothing.com", category: "Fashion" },
  { id: "quince", name: "Quince", host: "onequince.com", category: "Fashion" },
  { id: "cuyana", name: "Cuyana", host: "cuyana.com", category: "Fashion" },
  { id: "princesspolly", name: "Princess Polly", host: "princesspolly.com", category: "Fashion" },
  { id: "whitefox", name: "White Fox Boutique", host: "whitefoxboutique.com", category: "Fashion" },
  { id: "cider", name: "Cider", host: "shopcider.com", category: "Fashion" },
  { id: "romwe", name: "Romwe", host: "romwe.com", category: "Fashion" },
  { id: "zaful", name: "Zaful", host: "zaful.com", category: "Fashion" },
  { id: "athleta", name: "Athleta", host: "athleta.com", category: "Fashion" },
  { id: "samedelman", name: "Sam Edelman", host: "samedelman.com", category: "Fashion" },
  { id: "frye", name: "Frye", host: "thefryecompany.com", category: "Fashion" },
  { id: "boden", name: "Boden", host: "boden.com", category: "Fashion" },

  // Fitness
  { id: "sweatybetty", name: "Sweaty Betty", host: "sweatybetty.com", category: "Fitness" },
  { id: "lornajane", name: "Lorna Jane", host: "lornajane.com", category: "Fitness" },

  // Beauty
  { id: "charlottetilbury", name: "Charlotte Tilbury", host: "charlottetilbury.com", category: "Beauty" },
  { id: "nars", name: "NARS", host: "narscosmetics.com", category: "Beauty" },
  { id: "skinceuticals", name: "SkinCeuticals", host: "skinceuticals.com", category: "Beauty" },
  { id: "larocheposay", name: "La Roche-Posay", host: "laroche-posay.us", category: "Beauty" },
  { id: "cetaphil", name: "Cetaphil", host: "cetaphil.com", category: "Beauty" },
  { id: "avene", name: "Avène", host: "aveneusa.com", category: "Beauty" },
  { id: "ilia", name: "ILIA", host: "iliabeauty.com", category: "Beauty" },
  { id: "merit", name: "Merit", host: "meritbeauty.com", category: "Beauty" },
  { id: "saie", name: "Saie", host: "saiehello.com", category: "Beauty" },
  { id: "tower28", name: "Tower 28", host: "tower28beauty.com", category: "Beauty" },
  { id: "kosas", name: "Kosas", host: "kosas.com", category: "Beauty" },
  { id: "hudabeauty", name: "Huda Beauty", host: "hudabeauty.com", category: "Beauty" },
  { id: "anastasiabeverlyhills", name: "Anastasia Beverly Hills", host: "anastasiabeverlyhills.com", category: "Beauty" },
  { id: "patmcgrath", name: "Pat McGrath Labs", host: "patmcgrath.com", category: "Beauty" },
  { id: "lancome", name: "Lancôme", host: "lancome-usa.com", category: "Beauty" },
  { id: "yslbeauty", name: "YSL Beauty", host: "yslbeautyus.com", category: "Beauty" },
  { id: "shiseido", name: "Shiseido", host: "shiseido.com", category: "Beauty" },
  { id: "origins", name: "Origins", host: "origins.com", category: "Beauty" },
  { id: "bobbibrown", name: "Bobbi Brown", host: "bobbibrowncosmetics.com", category: "Beauty" },
  { id: "lauramercier", name: "Laura Mercier", host: "lauramercier.com", category: "Beauty" },
  { id: "hourglass", name: "Hourglass", host: "hourglasscosmetics.com", category: "Beauty" },
  { id: "makeupforever", name: "Make Up For Ever", host: "makeupforever.com", category: "Beauty" },

  // Wearables & outdoor
  { id: "oura", name: "Oura", host: "ouraring.com", category: "Wearables" },
  { id: "campingworld", name: "Camping World", host: "campingworld.com", category: "Outdoor" },

  // Home
  { id: "dwr", name: "Design Within Reach", host: "dwr.com", category: "Home" },
  { id: "floyd", name: "Floyd", host: "floydhome.com", category: "Home" },
  { id: "burrow", name: "Burrow", host: "burrow.com", category: "Home" },
  { id: "castlery", name: "Castlery", host: "castlery.com", category: "Home" },
  { id: "albanypark", name: "Albany Park", host: "albanypark.com", category: "Home" },
  { id: "valuecityfurniture", name: "Value City Furniture", host: "valuecityfurniture.com", category: "Home" },
  { id: "mybobs", name: "Bob's Discount Furniture", host: "mybobs.com", category: "Home" },
  { id: "mattressfirm", name: "Mattress Firm", host: "mattressfirm.com", category: "Home" },
  { id: "serta", name: "Serta", host: "serta.com", category: "Home" },
  { id: "sealy", name: "Sealy", host: "sealy.com", category: "Home" },
  { id: "food52", name: "Food52", host: "food52.com", category: "Home" },
  { id: "greatjones", name: "Great Jones", host: "greatjonesgoods.com", category: "Home" },
  { id: "misen", name: "Misen", host: "misen.com", category: "Home" },
  { id: "keurig", name: "Keurig", host: "keurig.com", category: "Home" },
  { id: "instantpot", name: "Instant Pot", host: "instantpot.com", category: "Home" },
  { id: "cosori", name: "Cosori", host: "cosori.com", category: "Home" },
  { id: "irobot", name: "iRobot", host: "irobot.com", category: "Home" },
  { id: "sharkclean", name: "Shark", host: "sharkclean.com", category: "Home" },
  { id: "roborock", name: "Roborock", host: "roborock.com", category: "Home" },

  // Grocery & meal boxes
  { id: "traderjoes", name: "Trader Joe's", host: "traderjoes.com", category: "Grocery" },
  { id: "lidl", name: "Lidl", host: "lidl.com", category: "Grocery" },
  { id: "naturalgrocers", name: "Natural Grocers", host: "naturalgrocers.com", category: "Grocery" },
  { id: "ralphs", name: "Ralphs", host: "ralphs.com", category: "Grocery" },
  { id: "vons", name: "Vons", host: "vons.com", category: "Grocery" },
  { id: "loblaws", name: "Loblaws", host: "loblaws.ca", category: "Grocery" },
  { id: "sobeys", name: "Sobeys", host: "sobeys.com", category: "Grocery" },
  { id: "metro", name: "Metro", host: "metro.ca", category: "Grocery" },
  { id: "nofrills", name: "No Frills", host: "nofrills.ca", category: "Grocery" },
  { id: "saveonfoods", name: "Save-On-Foods", host: "saveonfoods.com", category: "Grocery" },
  { id: "fredmeyer", name: "Fred Meyer", host: "fredmeyer.com", category: "Grocery" },
  { id: "kingsoopers", name: "King Soopers", host: "kingsoopers.com", category: "Grocery" },
  { id: "harristeeter", name: "Harris Teeter", host: "harristeeter.com", category: "Grocery" },
  { id: "giantfood", name: "Giant Food", host: "giantfood.com", category: "Grocery" },
  { id: "homechef", name: "Home Chef", host: "homechef.com", category: "Grocery" },
  { id: "marleyspoon", name: "Marley Spoon", host: "marleyspoon.com", category: "Grocery" },
  { id: "greenchef", name: "Green Chef", host: "greenchef.com", category: "Grocery" },
  { id: "purplecarrot", name: "Purple Carrot", host: "purplecarrot.com", category: "Grocery" },
  { id: "hungryroot", name: "Hungryroot", host: "hungryroot.com", category: "Grocery" },
  { id: "dailyharvest", name: "Daily Harvest", host: "daily-harvest.com", category: "Grocery" },

  // Pets, office, books
  { id: "petflow", name: "PetFlow", host: "petflow.com", category: "Pets" },
  { id: "spotandtango", name: "Spot & Tango", host: "spotandtango.com", category: "Pets" },
  { id: "erincondren", name: "Erin Condren", host: "erincondren.com", category: "Office" },
  { id: "wbmason", name: "W.B. Mason", host: "wbmason.com", category: "Office" },
  { id: "blackwells", name: "Blackwell's", host: "blackwells.co.uk", category: "Books" },
  { id: "powells", name: "Powell's Books", host: "powells.com", category: "Books" },

  // Tools & auto
  { id: "northerntool", name: "Northern Tool", host: "northerntool.com", category: "Tools" },
  { id: "rockler", name: "Rockler", host: "rockler.com", category: "Tools" },
  { id: "toolstation", name: "Toolstation", host: "toolstation.com", category: "Tools" },
  { id: "woodcraft", name: "Woodcraft", host: "woodcraft.com", category: "Tools" },
  { id: "leevalley", name: "Lee Valley", host: "leevalley.com", category: "Tools" },
  { id: "cpooutlets", name: "CPO Outlets", host: "cpooutlets.com", category: "Tools" },
  { id: "carid", name: "CARiD", host: "carid.com", category: "Auto" },
  { id: "jegs", name: "JEGS", host: "jegs.com", category: "Auto" },
  { id: "speedwaymotors", name: "Speedway Motors", host: "speedwaymotors.com", category: "Auto" },
  { id: "partsgeek", name: "Parts Geek", host: "partsgeek.com", category: "Auto" },
  { id: "tirebuyer", name: "TireBuyer", host: "tirebuyer.com", category: "Auto" },

  // Kids
  { id: "primary", name: "Primary", host: "primary.com", category: "Kids" },
  { id: "kytebaby", name: "Kyte Baby", host: "kytebaby.com", category: "Kids" },
  { id: "littlesleepies", name: "Little Sleepies", host: "littlesleepies.com", category: "Kids" },
  { id: "lovevery", name: "Lovevery", host: "lovevery.com", category: "Kids" },
  { id: "kiwico", name: "KiwiCo", host: "kiwico.com", category: "Kids" },
  { id: "lakeshore", name: "Lakeshore Learning", host: "lakeshorelearning.com", category: "Kids" },

  // Travel
  { id: "trip", name: "Trip.com", host: "trip.com", category: "Travel" },
  { id: "qantas", name: "Qantas", host: "qantas.com", category: "Travel" },
  { id: "britishairways", name: "British Airways", host: "britishairways.com", category: "Travel" },
  { id: "aircanada", name: "Air Canada", host: "aircanada.com", category: "Travel" },
  { id: "airfrance", name: "Air France", host: "airfrance.com", category: "Travel" },
  { id: "lufthansa", name: "Lufthansa", host: "lufthansa.com", category: "Travel" },
  { id: "klm", name: "KLM", host: "klm.com", category: "Travel" },
  { id: "emirates", name: "Emirates", host: "emirates.com", category: "Travel" },
  { id: "qatarairways", name: "Qatar Airways", host: "qatarairways.com", category: "Travel" },
  { id: "turkishairlines", name: "Turkish Airlines", host: "turkishairlines.com", category: "Travel" },
  { id: "singaporeair", name: "Singapore Airlines", host: "singaporeair.com", category: "Travel" },
  { id: "ryanair", name: "Ryanair", host: "ryanair.com", category: "Travel" },
  { id: "easyjet", name: "easyJet", host: "easyjet.com", category: "Travel" },
  { id: "wizzair", name: "Wizz Air", host: "wizzair.com", category: "Travel" },
  { id: "vueling", name: "Vueling", host: "vueling.com", category: "Travel" },
  { id: "norwegian", name: "Norwegian", host: "norwegian.com", category: "Travel" },
  { id: "virginatlantic", name: "Virgin Atlantic", host: "virginatlantic.com", category: "Travel" },
  { id: "aerlingus", name: "Aer Lingus", host: "aerlingus.com", category: "Travel" },
  { id: "iberia", name: "Iberia", host: "iberia.com", category: "Travel" },
  { id: "hopper", name: "Hopper", host: "hopper.com", category: "Travel" },
  { id: "skyscanner", name: "Skyscanner", host: "skyscanner.net", category: "Travel" },
  { id: "momondo", name: "Momondo", host: "momondo.com", category: "Travel" },
  { id: "getyourguide", name: "GetYourGuide", host: "getyourguide.com", category: "Travel" },
  { id: "klook", name: "Klook", host: "klook.com", category: "Travel" },
  { id: "accor", name: "Accor", host: "accor.com", category: "Travel" },
  { id: "radisson", name: "Radisson", host: "radissonhotels.com", category: "Travel" },
  { id: "motel6", name: "Motel 6", host: "motel6.com", category: "Travel" },
  { id: "laquinta", name: "La Quinta", host: "lq.com", category: "Travel" },
  { id: "europcar", name: "Europcar", host: "europcar.com", category: "Travel" },

  // Food delivery
  { id: "deliveroo", name: "Deliveroo", host: "deliveroo.com", category: "Delivery" },
  { id: "justeat", name: "Just Eat", host: "just-eat.co.uk", category: "Delivery" },
  { id: "menulog", name: "Menulog", host: "menulog.com.au", category: "Delivery" },
  { id: "skipthedishes", name: "SkipTheDishes", host: "skipthedishes.com", category: "Delivery" },
  { id: "swiggy", name: "Swiggy", host: "swiggy.com", category: "Delivery" },
  { id: "zomato", name: "Zomato", host: "zomato.com", category: "Delivery" },

  // Deals & software
  { id: "catch", name: "Catch", host: "catch.com.au", category: "Discount" },
  { id: "autodesk", name: "Autodesk", host: "autodesk.com", category: "Software" },
  { id: "norton", name: "Norton", host: "norton.com", category: "Software" },
  { id: "dropbox", name: "Dropbox", host: "dropbox.com", category: "Software" },
  { id: "onepassword", name: "1Password", host: "1password.com", category: "Software" },
  { id: "notion", name: "Notion", host: "notion.so", category: "Software" },
  { id: "figma", name: "Figma", host: "figma.com", category: "Software" },
  { id: "slack", name: "Slack", host: "slack.com", category: "Software" },
  { id: "zoom", name: "Zoom", host: "zoom.us", category: "Software" },
  { id: "asana", name: "Asana", host: "asana.com", category: "Software" },
  { id: "monday", name: "monday.com", host: "monday.com", category: "Software" },
  { id: "airtable", name: "Airtable", host: "airtable.com", category: "Software" },
  { id: "evernote", name: "Evernote", host: "evernote.com", category: "Software" },
  { id: "eset", name: "ESET", host: "eset.com", category: "Software" },
  { id: "bitdefender", name: "Bitdefender", host: "bitdefender.com", category: "Software" },
  { id: "malwarebytes", name: "Malwarebytes", host: "malwarebytes.com", category: "Software" },
  { id: "surfshark", name: "Surfshark", host: "surfshark.com", category: "Software" },
  { id: "kaspersky", name: "Kaspersky", host: "kaspersky.com", category: "Software" },

  // Music, photo, services & craft
  { id: "fender", name: "Fender", host: "fender.com", category: "Music" },
  { id: "reverb", name: "Reverb", host: "reverb.com", category: "Music" },
  { id: "musiciansfriend", name: "Musician's Friend", host: "musiciansfriend.com", category: "Music" },
  { id: "samash", name: "Sam Ash", host: "samash.com", category: "Music" },
  { id: "thomann", name: "Thomann", host: "thomann.de", category: "Music" },
  { id: "andertons", name: "Andertons", host: "andertons.co.uk", category: "Music" },
  { id: "keh", name: "KEH Camera", host: "keh.com", category: "Photo" },
  { id: "mpix", name: "Mpix", host: "mpix.com", category: "Photo" },
  { id: "snapfish", name: "Snapfish", host: "snapfish.com", category: "Photo" },
  { id: "angi", name: "Angi", host: "angi.com", category: "Services" },
  { id: "hellotech", name: "HelloTech", host: "hellotech.com", category: "Services" },
  { id: "blick", name: "Blick", host: "dickblick.com", category: "Craft" },
  { id: "papersource", name: "Paper Source", host: "papersource.com", category: "Craft" },
  { id: "cricut", name: "Cricut", host: "cricut.com", category: "Craft" },

  // International
  { id: "coupang", name: "Coupang", host: "coupang.com", category: "International" },
  { id: "shopee", name: "Shopee", host: "shopee.com", category: "International" },
  { id: "lazada", name: "Lazada", host: "lazada.com", category: "International" },
  { id: "mercadolibre", name: "Mercado Libre", host: "mercadolibre.com", category: "International" },
  { id: "trendyol", name: "Trendyol", host: "trendyol.com", category: "International" },
  { id: "jumia", name: "Jumia", host: "jumia.com", category: "International" },
  { id: "takealot", name: "Takealot", host: "takealot.com", category: "International" },
  { id: "snapdeal", name: "Snapdeal", host: "snapdeal.com", category: "International" },
  { id: "nykaa", name: "Nykaa", host: "nykaa.com", category: "International" },
  { id: "croma", name: "Croma", host: "croma.com", category: "International" },
  { id: "bigw", name: "Big W", host: "bigw.com.au", category: "International" },
  { id: "thewarehouse", name: "The Warehouse", host: "thewarehouse.co.nz", category: "International" },
  { id: "magazineluiza", name: "Magazine Luiza", host: "magazineluiza.com.br", category: "International" },
  { id: "zozo", name: "ZOZOTOWN", host: "zozo.jp", category: "International" },
  { id: "taobao", name: "Taobao", host: "taobao.com", category: "International" },
  { id: "tmall", name: "Tmall", host: "tmall.com", category: "International" },
  { id: "jd", name: "JD.com", host: "jd.com", category: "International" },

  // Added in 0.7: shops shoppers asked for, kept in the same shape as the rest
  // so host matching and saved codes need no special case.
  { id: "carhartt", name: "Carhartt", host: "carhartt.com", category: "Workwear" },
  { id: "duluthtrading", name: "Duluth Trading", host: "duluthtrading.com", category: "Workwear" },
  { id: "smartwool", name: "Smartwool", host: "smartwool.com", category: "Outdoor" },
  { id: "darntough", name: "Darn Tough", host: "darntough.com", category: "Outdoor" },
  { id: "osprey", name: "Osprey", host: "osprey.com", category: "Outdoor" },
  { id: "marmot", name: "Marmot", host: "marmot.com", category: "Outdoor" },
  { id: "mountainhardwear", name: "Mountain Hardwear", host: "mountainhardwear.com", category: "Outdoor" },
  { id: "burton", name: "Burton", host: "burton.com", category: "Outdoor" },
  { id: "kuhl", name: "Kühl", host: "kuhl.com", category: "Outdoor" },
  { id: "sportsmans", name: "Sportsman's Warehouse", host: "sportsmans.com", category: "Outdoor" },
  { id: "jensonusa", name: "Jenson USA", host: "jensonusa.com", category: "Outdoor" },
  { id: "competitivecyclist", name: "Competitive Cyclist", host: "competitivecyclist.com", category: "Outdoor" },
  { id: "pgatoursuperstore", name: "PGA TOUR Superstore", host: "pgatoursuperstore.com", category: "Outdoor" },
  { id: "lovesac", name: "Lovesac", host: "lovesac.com", category: "Home" },
  { id: "raymourflanigan", name: "Raymour & Flanigan", host: "raymourflanigan.com", category: "Home" },
  { id: "bobsdiscountfurniture", name: "Bob's Discount Furniture", host: "mybobs.com", category: "Home" },
  { id: "zenni", name: "Zenni Optical", host: "zennioptical.com", category: "Eyewear" },
  { id: "eyebuydirect", name: "Eyebuydirect", host: "eyebuydirect.com", category: "Eyewear" },
  { id: "glasses", name: "Glasses.com", host: "glasses.com", category: "Eyewear" },
  { id: "1800flowers", name: "1-800-Flowers", host: "1800flowers.com", category: "Gifts" },
  { id: "thebouqs", name: "The Bouqs Co.", host: "bouqs.com", category: "Gifts" },
  { id: "blueapron", name: "Blue Apron", host: "blueapron.com", category: "Grocery" },
  { id: "factor75", name: "Factor", host: "factor75.com", category: "Grocery" },
  { id: "hannaford", name: "Hannaford", host: "hannaford.com", category: "Grocery" },
  { id: "foodcity", name: "Food City", host: "foodcity.com", category: "Grocery" },

  // Added in 0.9: brands the panel was asked for, in the same shape as the rest
  // so nothing about host matching or saved codes needs a special case.
  { id: "pandora", name: "Pandora", host: "pandora.net", category: "Fashion" },
  { id: "swarovski", name: "Swarovski", host: "swarovski.com", category: "Fashion" },
  { id: "aesop", name: "Aesop", host: "aesop.com", category: "Beauty" },
  { id: "tula", name: "TULA", host: "tula.com", category: "Beauty" },
  { id: "versed", name: "Versed", host: "versedskin.com", category: "Beauty" },
  { id: "briogeo", name: "Briogeo", host: "briogeohair.com", category: "Beauty" },
  { id: "drunkelephant", name: "Drunk Elephant", host: "drunkelephant.com", category: "Beauty" },
  { id: "birchbox", name: "Birchbox", host: "birchbox.com", category: "Beauty" },
  { id: "fabfitfun", name: "FabFitFun", host: "fabfitfun.com", category: "Beauty" },
  { id: "loccitane", name: "L'Occitane", host: "loccitane.com", category: "Beauty" },
  { id: "cotopaxi", name: "Cotopaxi", host: "cotopaxi.com", category: "Outdoor" },
  { id: "fringesport", name: "Fringe Sport", host: "fringesport.com", category: "Fitness" },
  { id: "americangirl", name: "American Girl", host: "americangirl.com", category: "Kids" },
  { id: "jetbrains", name: "JetBrains", host: "jetbrains.com", category: "Software" },
  { id: "bodybuilding", name: "Bodybuilding.com", host: "bodybuilding.com", category: "Health" },
  { id: "redwing", name: "Red Wing", host: "redwingshoes.com", category: "Workwear" },
  { id: "dickies", name: "Dickies", host: "dickies.com", category: "Workwear" },
  { id: "sennheiser", name: "Sennheiser", host: "sennheiser.com", category: "Electronics" },
  { id: "rugsusa", name: "Rugs USA", host: "rugsusa.com", category: "Home" },
  { id: "cratejoy", name: "Cratejoy", host: "cratejoy.com", category: "Gifts" },
];

// Every entry may list one host or several regional hosts.
export function hostsOf(store) {
  return store.hosts || [store.host];
}

// A site is the same site with or without "www.", and the same goes for the
// sites the shopper enabled by hand, so hosts are compared in one shape.
function normalizeHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function hostOf(url) {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

function matchHost(host, candidates) {
  return candidates
    .map(normalizeHost)
    .filter((candidate) => candidate && (host === candidate || host.endsWith(`.${candidate}`)))
    .sort((a, b) => b.length - a.length)[0];
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
  // The most specific host wins, so a store's country site never falls back to
  // its .com entry.
  let known = null;
  let knownLength = 0;
  STORES.forEach((store) => {
    const match = matchHost(host, hostsOf(store));
    if (match && match.length > knownLength) {
      known = store;
      knownLength = match.length;
    }
  });
  if (known) return known;

  // A site the shopper enabled is stored under that same normalized host, so
  // www.example.com and example.com share one set of saved codes.
  const matchedSite = matchHost(host, Array.isArray(enabledSites) ? enabledSites : []);
  return matchedSite ? customStore(matchedSite) : null;
}

export function storeCount() {
  return STORES.length;
}

// Used by tools/check-catalog.mjs to keep manifest.json in sync.
export function matchesFor(host) {
  return [`*://*.${host}/*`, `*://${host}/*`];
}
