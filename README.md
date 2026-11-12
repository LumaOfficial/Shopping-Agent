# Shopping-Agent

## Browser support

`extension/` is one Manifest V3 savings extension for every browser that can run
one. The entire UI is a panel (toolbar click or `Alt+Shift+S`); nothing is
injected into the page except the small scripts that read the page you are on and
fill the store's own promo field.

| Browser | Package | Where the panel lives |
| --- | --- | --- |
| Chrome, Edge, Brave, Vivaldi, Arc, Chromium | `dist/chromium` | the browser's side panel |
| Opera 30 and later | `dist/opera` | Opera's sidebar rail |
| any other Chromium build, including older ones | `dist/chromium` | the panel in a small window |

Safari needs Apple's Xcode conversion of a WebExtension package and is not
packaged here.

### Build

```bash
cd extension && node tools/build.mjs                   # both packages
cd extension && node tools/build.mjs --target opera    # just one
```

`dist/` is not committed. Upload `dist/chromium` to the Chrome Web Store and the
Edge Add-ons store, and `dist/opera` to addons.opera.com.

Only the Opera manifest differs. Opera is Chromium underneath, so it keeps the
Manifest V3 service worker and the declarative net request rules, but it has no
Side Panel API — its sidebar is declared with Opera's own key, which is also what
puts the extension on the sidebar rail:

- `sidebar_action` (`default_panel`, `default_title`, `default_icon`) replaces
  Chrome's `side_panel`, and the `sidePanel` permission is dropped with it.
- `minimum_chrome_version` is dropped: the Opera store validates the manifest
  itself and its releases do not follow Chrome's version numbers.

`build.mjs` also drops `minimum_chrome_version` from `dist/chromium`, since the
Edge and Opera stores flag keys they know nothing about.

Both packages declare the Luma icons (`icons/`), so the toolbar, the extensions
page and Opera's sidebar rail show the product mark instead of a generic puzzle
piece.

Opera's sidebar API (`opr.sidebarAction`) can set a panel's title, icon and page
but cannot open or close the sidebar, so the toolbar button and `Alt+Shift+S`
open the panel in a small window. The panel also lives on Opera's sidebar rail —
click its icon there to dock it beside the page. Either way the panel reads the
active tab, so it fills in for the store you are on.

### Load it unpacked

1. Open `chrome://extensions`, `edge://extensions` or `brave://extensions` and
   enable **Developer mode**; in Opera open `opera://extensions` → **Developer
   mode** → **Load unpacked** → `dist/opera`.
2. Elsewhere: **Load unpacked** → select the `extension/` folder (or the built
   `dist/chromium`).
3. Open a store (Target, Amazon, Amazfit, …). The panel fills in for that store.
4. Already had the store tab open? Use **Reload tab** in the panel once — the
   browser only injects content scripts into pages loaded after install.

The panel names whichever browser you are in where the browser's own autofill is
involved ("Show Edge autofill", "Show Opera autofill", …); nothing else differs.

### Where codes come from

Codes need no setup: the panel reads them from the store page you are already
shopping on and re-reads it a few times while the page settles, since cart
drawers and banners often load late. Every candidate is validated before it is
shown — one shape per code, duplicates collapsed, expired or malformed entries
dropped, and reads from a sub-frame ignored. An authorized feed is optional and
only adds more.

Wording it recognizes includes "promo code: X", "code X", "use code X", "enter
X at checkout", "X for 20% off", "save 20% with X" and "take $10 off with X",
plus codes carried in `data-coupon-code` / `data-promo-code` / `data-voucher-code`
style attributes and coupon-labelled elements.

Every code the panel shows is one of:

| Source | Where it comes from |
| --- | --- |
| **works** | a code this store accepted earlier on this device |
| **feed** | the optional authorized offer endpoint configured in Settings |
| **yours** | a code you pasted and saved for that store |
| **on page** | a code the store itself publishes on the page you are viewing (automatic) |

There is no bundled coupon list: a store with no codes from any source shows an
empty list, and the extension never invents an offer.

### What works

