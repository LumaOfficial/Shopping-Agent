# Shopping-Agent

## Browser support

`extension/` is one Manifest V3 savings extension for every browser that can run
one. The entire UI is a panel (toolbar click or `Alt+Shift+S`); nothing is
injected into the page except the small scripts that read the page you are on and
fill the store's own promo field.

| Browser | Package | Where the panel lives |
| --- | --- | --- |
| Chrome, Edge, Brave, Opera, Vivaldi, Arc, Chromium | `dist/chromium` | the browser's side panel |
| Firefox 128+ | `dist/firefox` | Firefox's sidebar |
| any other Chromium build, including older ones | `dist/chromium` | the panel in a small window |

Safari needs Apple's Xcode conversion of a WebExtension package and is not
packaged here.

### Build

```bash
cd extension && node tools/build.mjs                     # both packages
cd extension && node tools/build.mjs --target firefox    # just one
```

`dist/` is not committed. Upload `dist/chromium` to the Chrome Web Store, and the
same package to the Edge Add-ons and Opera stores; upload `dist/firefox` to
addons.mozilla.org.

Only the Firefox manifest differs, because Manifest V3 in Firefox has no
background service worker (the same file is loaded as an event page) and no Side
Panel API (the panel is declared as a `sidebar_action` instead). AMO also
requires a `browser_specific_settings.gecko.id` — replace the placeholder with
your own. `data_collection_permissions` is declared as `browsingActivity` because
the offer request carries the store you are on to the feed you configured; set it
to `none` if your feed never receives anything about the page. `web-ext lint`
reports no errors on the package — its three warnings are the guarded Side Panel
calls, which never run outside Chromium.

Firefox does not reopen the sidebar by itself when you switch back to a tab it was
open on, so click the toolbar button or press `Alt+Shift+S`; if another extension
owns that shortcut, reassign it in `about:addons` → gear → **Manage Extension
Shortcuts**.

### Load it unpacked

1. Open `chrome://extensions`, `edge://extensions`, `brave://extensions` or
   `opera://extensions` and enable **Developer mode**; in Firefox open
   `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
   `dist/firefox/manifest.json`.
2. Elsewhere: **Load unpacked** → select the `extension/` folder (or the built
   `dist/chromium`).
3. Open a store (Target, Amazon, Amazfit, …). The panel fills in for that store.
4. Already had the store tab open? Use **Reload tab** in the panel once — the
   browser only injects content scripts into pages loaded after install.

The panel names whichever browser you are in where the browser's own autofill is
involved ("Show Edge autofill", "Show Firefox autofill", …); nothing else differs.

### Where codes come from

Every code the panel shows is one of:

| Source | Where it comes from |
| --- | --- |
| **feed** | the authorized offer endpoint configured in Settings |
| **on page** | a code the store itself publishes on the page you are viewing |
| **yours** | a code you pasted and saved for that store |
| **works** | a code this store accepted earlier on this device |

There is no bundled coupon list: a store with no codes from any source shows an
empty list, and the extension never invents an offer.

### What works

- **Codes only for the store you are on.** The panel resolves the tab's host
  against a catalog of **359 stores / 371 host patterns** (including regional
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
- **Cashback wallet** — activating a cashback offer records the store's published
  rate against the cart total the page actually showed. The amount stays
  **pending** for the 30-day return window, then becomes **cashable**; a payout
  marks those entries **paid**, so the same cashback can never be cashed twice.
  The ledger lives on this device under `chrome.storage.local` key `cashback`.
- **Virtual Visa payouts** — the wallet asks the payout service configured in
  Settings to issue a virtual Visa for the cashable balance and stores the
  reference and, when the service returns them, the last four digits and a
  redemption link. A full card number is never requested or stored. With no
  service connected there is nothing to issue, so cash out stays unavailable.
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
| `src/lib/browser.js` | Which browser is running, for the autofill wording |
| `src/lib/compat.js` | Points `chrome` at `browser` where only that is promise-based |
| `src/partners/offers-feed.js` | Authorized offer feed → normalized codes |
| `src/partners/cashback-network.js` | Tracked deep-link builder |
| `src/partners/cashback-ledger.js` | Cashback wallet: pending → cashable → paid, in minor units |
| `src/partners/cashback-payout.js` | Virtual Visa payout request |
| `src/partners/price-history.js` | Optional product API 90-day low |
| `tools/check-catalog.mjs` | Keeps `manifest.json` hosts in sync with the catalog |
| `tools/build.mjs` | Builds `dist/chromium/` and `dist/firefox/` from this source |

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
- **Payout service endpoint** — receives
  `POST {"method":"virtual_visa","amount","currency","earnings":["e_…"]}` with
  the bearer token, and answers:
  ```json
  { "card": { "reference": "PO-77", "brand": "Visa", "last4": "4123",
              "expiresAt": "03/29", "redeemUrl": "https://…" } }
  ```
  `reference` is required; the rest is optional. The request carries the earning
  ids being paid so the service can verify them before it issues a card. No
  endpoint means cash out stays unavailable.
- **Minimum payout** — cashback below this amount stays in the wallet
  (default $5).

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

The cashback wallet has its own Node test (also kept out of the repo): rate
parsing, the 30-day hold, pending → cashable → paid, and the payout request
against a local stub service — request body, bearer header, 401, a response with
no card, and an unreachable host.

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
