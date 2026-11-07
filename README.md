# Shopping-Agent

## Chrome and Microsoft Edge extension

`extension/` is a Manifest V3 savings extension that runs unchanged in **Chrome**
and **Microsoft Edge** — one source, both browsers. The entire UI is a **side panel**
(toolbar click or `Alt+Shift+S` opens it); nothing is injected into the page except
the small scripts that read the page you are on and fill the store's own promo
field.

It is not a web app, so nothing is served on port 3000 for the sandbox preview.

Load it unpacked:

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge) and enable
   **Developer mode**.
2. **Load unpacked** → select the `extension/` folder.
3. Open a store (Target, Amazon, Amazfit, …). The panel fills in for that store.
4. Already had the store tab open? Use **Reload tab** in the panel once — the
   browser only injects content scripts into pages loaded after install.

The panel names whichever browser you are in where the browser's own autofill is
involved ("Show Chrome autofill" / "Show Edge autofill"); nothing else differs.

### Microsoft Edge package

Edge 116 or later runs `extension/` as-is, so there is no second copy of the
code. For the Edge Add-ons store the package is built from the same source, with
the Chrome-only `minimum_chrome_version` key dropped — the Edge partner center
validates the manifest itself and reports properties it does not know:

```bash
cd extension && node tools/build-edge.mjs
```

That writes `dist/edge/` (not committed). Load it unpacked in `edge://extensions`,
or zip it and upload the zip to the Microsoft Edge Add-ons partner center.

