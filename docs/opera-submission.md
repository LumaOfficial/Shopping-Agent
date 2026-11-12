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

**Revision 2 — 12 November 2026.** What changed in the package since revision 1, all of it from
reading the criteria again:

- the standing `*://*/*` host permission and the all-sites content script are gone: the extension
  now asks for the shops in its catalog (the content-script list) and for one origin at a time when
  the shopper adds a shop or the operator saves a partner endpoint (`optional_host_permissions`);
- the ad-slot script runs with the shop script instead of on every page, and it now stops when the
  ad-blocking switch is off — "off" used to stop the network rules while the page script kept
  hiding and counting slots;
- the manifest summary is a complete sentence and no longer says blocked ad value is credited as
  money, which is the line a reviewer reads as misappropriating advertising revenue;
- the CSP allows data to leave only over HTTPS or to a loopback listener, instead of every address;
- `extension/test/manifest-compliance.test.mjs` asserts the mechanical criteria below, so a later
  edit cannot quietly re-broaden access or reintroduce minified code.

**Revision 3 — 12 November 2026.** A second pass over the whole package, asking of each criterion
"would a reviewer see this in the build?". What changed:

- **Nothing acts before the gate.** The ad-blocking ruleset was declared `enabled: true`, so
  requests to advertising domains were stopped from install — before the shopper had read the
  notice or agreed to anything, which contradicts terms §1 and the panel's own promise that nothing
  runs until the box is ticked. It is now declared off and turned on by the service worker only for
  a profile that has agreed and left the switch on; `src/content/consent.js` holds the ad-slot
  script back on the same record; `ads:report` refuses to credit anything without it.
- **The privacy policy ships.** `privacy.html` is in the package, linked from the notice card, the
  terms and the settings page, and written to match terms §13 (and §5, §8, §11, §12). It replaces
  the "publish something later" line in the checklist with a document that can be reviewed now.
- **A support page ships.** `support.html` covers opening the panel, first run, what each feature
  does, what to check when it does nothing, and how to reach us — the relevant support page the
  metadata criterion asks for, with a URL still to be entered in the form.
- **The disclosure now matches the export.** Terms §13 said **Export a copy** gives "everything it
  holds", while `exportData()` deliberately leaves credentials out. §13 now says what the export
  contains; the version is 1.2, so the panel asks again.
- **A stray `</article>`** at the end of `terms.html` is gone; `test/policies.test.mjs` now asserts
  every packaged page closes `article`, `section` and `div` as often as it opens them.
- The test suite grew from 59 to 69: the gate's effect on the ruleset, the ad credit refusal, the
  page-script gate, the version agreement between the terms and the privacy page, and the markup
  balance.

**Revision 4 — 12 November 2026.** Features added after revision 3, each checked for what a
reviewer would ask about it:

- **One new permission: `alarms`.** It exists solely for the hourly savings-list pass. It reads no
  page, holds no data, is used by `src/background/service-worker.js`, and stops when automatic
  refresh is switched off. Declared and asserted in `test/manifest-compliance.test.mjs`.
- **A savings list ships, with no invented codes.** `src/lib/catalog.js` holds storewide mechanics
  the store itself runs (loyalty schemes, outlet rails, price-match policies), shown apart from
  codes. A row may carry an end date and drops out when it passes. A code appears in the codes list
  only when the store publishes it on the page, when the shopper saved it, when an authorized feed
  supplies it, or when an operator publishes it to the optional list URL — never because it was
  made up.
- **Automatic refresh, disclosed.** The hourly pass re-reads the list, prunes codes whose end date
  passed and refreshes the optional feed. It is a timer, not a background crawler; Settings says
  what it does and can turn it off.
- **A first-run tour.** Seven steps explain codes, cashback, prices, the optional face scan, ads and
  the shopper's desktop. It is dismissed or skipped with a tap, and replayed from Settings.
- **The face scan no longer asks anyone to lean back.** A close-up face may fill up to 94% of the
  frame, the oval is generous, and a close-up needs less travel to prove a turn. The only distance
  prompt left is a gentle "ease back an inch or two" for a face that fills the whole frame.