- **Accounts keep money apart.** The panel opens on a signup or sign-in card.
  An account is a profile on this browser — full name, email, phone number, date
  of birth (18 or older to cash out) and a password stored only as a salted
  PBKDF2 hash. Cashback, savings and ad value are stored under that account's own
  key prefix, so two people sharing one browser never see or spend each other's
  balance, and signing out hides every figure again. The device remembers who
  signed in, so opening the panel does not ask for the password again; signing
  out is a second, deliberate tap on the account chip.
- **Codes only for the store you are on.** The panel resolves the tab's host
  against a catalog of **769 stores / 787 host patterns** (including regional
  Amazon, eBay and other domains). Any other page shows an empty state, plus a
  one-tap check that adds the site when the page proves it is a shop.
- **All stores, browsable** — the panel's *All stores* card lists the whole
  catalog, searchable by name, host or category and filterable by category, so
  a shopper can see what is covered and open a store from the list.
- **Popular stores and categories** — a shuffleable rail of ten popular stores
  (each one tap from its site) and a category grid that opens the All stores
  list already filtered, so the panel is useful before a store is visited.
- **Animate** — a full-screen trailer of the 50 best-known storefronts. It
  caches and decodes every mark first, then builds all three scenes before the
  film rolls: a progress dial that fills with the logos as they arrive, an
  orbit, a tilted logo wall and a mosaic, ending on the store count and a
  *Browse all stores* button. `prefers-reduced-motion` skips straight to the
  mosaic.
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
- **Scan on demand** — when the list is empty, **Scan this page again** re-reads
  the store page (and the optional feed, past its 10-minute cache) and reports
  what it found. It works with nothing configured.
- **Saved codes** — paste a code and it is applied, then kept per store, with
  delete.
- **Verified codes** — codes the store accepted are remembered per store and
  offered first next time, marked `works`.
- **Search / filter**, **Copy**, **Try all** (stops at the first code that lands).
- **Expiry** — codes past their `expires` date are dropped instead of offered.
- **Provenance strip** — which source answered ("Live page scan" by default), how
  fresh the read is, and the feed's own error text when one is connected and
  fails.
- **Cashback** — builds the network's tracked deep link so the purchase is
  attributed to the shopper. Cashback is paid by the network, never claimed by
  the extension.
- **Cashback wallet** — activating a cashback offer records the store's published
  rate against the cart total the page actually showed. The amount stays
  **pending** for the 30-day return window, then becomes **cashable**; a payout
  marks those entries **paid**, so the same cashback can never be cashed twice.
  The ledger lives on this device under `chrome.storage.local` key `cashback`,
  and it never adds different currencies together: the wallet works in the
  currency holding the most unpaid cashback and pays out only that currency.
- **Virtual Visa payouts** — Settings opens on **Simple**, where cashing out is one
  tap and asks for nothing: the extension posts a generic order (amount, currency,
  `deliveryMethod: "NONE"`) to the connected reward service and shows the plain
  outcome in place. No provider name, account or template id is needed there; the
  full Tango Card order (account, customer, UTID, platform credentials) is the
  **Developer** level's customisation.
- **Virtual Visa payouts (Developer)** — the wallet asks your payout proxy, which fronts
  Tango Card's order API, to issue a virtual Visa for the cashable balance. The
  order uses `deliveryMethod: "NONE"` so Tango returns a redemption link for the
  panel instead of emailing the shopper; the wallet stores the Tango
  `referenceOrderID` and that link. A full card number is never requested or
  stored, and the Tango Card platform credentials live in the extension settings
  or on the proxy — never in an export. With no proxy connected the cashable
  balance is issued as a **preview card** on this device: the one tap always
  finishes, and the wallet labels the result "Preview Virtual Visa — no cash
  value" so it is never mistaken for a real card. Cards are issued in USD, so a
  cashback balance in another currency stays in the wallet with an explanation
  rather than being sent as if it were dollars.
- **Payout service detection** — saving a proxy address probes it with a
  read-only `GET` (no order, nothing spent) and reports the host it found and the
  HTTP answer, so "Detected pay.example.com — ready to issue virtual Visa cards"
  is visible before the first cash out. Settings re-checks the saved address
  whenever it opens; the wallet shows that host once the proxy is connected.
  Rejected tokens, a wrong path and 5xx answers are named separately.
