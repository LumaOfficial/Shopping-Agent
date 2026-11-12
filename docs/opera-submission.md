# Opera submission review — Luma Pay Shopping Agent

This is our own review of the packaged Opera build against the criteria Opera publishes for
add-ons. It is **not** an Opera review, an approval, or a promise of acceptance, and a pass here
does not mean a moderator will pass it. Opera reviews each submission itself and can reject a
package that satisfies every line below.

Reviewed against these pages, read on 12 November 2026:

- Acceptance criteria — <https://help.opera.com/en/extensions/acceptance-criteria/>
- Publishing guidelines — <https://help.opera.com/en/extensions/publishing-guidelines/>
- Opera add-ons Terms of Service — <https://addons.opera.com/developer/terms/>

The package under review is `dist/opera`, built with:

```bash
cd extension && node tools/build.mjs --target opera
```

## What the operator is confirming

The review below maps each criterion to what the package actually does, and names the file that
proves it. Two things have to be true before upload and only a person can confirm them:

1. The description and summary entered in the submission form say the same things the package does
   (this document drafts them in "Listing copy" below).
2. The extension still behaves this way in the build that is uploaded — rebuild and re-read the
   code if anything changed since this review.

## Criteria, mapped

| Opera criterion | What the package does | Evidence | Status |
| --- | --- | --- | --- |
| One clearly stated purpose | One purpose: help a shopper save money in the store they are already in — codes, cashback, price history, sponsored offers, ad value credited to the same wallet | `extension/manifest.json` (name, description), `README.md` "What works" | **Attention** — see finding 1 |
| Name must not suggest a non-affiliated company | "Luma Pay Shopping Agent" is our own brand; no browser vendor's name appears in the title | `extension/manifest.json` `name`; `extension/terms.html` §2 | Met |
| Summary answers what the extension does | Description: "Coupons, cashback and price history while you shop. Blocks ad slots and credits their value. Never reads card details." | `extension/manifest.json` `description`; asserted in `test/opera-package.test.mjs` | Met |
| Background actions described | Ad-slot blocking and the value it credits are named in the description, and the panel's first screen explains them before anything runs | `extension/manifest.json`, `extension/sidepanel.html` terms card | Met |
| No external JavaScript | Every script ships in the package; no page loads a remote script | `manifest.json` CSP `script-src 'self'`; `grep -n '<script' extension/*.html` shows only packaged files | Met |
| Third-party libraries genuine and unchanged | None are bundled; the extension has no dependencies at runtime | `extension/test/*.test.mjs` run on plain Node with no packages | Met |
| No unused files | `tools/` and `test/` are left out of the package, and the Chromium panel module is written over in the Opera build then deleted | `tools/build.mjs`; `test/opera-package.test.mjs` | Met |
| No redundant permissions | Each permission below is used; `sidePanel` is dropped from the Opera build | `tools/build.mjs` `operaManifest()`; table below | Met |
| No ads in content scripts | Content scripts inject no advertising. The panel shows sponsored offers; the page script hides ad slots and counts them | `src/content/ad-guard.js`, `src/partners/sponsor-offers.js` | Met |
| Must not change referral parameters or misappropriate traffic | No link on a page is rewritten. A tracked link is built from the operator's own template only when the shopper taps Activate | `src/partners/cashback-network.js`; no `href =` write in `src/content/` | Met |
| Must not collect private information without authorisation | The panel does nothing until the shopper ticks an empty box and agrees to the terms; the tick, its version and its date are stored | `src/lib/terms.js`, `extension/sidepanel.html`, `extension/terms.html` §1 | Met |
| Must not send private data to an external store through XHR | Outbound calls go only to addresses the operator or shopper configured, HTTPS only, and only for the feature that was used | `src/partners/*`, `guard.endpoint()` in `src/lib/guard.js`, `test/security.test.mjs` | Met |
| Code must not be obfuscated or minified | Plain ES modules, comments included, no build step beyond the manifest | `dist/opera` is a copy of `extension/` | Met |
| No obvious bugs | 50 Node tests cover the trust boundary, accounts, wallet, age check and the package; catalog check passes | `cd extension && node --test test/*.test.mjs` → 50 pass; `node tools/check-catalog.mjs` → agree | Met in Node; see "Not verified here" |
| Icons similar in style, not words on a colour | Five PNG sizes from one mark | `extension/icons/` | Met |
| Testing on Windows, Mac and Linux | — | — | **Operator** |
| Screenshots 612×408, white background, default UI | — | — | **Operator** |
| Support page relevant to the extension | — | — | **Operator** |