- **Windows, macOS and Linux are checked without the machines.** `tools/emulate-platforms.mjs`
  runs the shipped modules under seven emulated desktops; `test/platform.test.mjs` asserts the
  desktop strings, shortcuts, tour copy and the close-up scan. This is emulation of browser signals,
  not a run on physical hardware — the operator row below says so.
- **The suite is now 84 tests**, including the savings list, the hourly pass, the tour and the
  platform matrix.

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
| One clearly stated purpose | One purpose: help a shopper save money in the store they are already in — codes, cashback, price history, sponsored offers, ad slots hidden in the shops it covers | `extension/manifest.json` (name, description), `README.md` "What works" | **Attention** — see finding 1 |
| Name must not suggest a non-affiliated company | "Luma Pay Shopping Agent" is our own brand; no browser vendor's name appears in the title | `extension/manifest.json` `name`; `extension/terms.html` §2 | Met |
| Summary answers what the extension does | Description: "Luma Pay Shopping Agent finds coupons, cashback and price history while you shop, and hides ad slots in the shops it covers." — two complete sentences, 124 characters | `extension/manifest.json` `description`; `test/manifest-compliance.test.mjs` | Met |
| Background actions described | Ad-slot hiding is named in the summary; the network-level ad blocking, what it does to a page's ads and how it is switched off are in terms §5 and §6, and the panel's first screen explains them before anything runs | `extension/manifest.json`, `extension/terms.html`, `extension/sidepanel.html` terms card | Met |
| No external JavaScript | Every script ships in the package; no page loads a remote script | `manifest.json` CSP `script-src 'self'`; `test/manifest-compliance.test.mjs` | Met |
| Third-party libraries genuine and unchanged | None are bundled; the extension has no dependencies at runtime | `extension/test/*.test.mjs` run on plain Node with no packages | Met |
| No unused files | `tools/` and `test/` are left out of the package, the Chromium panel module is written over in the Opera build then deleted, and every file left is named by another packaged file | `tools/build.mjs`; `test/opera-package.test.mjs`, `test/manifest-compliance.test.mjs` | Met |
| No redundant permissions | Each permission below is used by a named file; `sidePanel` is dropped from the Opera build; there is no standing access to every site | `tools/build.mjs` `operaManifest()`; `test/manifest-compliance.test.mjs`; table below | Met |
| No ads in content scripts | Content scripts inject no advertising. The panel shows sponsored offers; the shop script hides ad slots and counts them | `src/content/ad-guard.js`, `src/partners/sponsor-offers.js` | Met |
| Must not change referral parameters or misappropriate traffic | No link on a page is rewritten. A tracked link is built from the operator's own template only when the shopper taps Activate. Ad value is an estimate the operator pays, never an advertiser's money | `src/partners/cashback-network.js`; no `href =` write in `src/content/`; terms §6 | Met |
| Must not collect private information without authorisation | Nothing acts before the shopper ticks an empty box and agrees: the panel stays on its notice, the ad-blocking ruleset is declared off and only the worker turns it on for an agreed profile, the ad-slot script reads the same record before it hides or counts, and ad credit is refused without it | `src/lib/terms.js`, `src/content/consent.js`, `src/background/service-worker.js` `syncAdBlock()`, `manifest.json` ruleset, `test/policies.test.mjs`, `test/security.test.mjs` | Met |
| Must not send private data to an external store through XHR | Outbound calls go only to addresses the operator or shopper configured, over HTTPS or to a loopback listener, and only for the feature that was used | `src/partners/*`, `guard.endpoint()` in `src/lib/guard.js`, `test/security.test.mjs` | Met |
| Code must not be obfuscated or minified | Plain ES modules and classic scripts, comments included, no build step beyond the manifest; asserted with no line over 500 characters and no `eval` | `dist/opera` is a copy of `extension/`; `test/manifest-compliance.test.mjs` | Met |
| No obvious bugs | 84 Node tests cover the trust boundary, accounts, wallet, age check, the savings list and its hourly pass, the tour, the platform matrix, the gate's hold on blocking and credits, the disclosure pages, the packaged manifest and the package itself; catalog check passes | `cd extension && node --test test/*.test.mjs` → 84 pass; `node tools/emulate-platforms.mjs` → 7/7; `node tools/check-catalog.mjs` → agree | Met in Node; see "Not verified here" |
| Icons similar in style, not words on a colour | Five PNG sizes from one mark — the four the manifest declares (16/32/48/128) and the 96px sidebar icon — all RGBA and non-interlaced, none a wordmark | `extension/icons/`; sizes and PNG headers asserted in `test/manifest-compliance.test.mjs`; decoded and inspected at 16 and 32px | Met |
| Testing on Windows, Mac and Linux | The shipped modules are driven under emulated Windows, macOS, Linux and ChromeOS browser signals — detection, shortcut, tour copy, close-up face scan and store resolution all agree — but this is not a run on physical hardware | `tools/emulate-platforms.mjs` (7/7), `test/platform.test.mjs` | Met by emulation; a physical-device pass is **Operator** |
| Screenshots 612×408, white background, default UI | — | — | **Operator** |
| Support page relevant to the extension | `support.html` ships in the package: opening the panel, first run, each feature, what to check when one does nothing, and how to reach us. No external links | `extension/support.html`, linked from `options.html`; `test/policies.test.mjs` | Met in the package; the listing URL is **Operator** |