- **Earn extra (sponsored offers)** — an **Earn extra** block lists the sponsored
  offers your ad partner returns. Opening one takes the shopper to the
  advertiser in a new tab and asks the sponsor what it books for the visit; only
  the amount the sponsor confirms is added to the cashback wallet, as pending,
  once per offer. The panel never pays for a click on its own, and with no
  sponsor endpoint the block is hidden. Incentivising clicks on ordinary display
  ads breaks most ad networks' terms, so this must be a programme that pays for
  these visits itself.
- **Ad value** — the extension blocks ad and tracker requests with the
  declarative rules in `rules/ads.json` and hides the empty ad slots on the page,
  then shows what those impressions were worth instead of a coin balance. The
  rate is one display impression, **$0.03 per 5 ads** (`src/lib/ad-value.js`), so
  five blocked ads read `$0.03`. The panel's **Ad value** card shows the running
  value, the ads blocked today and all time, and the ads blocked on the page the
  shopper is on. Nothing is paid out by this figure — it is the advertising value
  kept off the page, and the wallet still holds only cashback the networks
  confirm. The switch in Settings stops both blocking and counting.
- **Savings record** — total of the order-total drops the page confirmed, number
  of codes that worked, products tracked. Stored locally.
- **Any shop, added on the spot** — for a site outside the catalog the panel
  asks for permission for that origin, reads what the page itself declares
  (schema.org store or product markup, a known shop platform such as Shopify or
  WooCommerce, a real cart or checkout), and either adds the site immediately —
  registering a persistent content script and turning the same tools on — or
  removes it again and says why. A site added this way gets a *Remove this site*
  control in the same card. A site is one site with or without `www.`, so
  `www.example.com` and `example.com` share their saved and verified codes.
- **Export / clear** — a JSON copy of local data (never the credentials), and a
  one-click wipe.
- **Checkout guidance** — when a page shows card fields, the panel offers a
  "Show Chrome autofill" / "Show Edge autofill" button that focuses the card
  field so **the browser's own** autofill appears. The extension never reads, stores, autofills or submits card
  numbers, expiry dates or security codes, and it never calls a checkout "safe".

### How a site gets added

There is no review queue and no site is added from a hostname guess. On a page
outside the catalog the panel's **Check & add this site** button asks for that
origin's permission (the click is the gesture the browser requires), then the
service worker reads the page's own evidence:

| Evidence | Where it comes from |
| --- | --- |
| Store markup | `schema.org` JSON-LD with a store type (`Store`, `OnlineStore`, …) |
| Product markup | JSON-LD `Product` with an `Offer`, or an Add-to-cart control next to a cart |
| Shop platform | Shopify, WooCommerce, BigCommerce, Magento, PrestaShop, Squarespace, Shopware |
| Cart / checkout | a visible link to the page's own cart or checkout |

Store markup, a shop platform, a product with a real offer, or a working
add-to-cart beside a cart must be present *and* the combined evidence must reach
the threshold, which is what keeps a blog or a review page with an affiliate
product snippet out. When it passes, the site is added immediately: a persistent content
script is registered, the host joins the enabled list, the name and category the
page declared are stored, and the same tools are injected into the open tab. When
it does not pass, nothing is added and any earlier record of the site is removed,
with the reason shown in the card.

The name comes from the page (`og:site_name`, the store's JSON-LD name, or the
title) and the category is *Added by you*. An added site can be removed again
from the same card; that unregisters the content script and drops it from the
enabled list, while saved codes stay on the device.

### Accounts and money

The panel will not show a balance until someone is signed in. Signup collects
what a payout partner needs to pay a real person — full name, email, phone
number and date of birth, with 18 as the age gate for cashing out — plus a
password of at least 8 characters. The date of birth is stored as the date you
entered it and only ever read back to compute the age.

Accounts live on this browser and nowhere else:

| What | Where it lives |
| --- | --- |
| Account records | `chrome.storage.local`, key `accounts` |
| Password | PBKDF2-SHA-256, 120 000 iterations, 16-byte random salt per account; only the hash is stored |
| Session | `chrome.storage.local`, key `session` — kept until you sign out. Untick **Keep me signed in on this device** and it goes to `chrome.storage.session` instead, which the browser empties when it quits |
| Wallet, savings, ad value, codes, prices | `acct:<account id>:<name>` keys |

Signed out, figures are written under a `guest:` prefix that nothing displays, so
an unattributed balance can never be read as someone else's. The first account
created on a browser takes over any `guest:` figures, so a balance earned before
accounts existed is not lost. **Clear data** in Settings removes only the
signed-in account's keys.

Because there is no server, an account does not sync between browsers or
devices, and there is no password reset — a forgotten password cannot be
recovered from a hash, so the account's balance has to be recovered by signing
up again. Cross-device accounts would need a backend with an email
verification flow; nothing in the extension currently talks to one.

### Face age check: 18+ and the 3% boost

Cashing out asks for more than a typed date of birth. The panel guides your head
through a few angles, checks what it saw, and unlocks cash outs plus a **3% boost
on new cashback earnings** only once a verdict is stored against the account.

**The check needs no key and nothing set up.** With no relay configured it runs
on this device (`src/lib/age-local.js`). The live camera preview is analysed a few
times a second, so the card says whether a face is actually in the frame —
*looking for your face*, *face found* — instead of guessing when the button was
pressed, and the small head model on screen turns to the angle being asked for.
The scan asks for straight-on, then left, right and up (`src/lib/face-rotate.js`):
the face has to hold each angle for a moment before it is kept, a turn the wrong
way is answered with a correction, and an angle that is never reached simply does
not count. Each kept angle reads the biggest face-shaped patch of skin in the
frame (its size, outline, fill and facial detail).

**The model is the double check.** The kept angles are compared as one temporary
face model — the same face, in the same light, really having moved between them.
If they do not agree, nothing is submitted and the card asks for the angles
again; a scan is never allowed to reach the worker on a model that failed. The
angles are dropped as soon as the check is over: only the verdict is stored.

The numbers are judged in the service worker, so the panel never marks an account
verified on its own, and the movement between the angles stands in for the second
frame that used to prove a person rather than a photo of one. Where a camera
cannot be opened at all — no device, or the browser refuses it — the scan
continues with the device's own camera app or a photo, so the card never
dead-ends on an error. It is a liveness check against the date of birth the
account was opened with, not a third-party age estimate, and the card says
exactly that.

A provider-backed estimate is optional and only worth adding if you want one. A
small relay holds the provider's credentials, and the extension only ever
receives a verdict:

```
panel ──one still frame──▶ relay (holds provider key) ──▶ face provider
      ◀── verdict only ───                                (frame discarded)
```

Run the relay yourself — it has no dependencies beyond Node 18:

```bash
AGE_PROVIDER=huggingface HF_TOKEN=hf_… node server/age-verify.mjs
# or
AGE_PROVIDER=azure-face AZURE_FACE_KEY=… AZURE_FACE_ENDPOINT=https://westus.api.cognitive.microsoft.com node server/age-verify.mjs
```

Both are free to start: Hugging Face's inference API works from a free account
token (`HF_MODEL` defaults to an age classifier), and Azure AI Face has a free F0
tier (its limited-access form has to be approved first). Then paste the relay's
address under **Settings → Developer → Face age check**; `http://localhost:8787`
is accepted for a relay on your own machine, anything else has to be `https://`.

| Concern | How it is handled |
| --- | --- |
| Face images | Taken in the panel as a single 512 px frame, sent to the relay, passed to the provider, then dropped. Nothing is written to disk or logged. |
| What is stored | `acct:<id>:ageCheck` — the verdict, the provider's name, its reference and the timestamp. No image, no face template. |
| The 18+ margin | The estimate has to reach 21 before it counts as proof, so a frame one year either way does not let someone through. Between 16 and 21 comes back `unclear` and can be tried again. |
| The 3% boost | Added when a new cashback earning is recorded for a verified account, and kept as its own figure on that entry. Balances banked before verification do not change, and an entry is only ever boosted once. |
| No relay configured | The on-device check runs instead: two frames measured in the panel, judged in the worker, and no picture leaving the browser. |
| Trust | The verdict arrives from the relay, not from the page, and the payout and boost are applied in the service worker. As with the rest of this extension the wallet itself lives on the device, so a person who edits their own storage owns the consequences. |