## Permissions, and why each is asked for

| Permission | Why it is needed | Where it is used |
| --- | --- | --- |
| `storage` | Accounts, session, settings, wallet, prices and the terms acceptance | `src/lib/accounts.js`, `settings.js`, `terms.js` |
| `tabs` | Read the active tab's address so the panel knows which shop is open; open the terms, a payout card and a store in a tab | `sidepanel.js` `render()`, `openTerms()`, `options.js` |
| `scripting` | Register the page script for a shop the shopper chose to add, and inject it into the frames of a shop page (carts live in iframes) | `src/background/service-worker.js` |
| `declarativeNetRequest` | Stop requests to advertising and tracker domains for the ad-value feature | `rules/ads.json` |
| `sidePanel` (Chromium only) | Puts the panel in the Chromium side panel; **not** in the Opera package | removed by `tools/build.mjs` |
| Host `*://*/*` | Recognise the shop the shopper opened, read the codes and prices that page publishes, fill the store's own promo field, hide empty ad slots | `manifest.json` `content_scripts`, `host_permissions` |
| Host `https://api.keepa.com/*` | Optional 90-day price low, only when a product API key is entered | `src/partners/price-history.js` |

The broad host access is requested because these features cannot work without it — not because a
store requires it, and the package says so in the panel and in the terms (§5). If a reviewer asks
whether the extension could ship without it, the honest answer is: only by dropping offer
detection and code autofill on shops it does not already know, which is the product.

## Findings

### 1. One-goal policy: the ad-blocking switch is the one thing to explain

Opera's criteria list "Additional bundling of shopping assistants" as a prohibited behaviour
example, so a moderator will look at everything the panel does and ask whether it is one product or
several. Coupons, cashback, price history and sponsored offers are all the same job — saving money
in the store the shopper is already in. The one capability that sits outside that job is a page
ad blocker, which the extension keeps on by default because the value it blocks is credited to the
shopper's wallet.

What the package does about it:

- the ad switch is one switch in the settings, and turning it off stops blocking entirely;
- the panel's first screen and the terms (§6) describe it as part of how the product is paid for,
  not as a separate utility;
- the page script only hides ad slots and counts them; it injects nothing and touches nothing else
  on the page;
- the listing description names it, so the submission form matches the behaviour.

This is a judgement call for Opera, not something the code can settle. If the package is rejected on
this point, the smallest honest change is to ship the Opera build with the switch off until the
shopper turns it on — one line in `extension/src/lib/settings.js`
(`enabled: { adBlock: false }`) — and say so in the listing. Do not remove the disclosure to get
past review.

### 2. Remote image in the panel — fixed

The empty-state card used to load a JPEG from a third-party media CDN, which meant a request to a
host that has nothing to do with the shopper and a graphic the package did not carry. It now ships
`art/empty-fold.svg` in the package. Re-check with:

```bash
grep -rn 'src="https\?' extension/*.html   # nothing in the panel
```

### 3. Terms acceptance must stay a gate, not a banner

Opera's data-processing criterion is about authorisation. The gate is `src/lib/terms.js`: an
acceptance only counts when it carries the current version and a real timestamp, and the panel
shows nothing else until it does. Keep it that way — a change that shows the panel before consent,
pre-ticks the box, or treats a stored `true` as agreement breaks the disclosure this submission
relies on.