## Permissions, and why each is asked for

| Permission | Why it is needed | Where it is used |
| --- | --- | --- |
| `storage` | Accounts, session, settings, wallet, prices and the terms acceptance | `src/lib/accounts.js`, `settings.js`, `terms.js` |
| `tabs` | Read the active tab's address so the panel knows which shop is open; open the terms, a payout card and a store in a tab | `sidepanel.js` `render()`, `openTerms()`, `options.js` |
| `scripting` | Register the page script for a shop the shopper chose to add, and inject it into the frames of a shop page (carts live in iframes) | `src/background/service-worker.js` |
| `declarativeNetRequest` | Stop requests to advertising and tracker domains for the ad-value feature | `rules/ads.json` |
| `alarms` | Run the hourly savings-list pass: re-read the list, drop rows whose end date passed, refresh the optional feed. Reads no page and can be switched off | `src/background/service-worker.js` `scheduleRefresh()`, `refreshCatalog()` |
| `sidePanel` (Chromium only) | Puts the panel in the Chromium side panel; **not** in the Opera package | removed by `tools/build.mjs` |
| Host access via `content_scripts` | The 787 shop host patterns in the catalog: recognise the shop the shopper opened, read the codes and prices that page publishes, fill the store's own promo field, hide and count empty ad slots | `manifest.json` `content_scripts` (one entry, five files); kept in step with `src/lib/stores.js` by `tools/check-catalog.mjs` |
| `optional_host_permissions` `*://*/*` | Granted **one origin at a time**, only on a click: a shop the shopper adds themselves, or a partner endpoint the operator saves (feed, payout proxy, sponsor service, age relay) | `sidepanel.js` `checkSite()`, `options.js` `ensureHost()` |
| Host `https://api.keepa.com/*` | Optional 90-day price low, only when a product API key is entered | `src/partners/price-history.js` |

There is no standing access to every website. Page scripts run only on the merchant domains the
catalog lists, and anything outside it is read only after the browser asks the shopper for that one
origin, which is why the panel's add-a-shop button is a click and not a background read. The
package says the same thing in the panel and in terms §5. Blocking advertising requests is the one
thing that acts beyond those pages, and it is a network rule, disclosed as such in terms §5: it
stops requests to a published list of advertising and tracker domains, reads no page, and stops
entirely when the switch is off.

## Findings

### 1. One-goal policy: the ad-blocking switch is the one thing to explain

Opera's criteria list "Additional bundling of shopping assistants" as a prohibited behaviour
example, so a moderator will look at everything the panel does and ask whether it is one product or
several. Coupons, cashback, price history and sponsored offers are all the same job — saving money
in the store the shopper is already in. The one capability that sits outside that job is an ad
blocker, which the extension keeps on by default because the value it blocks is credited to the
shopper's wallet.

What the package does about it:

- the ad switch is one switch in the settings, and turning it off now stops everything: the network
  ruleset stops blocking and the page script stops hiding and counting (`src/content/ad-guard.js`
  reads the switch before its first pass);