An automated age estimate is not a legal identity check. It is a reasonable gate
for a cashback balance; if you need a document check, drop in a provider that
returns a verified attribute and map it in `server/age-verify.mjs`.

### Privacy: card data

Payment fields are detected from field *attributes* only (`autocomplete`, `name`,
`id`, `placeholder`, `aria-label`). No field value is ever read. Card details stay
between the shopper, the browser and the merchant.

### Security model

A browser extension ships as readable source. Anyone who installs it has the
code, so nothing here is protected by being hidden — each protection works even
when the attacker has read every line, opened the panel's console and pointed the
extension at a page of their own.

**What is in the repo:** no key, token or password. Every credential is entered
by the operator or shopper, stored in that browser profile, and sent only to the
host they named. There is no bundled offer data either, so the code has nothing
worth extracting.

**One door into the worker.** `chrome.runtime.onMessage` is the only way to make
the extension do anything, and every message is checked before a handler runs
(`src/lib/guard.js`):

| Check | Why it matters |
| --- | --- |
| `sender.id` must be this extension | Another extension cannot drive the worker. A web page cannot at all: there is no `externally_connectable`, and nothing is `web_accessible`. |
| A page's content script may send only `ads:report` | The page can influence what its content script says, so that is the one message it can produce — and it cannot reach settings, clearing or a payout. A sender URL decides this, not the presence of a tab, so the settings page opened in a tab keeps its full access. |
| A content-script message must arrive from a tab | The browser only injects a content script into a tab, so a message that claims to come from a page but carries no tab is refused before its payload is read. |
| Credentials are blanked for every reader but the settings page | `settings:get` returns a sanitized copy with every key and token emptied unless the caller is `options.html`, so the panel can read how the age check is wired without ever holding a secret it could replay. |
| Each handler's payload is checked first | A page address has to be `http(s)`, a cart total has to be a finite number, an ad count is an integer inside a range, a code has to match the code pattern, and clearing needs an explicit `confirm: true`. |
| Repeated actions are capped per session | Ad reports, settings writes, exports and payouts are throttled, so no page can inflate a figure or issue two cards by looping one message. |

**Ad value has a ceiling of its own.** The count of blocked ads becomes money in
the wallet, and the count arrives from a page, so a page that fills itself with
fake ad slots must not be able to mint a balance. One report carries at most 200
ads, a single tab is credited at most 600 for the session, and a day stops at
2,000 — about $12 at the rate the panel quotes. A report over those figures is
credited only as far as the ceiling allows; nothing is silently rounded up.

**Settings are an allowlist.** `sanitizeSettings` keeps only the keys in
`DEFAULTS`, so an injected key — including `__proto__` — is dropped rather than
merged. Addresses must be HTTPS, or plain HTTP on `127.0.0.1`/`localhost` while a
relay is being built; a URL carrying credentials (`https://user:pass@…`) is
refused. The options page says which field it refused instead of saving it
silently.

**Accounts.** A password is never stored: signup keeps a per-account random salt
and a PBKDF2-SHA-256 hash at 210,000 rounds, compared in constant time. Passwords
that are the first an attacker tries — a common word, one character repeated, a
run off the keyboard or the alphabet — are refused at signup with a message
saying so. Five wrong passwords pause sign-in for 30 seconds and each further
miss doubles the pause, up to 15 minutes. Attempts are counted under a hash of
the email, so the address typed is not kept. Sessions are `chrome.storage.local`
(kept between reloads) or `chrome.storage.session` (cleared on quit) — the
panel's "keep me signed in" box chooses. A session also ends on its own: a week
after it was last used, or a month after the password was typed, whichever comes
first, so a session copied off a shared machine stops working without anyone
having to notice. Daily use slides the idle clock forward.

