# Shopping-Agent
Work in progress...

## Chrome extension

`extension/` is a Manifest V3 savings extension. The entire UI is a **side panel**
(toolbar click opens it); nothing is injected into the page except the small
script that fills the store's own promo-code field.

Load it unpacked:

1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** → select the `extension/` folder.
3. Click the toolbar icon on a supported store; the side panel opens.

It is not a web app, so nothing is served on port 3000 for the sandbox preview.

### What it does

- **82 stores** (`src/lib/stores.js`): marketplaces, big-box, fashion, beauty,
  pets, home, electronics, grocery, pharmacy, travel and delivery.
- **Coupon apply** — the side panel sends the code to the content script, which
  finds the promo field, types it with native setters + real input/change
  events, clicks the store's own Apply button, then decides the outcome from the
  page: a drop in the order total or the store's success text means applied; the
  store's error text means rejected; anything else is reported as unconfirmed
  rather than as a win.
- **Try all** walks every code for the store; each row reports its own result.
- **Your own codes** — paste a code into the box and it is applied the same way.
  Codes the store accepts are remembered per store (`chrome.storage.local`) and
  offered again later with a `works` chip.
- **Cashback** — builds the network's tracked deep link so the purchase is
  attributed to the shopper. Cashback is paid by the network, never claimed by
  the extension.
- **Price history** — 90-day low and current price on product pages.
- **Offer provenance** — the panel shows which source answered (authorized feed or
  demo catalog) and when it was fetched, with a Refresh button; it never presents
  a demo code as a live offer.
- **Checkout guidance** — when a page shows card fields, the panel offers a
  "Show Chrome autofill" button that focuses the card field so **Chrome's own**
  autofill appears. The extension never reads, stores, autofills or submits card
  numbers, expiry dates or security codes, and it never calls a checkout "safe".

### Privacy: card data

Payment fields are detected from field *attributes* only (`autocomplete`, `name`,
`id`, `placeholder`, `aria-label`). No field value is ever read. Card details stay
between the shopper, Chrome and the merchant.

### Files

| File | Role |
| --- | --- |
| `sidepanel.html` / `sidepanel.js` | The whole UI |
| `src/background/service-worker.js` | Only code that calls partner endpoints; caches per page; validates the source; stores verified codes |
| `src/content/content.js` | Thin bridge: `coupon:probe`, `coupon:apply`, `checkout:probe`, `checkout:focus` (attributes only, never field values) |
| `src/lib/coupon-engine.js` | Promo-field autofill + outcome detection |
| `src/partners/offers-feed.js` | Coupons + cashback rates from a live feed, else the demo catalog |
| `src/partners/cashback-network.js` | Tracked deep-link builder |
| `src/partners/price-history.js` | Product API (Keepa-compatible) 90-day low |
| `src/lib/stores.js` | Merchant allowlist |
| `src/lib/copy.js` | All "Partner Platforms" wording |

### Connector configuration

Options page (`options.html`), stored per device, no credential in the repo.

- **Source endpoint** — JSON you are authorized to query, `{store}` substituted:
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
  Without a feed the bundled `src/data/sample-offers.json` is used and every code
  is marked **demo** in the panel. Those codes are examples and stores reject them.
- **Authentication** — `Bearer token`, or `Basic` (username + password, the form
  Oxylabs uses). Credentials stay in `chrome.storage.local` on the device and are
  sent only to the configured host, which is why saving asks for optional host
  access to that origin.
- **Test connection** — sends one request to the source and reports what came
  back: connected and how many store offers, credentials rejected (401/403), an
  HTTP error, or unreachable. A source that is not configured says so instead of
  quietly falling back to demo data.
- **Tracked link template** — e.g.
  `https://click.example-network.com/deeplink?id={siteId}&murl={url}`. With no
  template the Activate button says "Not configured" instead of pretending.
- **Product API key** — enables the price-history section.

### Adding merchants

Add an entry to `STORES` in `src/lib/stores.js` **and** the matching
`*://*.host/*` pattern to `content_scripts.matches` in `manifest.json`. Merchant
pages are the only sites the extension runs on.

### Partner integration status

The extension does not scrape partner services. Their coupon/cashback data comes
from private endpoints behind their terms of service, so re-selling or
redistributing it from a browser extension is unauthorized access, and it breaks
whenever they change anything.

Oxylabs is supported as an **authorized data-access provider**, not as permission
to reach any particular merchant: the extension sends its own request to the
endpoint you configure, with the credentials you provide, and it makes no attempt
to bypass a site's access controls. Because Oxylabs' scraping API answers
asynchronously by query id, the connector expects an endpoint that returns the
JSON shape above (your own proxy/service in front of it is the usual way to do
that). A real deployment needs an affiliate/aggregator
agreement that returns the feed and tracked-link template above; those two
settings are the only integration points. Price history uses the documented
product API and works as soon as a key is entered. The member count in the footer
stays blank until the operator enters a figure they can substantiate.