- the ad-slot script runs only on the shops in the catalog, with the shop script — the package no
  longer runs a script on every site, so this is not a general-purpose page blocker;
- the panel's first screen and the terms (§6) describe it as part of how the product is paid for,
  not as a separate utility;
- the page script only hides ad slots and counts them; it injects nothing and touches nothing else
  on the page;
- the summary says ad slots are hidden in the shops it covers, so the submission form and the
  manifest describe the same behaviour.

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
  you shop, and hides ad slots in the shops it covers. It never reads your card details.
- **Description:** Luma Pay Shopping Agent adds a compact panel beside the page — a short stack of
  soft, rounded cards in the sidebar (or the side panel in other Chromium browsers). Open a shop
  and the panel shows the codes that shop publishes, cashback rates from cashback programmes, and
  how the price has moved. You choose a code and the panel types it into the store's own promo field and tells you
  whether the store accepted it — it never checks out or pays for anything. In the shops it covers,
  with ad blocking on, it also stops requests to advertising and tracker domains, hides the empty
  slots they leave behind, and shows what that space was worth in your wallet; switching ad blocking
  off stops all of it. The panel explains what it needs site access for — the shops in its catalog,
  and one site at a time when you add a shop yourself — and asks you to agree to its terms before it
  does anything; the terms, the privacy policy and a support page are all one link away from that
  notice and ship inside the package. Accounts, codes, prices and balances are stored in this
  browser profile; card numbers are never read.
- **Category:** Shopping

## Submission checklist

- [ ] `cd extension && node tools/build.mjs --target opera` on the commit being submitted
- [ ] `cd extension && node --test test/*.test.mjs` — all 59 pass
- [ ] `cd extension && node tools/check-catalog.mjs` — catalog and manifest agree, and it reports no
      content script outside the catalog and no all-sites host permission
- [ ] Load `dist/opera` unpacked in Opera and confirm the panel opens from the sidebar rail and from
      the toolbar button, and that the first screen is the terms card with an empty tick box, the
      **Privacy policy** link beside **Read the full terms**, and **Agree and continue** disabled
- [ ] On a fresh profile, before ticking anything, open a shop from the catalog and confirm its ad
      slots are still filled and the panel shows the notice — nothing is blocked, hidden or
      credited; then tick, agree and reload, and confirm the slots are hidden and the ad-value card
      starts counting
- [ ] Tick, accept, create an account, open a shop, and confirm codes are found and the ad-value card
      fills in
- [ ] Open a page that is not a covered shop and confirm `opera://extensions` shows no access to it
- [ ] Use **Check & add this site** on a shop outside the catalog and confirm the browser asks for
      that one site only
- [ ] Turn ad blocking off in the settings, reload a shop, and confirm neither blocking nor counting
      continues (the ad-value card says it is off)
- [ ] In Settings, save a partner endpoint and confirm the browser asks for that host only
- [ ] Run the face scan once (or cancel it): the camera opens only after the tick box, and the
      consent facts on screen match `extension/terms.html` §11
- [ ] Screenshots at 612×408, white background: one of the panel in use, one showing where the
      extension sits in the browser
- [ ] Support page published at a URL entered in the submission form, relevant to the extension and
      reachable — the copy in the package is `extension/support.html`
- [ ] Privacy policy published at a URL entered in the submission form, consistent with
      `extension/terms.html` §13 — the copy in the package is `extension/privacy.html`, the working
      draft with the open publication steps is [`docs/privacy-policy.md`](privacy-policy.md)
- [ ] Name, summary and description entered exactly as "Listing copy" above
- [ ] No "Opera" in the title, the listing or the icons

## Not verified here

- The package running in real Opera on Windows and macOS — only Chromium-based Node tests ran.
- Payout with a live reward service, cashback confirmation with a live programme, and the face age
  check against a live relay: all need the operator's own accounts and endpoints.
- Whether Opera will accept the one-goal argument in finding 1. That is the review.
- The gate holding the blocking ruleset back in a real browser: the worker's ruleset calls and the
  ad-credit refusal are covered by `test/policies.test.mjs` and `test/security.test.mjs`, and the
  panel's notice was checked in the preview harness, but no test here loads the packaged extension
  in Opera and watches a real request go from allowed to blocked.