**Rendering.** Nothing from a page, feed or relay is ever put through
`innerHTML`: the panel builds text nodes, so a coupon title is a coupon title and
never markup. Extension pages declare `default-src 'self'; script-src 'self';
object-src 'none'; base-uri 'none'; form-action 'none'` — no remote script, no
`<object>`, no `<base>` rewriting the page's own addresses, and no form that can
post what is on screen somewhere else. Images stay limited to the extension, a
`data:`/`blob:` URL the page made, and HTTPS.

**Face frames.** A frame is measured and dropped, or posted to the relay the
operator configured and discarded there. The verdict is re-judged in the worker
from the numbers the panel measured, so the panel cannot mark an account
verified. When a relay *is* configured, the on-device scan is refused rather than
accepted as a shortcut past it, and both paths are throttled so a scan cannot be
retried in a loop until one lands the right answer.

What this cannot do: a person with full control of their own browser profile can
edit their own storage and give themselves a number. The accounts, wallet and
verdict are device-local by design — there is no server to check them against —
so the model protects the operator's credentials and other people's data, not a
user from themselves.

### Files

| File | Role |
| --- | --- |
| `sidepanel.html` / `sidepanel.js` | The whole UI |
| `src/background/service-worker.js` | Only code that calls partner endpoints; caches the feed per store; validates the source; stores saved/verified codes, price points and savings |
| `src/content/content.js` | Frame-aware bridge: `page:scan`, `page:clip`, `coupon:probe`, `coupon:apply`, `checkout:probe`, `checkout:focus` (attributes only) |
| `src/content/coupon-engine.js` | Promo-field autofill + outcome detection |
| `src/content/page-scan.js` | Published codes, clip coupons, product/price reading |
| `src/content/site-detect.js` | What the page declares about itself as a shop: structured data, platform, cart/checkout |
| `src/content/ad-guard.js` | Hides the page's ad slots and counts them, one report per page |
| `rules/ads.json` | Declarative ruleset that blocks ad and tracker requests |
| `src/lib/ad-value.js` | What a blocked ad is worth, and the running ad record |
| `src/lib/accounts.js` | Signup validation, salted password hashing, the session, and the per-account key prefix every money figure sits under |
| `src/lib/age-verify.js` | Face age check: consent copy, the relay call, the verdict shape, the 18+ margin and the boost figure |
| `src/lib/age-local.js` | The on-device check that needs no provider and no key: frame measurement, the liveness comparison and the verdict rules |
| `src/lib/face-rotate.js` | The guided rotation: which angle is being asked for, whether the face has reached it, and whether the kept angles hold together as one face |
| `src/lib/age-panel.js` | The age check card: disclosure, the guided camera scan (or a photo) and what came back |
| `src/lib/site-add.js` | Add-or-remove decision from that evidence, plus the store's display name |
| `src/lib/site-request.js` | Normalizes the tab's host into the site key |
| `src/lib/stores.js` | Merchant catalog and host matching |
| `src/lib/panel-extras.js` | Popular-store rail and category tiles, both from the catalog |
| `src/lib/logo-show.js` | The *Animate* trailer: cache, decode, build, then orbit → wall → mosaic |
| `src/lib/brand-marks.js` | The popular storefronts the trailer leads with, and their brand inks |
| `src/lib/codes.js` | One code shape, de-duplication order, expiry rule |
| `src/lib/guard.js` | The trust boundary: who sent a message, which addresses and figures are allowed, constant-time hash compare, per-action rate caps |
| `src/lib/settings.js` | Stored settings defaults, and the allowlist that sanitizes them on the way in |
| `src/lib/format.js` | Money (minor units), relative times |
| `src/lib/copy.js` | All "Partner Platforms" wording |
| `src/lib/browser.js` | Which browser is running, for the autofill wording |
| `src/lib/compat.js` | Points `chrome` at `browser` where only that is promise-based |
| `src/partners/offers-feed.js` | Authorized offer feed → normalized codes |
| `src/partners/cashback-network.js` | Tracked deep-link builder |
| `src/partners/cashback-ledger.js` | Cashback wallet: pending → cashable → paid, in minor units |
| `src/partners/cashback-payout.js` | Virtual Visa order — generic from Simple, Tango Card through your proxy from Developer |
| `src/partners/sponsor-offers.js` | Sponsored offers → normalized ads, and the sponsor's booked reward |
| `src/partners/price-history.js` | Optional product API 90-day low |
| `tools/check-catalog.mjs` | Keeps `manifest.json` hosts in sync with the catalog |
| `tools/build.mjs` | Builds `dist/chromium/` and `dist/opera/` from this source |

