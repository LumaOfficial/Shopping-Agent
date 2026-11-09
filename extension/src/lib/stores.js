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