Two Edge sidebar behaviours to expect: Edge does not reopen the sidebar by itself
when you switch back to a tab it was open on (MicrosoftEdge-Extensions issue
#142) — click the toolbar icon or press `Alt+Shift+S`; and if another extension
already owns that shortcut, reassign it in `edge://extensions/shortcuts`.

### No bundled offers

There is no sample catalog in this repository. Every code the panel shows is one of:

| Source | Where it comes from |
| --- | --- |
| **feed** | the authorized offer endpoint configured in Settings |
| **on page** | a code the store itself publishes on the page you are viewing |
| **yours** | a code you pasted and saved for that store |
| **works** | a code this store accepted earlier on this device |

With none of those, the panel says so and shows no codes. A store page with no
configured feed and no published code legitimately shows an empty list — the
extension never invents an offer.

### What works

- **Codes only for the store you are on.** The panel resolves the tab's host
  against a catalog of **112 stores / 124 host patterns** (including regional
  Amazon, eBay and other domains). Any other page shows an empty state, plus an
  option to enable the extension on that site.
- **Coupon apply** — the side panel sends the code to the content script, which
  finds the promo field (searching open shadow roots too, and skipping search,
  zip, gift-card and card fields), types it with native setters and real
  input/change events, clicks the store's own Apply button (or presses Enter),
  then decides from the page: a drop in the order total, a new discount line, or
  the store's own success text means applied; the store's error text means
  rejected; anything else is reported as unconfirmed rather than as a win.
- **Frame-aware** — carts and checkouts are often iframes. The scripts run in
  every frame and the frame holding the promo field answers.
- **Clip on-page coupons** — detects the store's own "Clip coupon" style
  controls (Amazon and similar) and clicks them on request.
- **Page code detection** — reads codes the store publishes ("Use promo code
  SAVE20") with context, and ignores prose, prices and stopwords.
- **Local price tracking** — every product page you visit records the price you
  saw (JSON-LD, meta or the page's own price node) on this device, and the panel
  reports the lowest price it has seen for that product. No API key needed.
- **Optional product API** — a Keepa-compatible key adds a 90-day low.
- **Saved codes** — paste a code and it is applied, then kept per store, with
  delete.
- **Verified codes** — codes the store accepted are remembered per store and
  offered first next time, marked `works`.
- **Search / filter**, **Copy**, **Try all** (stops at the first code that lands).
- **Expiry** — codes past their `expires` date are dropped instead of offered.
- **Provenance strip** — which source answered, how fresh it is, and the feed's
  own error text when it fails.
- **Cashback** — builds the network's tracked deep link so the purchase is
  attributed to the shopper. Cashback is paid by the network, never claimed by
  the extension.
- **Savings record** — total of the order-total drops the page confirmed, number
  of codes that worked, products tracked. Stored locally.
- **Use on any site** — for stores outside the catalog the panel asks for
  permission for that origin, registers a persistent content script and turns the
  same tools on there.
- **Export / clear** — a JSON copy of local data (never the credentials), and a
  one-click wipe.
- **Checkout guidance** — when a page shows card fields, the panel offers a
  "Show Chrome autofill" / "Show Edge autofill" button that focuses the card
  field so **the browser's own** autofill appears. The extension never reads, stores, autofills or submits card
  numbers, expiry dates or security codes, and it never calls a checkout "safe".

### Privacy: card data

Payment fields are detected from field *attributes* only (`autocomplete`, `name`,
`id`, `placeholder`, `aria-label`). No field value is ever read. Card details stay
between the shopper, the browser and the merchant.

### Files

| File | Role |
| --- | --- |
| `sidepanel.html` / `sidepanel.js` | The whole UI |
| `src/background/service-worker.js` | Only code that calls partner endpoints; caches the feed per store; validates the source; stores saved/verified codes, price points and savings |
| `src/content/content.js` | Frame-aware bridge: `page:scan`, `page:clip`, `coupon:probe`, `coupon:apply`, `checkout:probe`, `checkout:focus` (attributes only) |
| `src/content/coupon-engine.js` | Promo-field autofill + outcome detection |
| `src/content/page-scan.js` | Published codes, clip coupons, product/price reading |
| `src/lib/stores.js` | Merchant catalog and host matching |
| `src/lib/codes.js` | One code shape, de-duplication order, expiry rule |
| `src/lib/settings.js` | Stored settings defaults, shared by worker and options |
| `src/lib/format.js` | Money (minor units), relative times |
| `src/lib/copy.js` | All "Partner Platforms" wording |
| `src/lib/browser.js` | Chrome or Edge, for the autofill wording |
| `src/partners/offers-feed.js` | Authorized offer feed → normalized codes |
| `src/partners/cashback-network.js` | Tracked deep-link builder |
| `src/partners/price-history.js` | Optional product API 90-day low |
| `tools/check-catalog.mjs` | Keeps `manifest.json` hosts in sync with the catalog |
| `tools/build-edge.mjs` | Builds `dist/edge/` (same source, Edge-safe manifest) |

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
  An array of `{ "store": "target", … }` entries, or a single store's object, is
  also accepted. Without a feed the panel shows only page-published and saved
  codes, and says so.
- **Authentication** — `Bearer token`, or `Basic` (username + password, the form
  Oxylabs uses). Credentials stay in `chrome.storage.local` on the device and are
  sent only to the configured host, which is why saving asks for optional host
  access to that origin.
- **Test connection** — one request to the source, reporting: connected and how
  many store offers, credentials rejected (401/403), an HTTP error, or
  unreachable.
- **Tracked link template** — e.g.
  `https://click.example-network.com/deeplink?id={siteId}&murl={url}`. With no
  template the Activate button says "Not configured" instead of pretending.
- **Product API key** — optional; adds the 90-day low from the documented API.

### Adding merchants

Add an entry to `STORES` in `src/lib/stores.js`, then:

```bash
cd extension && node tools/check-catalog.mjs --write
```

That rewrites the `content_scripts.matches` list from the catalog so the store
actually activates. `node tools/check-catalog.mjs` (no flag) verifies the two
agree and exits non-zero when they do not.

### Checks

The pure modules and both content scripts are covered by tests that run in Node
with jsdom (kept out of the repo): the coupon engine is driven against fixture
cart pages — success, rejection, shadow DOM, no field, ignored search/gift-card
inputs — and the service worker and side panel are exercised against a stubbed
`chrome` API.

```bash
cd extension && node tools/check-catalog.mjs
```

### Partner integration status

The extension does not scrape partner services. Their coupon/cashback data comes
from private endpoints behind their terms of service, so redistributing it from a
browser extension is unauthorized access and breaks whenever they change
anything.

Oxylabs is supported as an **authorized data-access provider**, not as permission
to reach any particular merchant: the extension sends its own request to the
endpoint you configure, with the credentials you provide, and it makes no attempt
to bypass a site's access controls. Because Oxylabs' scraping API answers
asynchronously by query id, the connector expects an endpoint that returns the
JSON shape above (your own proxy/service in front of it is the usual way to do
that). A real deployment needs an affiliate/aggregator agreement that returns the
feed and tracked-link template above; those two settings are the only integration
points. The member count in the footer stays blank until the operator enters a
figure they can substantiate.