### Connector configuration

Options page (`options.html`), stored per device, no credential in the repo. None
of it is required for coupon codes — those come from the page automatically; the
feed below only adds more of them.

The page is split into three levels, opening on the one last used:

- **Simple** — the on/off switches in plain words, the cashback balance and one
  "Get a virtual Visa" tap. No endpoints, tokens or identifiers. When the balance
  reaches the minimum the tap always finishes: with a reward service connected it
  asks that service for a card, and without one it issues a preview card labelled
  as having no cash value.
- **Advanced** — the optional coupon feed, the cashback network template, the
  product API key and local data (export / clear).
- **Developer** — payout proxy and Tango Card credentials, sponsored offers and
  partner wording.

The page has a **Back** button at the top: it closes the settings tab, or returns
to the savings panel when the page is shown without a tab to close.

`options.html#payouts` opens the Developer level and scrolls to the payout fields.
The wallet in the panel no longer needs it to cash out.

- **Extra coupon feed (optional)** — JSON you are authorized to query, `{store}` substituted:
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
  also accepted, and a coupon list may be published as `coupons`, `codes` or
  `offers` — a feed may also answer with just this store's coupons. Leave it
  blank and the panel works from the page alone.
- **Authentication** — `Bearer token`, or `Basic` (username + password, the form
  Oxylabs uses). Credentials stay in `chrome.storage.local` on the device and are
  sent only to the configured host, which is why saving asks for optional host
  access to that origin.
- **Test connection** — one request to the source, reporting: connected and how
  many store offers, credentials rejected (401/403), an HTTP error, or
  unreachable.
- **Links are http(s) only** — a feed's `trackingUrl` (like the tracked link
  template) is opened only when it is an `http(s)` address; anything else is
  ignored.
- **Tracked link template** — e.g.
  `https://click.example-network.com/deeplink?id={siteId}&murl={url}`. With no
  template the Activate button says "Not configured" instead of pretending.
- **Product API key** — optional; adds the 90-day low from the documented API.
- **Payout proxy endpoint** — your hosted proxy in front of Tango Card's
  `POST /raas/v2/orders`. The extension sends it a Tango Card order body with the
  proxy token:
  ```json
  { "externalRefID": "savings-e_lx2k3ab-800", "customerIdentifier": "your-customer",
    "accountIdentifier": "your-account", "utid": "U1234", "amount": 8,
    "deliveryMethod": "NONE", "notes": "Savings cashback payout",
    "platformName": "your-platform", "platformKey": "…" }
  ```
  `platformName` and `platformKey` are included only when you enter them in the
  settings; they go to that one proxy endpoint over HTTPS and nowhere else. The
  proxy authenticates to Tango Card with them — or with its own credentials when
  they are left blank — and forwards the order to
  `https://api.tangocard.com/raas/v2/orders`, then returns Tango's order response
  unchanged:
  ```json
  { "referenceOrderID": "…", "rewardName": "Visa® Virtual Account",
    "reward": { "credentials": { "redemptionUrl": "https://…", "expirationDate": "…" },
                "credentialList": [ … ] } }
  ```
  The extension keeps `referenceOrderID` and the redemption link, and shows
  Tango's `errors[].message` when the order is refused (401/403, 402 for an
  unfunded account, 429, validation). `deliveryMethod: "NONE"` fulfils the
  reward without emailing a recipient; `externalRefID` is stable per cashable
  balance, so a retry is idempotent. No endpoint means cash out stays
  unavailable.
- **Payout settings** — the Tango Card platform name and platform key, plus the
  account identifier, customer identifier and the virtual Visa reward's UTID. The
  platform key is a password field held in `chrome.storage.local`, sent only to an
  `https://` proxy endpoint (saving is refused for a plain-`http://` address) and
  stripped from every export. Leave it blank if your proxy keeps its own
  credentials.
