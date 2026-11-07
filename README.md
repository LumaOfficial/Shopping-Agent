# Shopping-Agent
Work in progress...

## Chrome extension

`extension/` is a Manifest V3 savings extension. On a supported merchant site it
finds the store's promo-code field, applies codes for the shopper, offers the
cashback link, and (on product pages) shows the 90-day price low. Everything is
sourced through connectors described as **Partner Platforms** in the UI — the
extension never names a partner brand to the shopper.

Not a web app: nothing is served on port 3000, so the sandbox preview stays
empty. Load it unpacked instead:

1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** → select the `extension/` folder.
3. Visit a supported store (see `extension/src/lib/stores.js`); the savings panel
   appears bottom-right and the toolbar icon shows the same offers.

### How it is put together

| File | Role |
| --- | --- |
| `src/background/service-worker.js` | Only code that talks to partner endpoints; caches per page for 10 minutes |
| `src/content/content.js` | Shadow-DOM savings panel injected on merchant pages |
| `src/lib/coupon-engine.js` | Finds promo field + apply button, types the code with native setters and real events, then reads the page's own confirmation/error text |
| `src/partners/offers-feed.js` | Coupons + cashback rates from a live feed, falling back to the demo catalog |
| `src/partners/cashback-network.js` | Builds the tracked deep link the cashback network attributes to the shopper |
| `src/partners/price-history.js` | Product API (Keepa-compatible) 90-day low |
| `src/lib/stores.js` | Merchant allowlist (`id`, `name`, `host`, `category`) |
| `src/lib/copy.js` | All "Partner Platforms" wording |

### Connector configuration

Settings live in the extension options page and are stored per device with
`chrome.storage.local`. Nothing is hardcoded and no credential ships with the
repo.

- **Offer feed URL** — JSON, `{store}` is substituted (e.g. `target`). Expected
  response, either for one store or keyed by store id:
  ```json
  {
    "stores": {
      "target": {
        "cashback": { "rate": "4%", "trackingUrl": "https://…" },
        "coupons": [{ "code": "SPRING15", "title": "15% off", "expires": "2026-05-01" }]
      }
    }
  }
  ```
  Without a feed the bundled `src/data/sample-offers.json` is used and the UI
  labels every code **demo** — those codes are examples and will not apply.
- **Tracked link template** — e.g.
  `https://click.example-network.com/deeplink?id={siteId}&murl={url}`. Cashback is
  paid by the network; the extension only attributes the visit. With no template
  the Activate button reports "not configured" instead of pretending to track.
- **Product API key** — enables the 90-day-low section on product pages.

### Adding merchants

Add an entry to `STORES` in `src/lib/stores.js` **and** the matching
`*://*.host/*` pattern to `content_scripts.matches` in `manifest.json`. Merchant
pages are the only sites the extension injects into.

### Partner integration status

The coupon/cashback aggregation for the referenced partner services is not
available as a public API, so this extension does not scrape them and does not
claim a live connection. A real deployment needs an affiliate/aggregator
agreement that hands back the feed and tracked-link template above. Price
history is wired to the documented product API and works as soon as a key is
entered. The member count in the footer is intentionally blank until the
operator enters a figure they can substantiate.