### 4. The face scan asks, then keeps only a verdict

The optional 18+ check is the one place the package asks for a device the manifest does not
mention, so it is worth reading against the "collect private information without authorisation"
criterion.

- **Asked, not assumed.** The camera opens only from the panel's own button, and only after an
  empty tick box (`#age-agree`) is checked; `render()` keeps that button disabled until then
  (`src/lib/age-panel.js`). The manifest declares no camera permission and no host permission for
  a device — `getUserMedia` is called at that moment and nowhere else.
- **Ended deliberately.** The stream is stopped when the scan finishes, when Cancel is pressed, when
  the account signs out, and when the camera track itself ends; nothing keeps the lens open in the
  background.
- **Never stored.** Frames exist as one scratch canvas for the length of a measurement. The guided
  angles are compared as a temporary model in `src/lib/face-rotate.js` and dropped. What is written
  is the verdict alone — state, provider name, reference, time (`src/lib/age-verify.js`). No image
  and no face template reaches `chrome.storage`, the account record, or any server:
  `test/face-rotate.test.mjs` drives a complete scan through the real service worker and asserts
  what the account holds afterwards.
- **Said on screen, before the camera.** The consent facts shown above the box state that nothing
  leaves the device with no relay configured, and name the relay when one is
  (`consentFacts()` in `src/lib/age-verify.js`). They match `extension/terms.html` §11 — change one
  and the other has to change too.

There is one path off the device: a relay the operator configures in the options page
(`relayConfigured()`), which is disclosed in those facts. With no relay there is no request at all.

## Listing copy this review assumes

Entered in the submission form, so the form and the package describe the same product.

- **Name:** Luma Pay Shopping Agent
- **Summary:** Luma Pay Shopping Agent finds coupon codes, cashback offers and price history while
  you shop, blocks ad slots and credits their value to your wallet, and never reads card details.
- **Description:** Luma Pay Shopping Agent adds a panel to your browser. Open a shop and the panel
  shows the codes that shop publishes, cashback rates from cashback programmes, and how the price
  has moved. You choose a code and the panel types it into the store's own promo field and tells you
  whether the store accepted it — it never checks out or pays for anything. With ad blocking on, the
  panel stops advertising requests, hides the empty slots, and credits an estimated share of their
  value to your wallet. The panel explains what it needs site access for, and asks you to agree to
  its terms, before it does anything. Accounts, codes, prices and balances are stored in this
  browser profile; card numbers are never read.
- **Category:** Shopping

## Submission checklist

- [ ] `cd extension && node tools/build.mjs --target opera` on the commit being submitted
- [ ] `cd extension && node --test test/*.test.mjs` — all pass
- [ ] `cd extension && node tools/check-catalog.mjs` — catalog and manifest agree
- [ ] Load `dist/opera` unpacked in Opera and confirm the panel opens from the sidebar rail and from
      the toolbar button, and that the first screen is the terms card with an empty tick box
- [ ] Tick, accept, create an account, open a shop, and confirm codes are found and the ad-value card
      fills in
- [ ] Turn ad blocking off in the settings and confirm blocking stops
- [ ] Run the face scan once (or cancel it): the camera opens only after the tick box, and the
      consent facts on screen match `extension/terms.html` §11
- [ ] Screenshots at 612×408, white background: one of the panel in use, one showing where the
      extension sits in the browser
- [ ] Support page published, relevant to the extension, and reachable
- [ ] Privacy policy published and consistent with `extension/terms.html` §13
- [ ] Name, summary and description entered exactly as "Listing copy" above
- [ ] No "Opera" in the title, the listing or the icons

## Not verified here

- The package running in real Opera on Windows and macOS — only Chromium-based Node tests ran.
- Payout with a live reward service, cashback confirmation with a live programme, and the face age
  check against a live relay: all need the operator's own accounts and endpoints.
- Whether Opera will accept the one-goal argument in finding 1. That is the review.