- **Detect payout service** — probes the proxy address you typed and reports the
  host it reached, so a working connection is confirmed in Settings rather than
  discovered at the first cash out.
- **Minimum payout** — cashback below this amount stays in the wallet
  (default $5).
- **Sponsor endpoint** — the service that lists the ads and books what a visit
  pays. One URL, two calls, `reward` and `amount` in minor units:
  ```json
  GET  -> { "offers": [ { "id": "ad_12", "advertiser": "Nordic Outdoors",
                          "title": "New season", "reward": 25, "currency": "USD",
                          "url": "https://…", "expiresAt": "2026-12-01" } ] }
  POST { "offerId": "ad_12" }
       -> { "amount": 25, "currency": "USD", "status": "pending",
            "confirmAt": 1767225600000 }
  ```
  The sponsor decides what a visit is worth: a POST reply with no positive
  `amount` pays nothing and the panel says so. The extension adds one wallet
  entry per `offerId` and never values a click itself. An expired offer is not
  shown; `status: "available"` skips the hold, anything else stays pending until
  `confirmAt`. Credentials are a bearer token in `chrome.storage.local`, sent
  only to the configured host, and are left out of the export.

### Adding merchants

Add an entry to `STORES` in `src/lib/stores.js`, then:

```bash
cd extension && node tools/check-catalog.mjs --write
```

That rewrites the `content_scripts.matches` list from the catalog so the store
actually activates. `node tools/check-catalog.mjs` (no flag) verifies the two
agree and exits non-zero when they do not.

### Checks

The face check and the boost it unlocks have a suite in `test/`, run in Node with
no browser, camera or network:

```bash
cd extension && node --test test/*.test.mjs
```

It imports the real service worker behind a stubbed `chrome` API (`test/fake-chrome.mjs`)
and sends it the same messages the panel sends, then reads the wallet back. The
frames come from `test/frames.mjs`, drawn in memory and measured by the real
detector in `src/lib/age-local.js`. What it confirms:

- an account with no verdict earns the plain rate — $100 at 5% records a 500-cent
  earning with no boost;
- a scan that clears the check (two frames of a person moving) unlocks the boost
  on the next earning only — 15 extra cents on the same cart — and leaves the
  earning recorded before the check at 500;
- the boost is 3% of the base and stays in whole cents ($12.34 → 62 + 2 = 64);
- a relay verdict unlocks the same boost as an on-device scan;
- a frame with no face, and a still photo (identical second frame), are both
  refused and leave the next earning unboosted;
- the verdict is stored against the account, so a second account on the same
  browser earns the plain rate until it is checked itself;
- the guided rotation reads a turn on the side the mirrored preview shows,
  answers a turn the wrong way with a correction, and keeps a tilt up;
- a set of angles that never moved, and a scan that stopped halfway, are not a
  face model and are refused before anything is submitted.

The security rules have their own suite in `test/security.test.mjs`, driven the
same way — real worker, real messages, no browser. What it confirms:

- another extension, and a sender with no id at all, cannot change settings or
  read data;
- a content script may report ads and nothing else, while the settings page
  opened in a tab keeps its full access;
- an unknown message type is refused without being echoed back;
- a settings object with an injected `__proto__` or an unknown key stores only
  the known keys and leaves the shared prototype untouched;
- a plain-HTTP endpoint is dropped, HTTPS and a loopback listener are kept, and
  an impossible payout minimum falls back to the default;
- clearing data needs `confirm: true`;
- an ad count of 100000 or −4 is refused, so a page cannot inflate what it is
  paid for;
- a page address has to be `http(s)` — `javascript:` and `file:` are refused;
- five wrong passwords pause sign-in even for the right password, and the stored
  account holds a salted hash with no trace of the plaintext.

The pure modules and both content scripts are covered by tests that also run in
Node with jsdom: the coupon engine is driven against fixture cart pages —
success, rejection, shadow DOM, no field, ignored search/gift-card inputs — and
the side panel is exercised against a stubbed `chrome` API.

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
