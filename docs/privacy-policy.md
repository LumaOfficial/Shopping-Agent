# Privacy policy — Luma Pay Shopping Agent

**Version 1.4 · Last updated 12 November 2026 · Applies to extension version 0.9.0**

This policy is kept in two copies that must say the same thing: the packaged page a shopper and a
reviewer open, [`extension/privacy.html`](../extension/privacy.html), and this working draft, which
also carries the repository notes and the publication steps still open. It describes what the Luma
Pay Shopping Agent browser extension (the “Extension”) does with data. It is written to match the Terms of Use and Disclosures that the Extension shows before
it does anything: the consent facts in the panel, and sections 5, 8, 11, 12 and 13 of
[`extension/terms.html`](../extension/terms.html). Where this policy and those Terms both speak to
the same handling, they say the same thing — if they ever stop matching, the Terms govern and this
policy is wrong and will be corrected.

This policy is a complete statement of the handling the Extension performs and is written to be
read in full. There is deliberately no shortened version of it: a summary that leaves out a detail
is a second account of the policy that someone could later rely on, so the sections below are the
only reading, and no paragraph here shortens an obligation a numbered Terms section imposes or
removes one it states.

## Who this policy is from

The Extension is published under the name **Luma Pay** (“we”, “us”, “our”). “You” is the person who
installed it and agreed to the Terms. We are not a bank, a payment institution, a cashback network,
a retailer or a browser vendor, and no browser vendor has approved the Extension
(see Terms §2).

Questions about this policy go to the support address on the Extension's own store listing — the
same contact point named in Terms §30: **lumasupport@tidio.xyz**.

## What this policy covers, and what it does not

It covers data the Extension handles in your browser. It does **not** cover:

- the shops you visit, which have their own privacy notices for what they do on their own pages;
- a cashback programme, payout provider, price-history API or age-check provider you configure —
  each is a separate party with its own notice, and when a request reaches it, it handles that
  request under its own terms (Terms §10);
- your browser vendor, or anything your browser itself stores, such as card details in the
  browser's own autofill.

## At a glance

| Data | Where it lives | Does it leave your device? |
| --- | --- | --- |
| Acceptance of the Terms (version and date) | `chrome.storage.local` in this browser profile | No |
| Account: email, phone if you gave one, date of birth, creation time, salted password hash | `chrome.storage.local` | No |
| Signed-in session record | `chrome.storage.local`, and `chrome.storage.session` where available | No |
| Settings: feature switches, shops you added, partner addresses, credentials you entered | `chrome.storage.local` | Only credentials travel, and only to the address you entered for them |
| Codes saved for a store, and which ones the store accepted | `chrome.storage.local` | No |
| Price points recorded on product pages you visited | `chrome.storage.local` | No |
| Wallet: cashback, savings and ad value credited to your account | `chrome.storage.local` | Only in a payout request you started |
| Age-check verdict: outcome, provider name, reference, time | `chrome.storage.local` | No |
| Camera frames for the optional age check | Memory only, for the length of a measurement | Only when you have connected an age-check relay |
| Card numbers and expiry dates, only if you save a card in Luma Pay | `chrome.storage.local`, sealed with AES-256-GCM under a PIN you choose | No |
| Security codes | Never read, never stored | Never |
| Browsing history as a log | Not kept | No |
| Analytics, telemetry, advertising identifiers | None | No |

## What stays on your device

Everything below is written to the Extension's own storage in the browser profile it is installed
in. There is no Luma Pay server that holds an account, and no backup of it.

**Your acceptance of the Terms.** A record with the version you agreed to (currently 1.4) and the
time you agreed. A record without a real version and timestamp is not treated as agreement
(Terms §1).

**Your account.** This is a profile on this device, not an online account (Terms §8). It holds the
email address you signed up with, a phone number if you chose to give one, your date of birth for
the 18+ gate, when the account was created, and — instead of your password — a salted
PBKDF2-SHA-256 hash with the iteration count used to make it. Your password itself is never stored
and never leaves the device.

**Your session.** Signing in records a session so the panel does not ask every time. It expires
after a week without use and a month after it was opened, whichever comes first, so a shared
machine does not stay signed in indefinitely. Signing out removes it.

**Your settings.** Which features are switched on, the shops you added yourself, and the partner
addresses and credentials you entered for optional feeds — offer feed, cashback link template,
payout provider, sponsored offers, price history and the age-check relay. Addresses are kept only
if they are HTTPS or a loopback listener; a plain HTTP address on the open internet is dropped
rather than sent a credential. Credentials are stored in this profile and sent only to the address
you entered them for (Terms §10). The settings page also remembers which level you were viewing —
simple, advanced or developer — as a page preference, and nothing else.

**Codes.** Codes read from a store's own page, and codes that store accepted, so the same code can
be offered again next time you shop there.

**Price points.** Prices read on product pages you visited in covered shops, kept so the panel can
show how a price has moved. Older entries are pruned as new ones are recorded.

**Your wallet.** Cashback, savings and ad value credited to your account, and the payout requests
you started. These figures are a record of credits awarded, not a deposit account (Terms §6).

**Age-check verdict.** Whether a check was completed, the provider's name, its reference and the
time. Never a frame and never a face template (Terms §11, and see
[The optional face-based age check](#the-optional-face-based-age-check)).

**Sign-in guards.** A counter of failed sign-in attempts and the time a lock applies, so repeated
guesses are slowed down.

**Your cards — only if you create a card vault.** A card number, expiry date, name on the card and an
optional label are stored only after you set a PIN and tap Save this card. Nothing is read from your
browser's autofill, from another password manager or from a page, and no card exists in the Extension
until you type one in yourself. The record is sealed with AES-256-GCM under a key derived from that
PIN with PBKDF2-SHA-256 at 210,000 rounds. The PIN itself is never stored — only the key it derives —
and that key is held for ten minutes in memory and in `chrome.storage.session`, which the browser
keeps off disk. Ten minutes after you last used the cards, or when you tap Lock now, they lock again.
The security code is never stored, because PCI DSS does not allow keeping one after an authorization
and Luma Pay cannot fill it — you type it at each checkout. Cards are never part of an export or of a
sealed backup, they are not carried to a new device, and forgetting them needs no PIN.

Apart from that vault, which only exists if you create it, the Extension has no field for a card
number, an expiry date or a security code, so one can never be stored by accident.

## What leaves your device

Data leaves only in the five situations Terms §13 lists. Each requires an address you configured
yourself, and each carries only what that one feature needs:

1. **A partner request** — for example a store name and a page address, sent to the offers feed you
   configured so it can look up offers for that page.
2. **A payout request you started** — the details the payout provider requires to issue a virtual
   card, sent to the payout address you configured.
3. **An age-check request** — if, and only if, you connected an age-check relay (below).
4. **An offer or product lookup** — a product identifier or page address sent to a price-history or
   sponsored-offer address you configured.

What does not happen: there is no Luma Pay analytics endpoint, no crash reporting, no advertising
SDK and no telemetry, so nothing is sent to us merely because you used the Extension. The
Extension's package restricts where data can go — scripts only from its own files, and connections
only over HTTPS or to a loopback listener on this machine — so an address you have not configured is
not a destination at all.

## What is read on a web page, and what is never read

The Extension runs on the shops in the catalog it ships with, and on any shop you add yourself,
which asks your browser for that one site's permission at the moment you tap the button. It holds no
standing access to every website, and on a page that is not a covered shop it reads nothing from
that page (Terms §5).

On a covered shop it reads only:

- whether the page is a shop it covers;
- coupon codes, coupon controls and product prices that the page publishes;
- the store's own promo field, so it can type a code you chose and read back what the store said;
- the attributes of card fields on a checkout page, so it can tell you a card can be filled there;
- the card fields themselves, and only while it is typing a card you saved, after you tapped Fill
  card details for that card in the panel;
- the empty ad slots left behind on pages where the ad-blocking switch is on, so it can hide them
  and count them.

It never reads or sends your password fields or security codes, your messages, or the content of
pages that are not covered shops (Terms §5, §12). A card number reaches a page only when you ask for
it to be typed there, only into the card fields of that page, and it is never sent anywhere else:
there is no destination for it in the Extension's package.

## The optional face-based age check

The 18+ check is optional and asks you separately before it starts. The camera opens only from the
panel's own button, only after you tick an empty box, and the manifest asks for no camera
permission. The stream is stopped when the scan finishes, when you cancel, when you sign out, and
when the camera track ends.

**With no relay configured — the default — nothing leaves the device.** You turn your head to a few
angles; the panel measures small copies of the camera picture on this device, compares the angles as
a temporary face model, and drops them. No provider, no account, no key. Only the outcome, the words
“On-device check” and the time are saved with your account.

**If you connect an age-check relay,** the consent facts on screen say so before the camera opens,
and name the relay. In that case one straight-on frame is posted over HTTPS to the relay, which
passes it to the face provider. The provider estimates an age from that frame, and the relay discards
it — it writes nothing to disk and logs no image. The angles you turned through are still compared
on this device and dropped. Only the outcome, the provider's name, its reference and the time are
saved with your account. The relay and the provider each handle that frame under their own terms and
privacy notice (Terms §10, §11).

An age estimate is a statistical guess, not proof of age and not an identity check. Declining the
check leaves the rest of the Extension working; only the cash-out and its promotional boost stay
locked.

## Advertising and tracker requests

With the ad-blocking switch on, the Extension stops requests to advertising and tracker domains in
the browser itself. That is a network rule applied to request addresses — not a reading of the pages
you visit — so it records no browsing history for you or for us. Switching ad blocking off stops the
blocking, stops the ad-slot hiding and counting, and stops the ad-value credit
(Terms §4, §5, §6).

## Cookies, analytics and tracking

The Extension sets no cookies and contains no analytics, telemetry, fingerprinting or advertising
SDK of its own, and it does not use advertising identifiers. Sponsored offers are labelled as
sponsored in the panel; payment for a placement can affect whether such an offer is shown and where
it sits, but it does not change whether a code works or what it saves you (Terms §6).

## Selling, sharing and disclosure

We do not sell your data. Because the Extension holds your data on your device and has no account
server, there is no store of it for us to sell, share or disclose. The only sharing that happens is
the requests you configure, listed in [What leaves your device](#what-leaves-your-device), and any
disclosure required by law in a case where we actually hold something — which, for the data
described in this policy, we do not.

## Retention and deletion

Data stays in this browser profile until it is deleted there. Specifically:

- **Session** — expires a week after last use and a month after it was opened; signing out removes
  it immediately.
- **Price points** — older entries are pruned as new ones are recorded.
- **Everything else** — remains until you delete it.

**Deleting it is the deletion.** There is no server copy to remove. **Clear saved codes and
history** in the settings deletes the signed-in account's shopping record — saved and verified
codes, price points, savings and wallet — and leaves another account on the same browser untouched.
**Export a copy** writes a file containing that same shopping record plus your settings, with every
stored credential left out and kept on the device it was entered on. **Sign out of this device**
ends the session. Removing the Extension from your browser, or clearing the browser profile's data,
deletes the account, the wallet and everything else with it — and we cannot restore any of it
(Terms §8, §20).

## Your rights

Some of what the Extension handles can be personal data under the laws that apply to you. Where it
is, we handle it on the basis of your agreement to the Terms and the purpose of providing the
features you asked for (Terms §13).

Because the data sits in your own browser, the settings controls are how you exercise your rights for
anything we do not hold:

- **Access and portability** — **Export a copy** gives you the saved and verified codes, the price
  points, the savings and wallet figures, and your settings with credentials removed. The account
  record itself (email, phone, date of birth, password hash) is visible in the panel while you are
  signed in but is not part of the export.
- **Correction** — the Extension has no editor for the account record, so what it holds is what you
  entered at signup. If a detail is wrong, export your shopping record and sign up again with the
  correct details; a new account starts with its own balance.
- **Deletion** — **Clear saved codes and history** deletes the shopping record; removing the
  Extension deletes the account, the record and the stored settings with it.
- **Restriction and objection** — switch a feature off, decline the optional age check, or do not
  configure a partner address; each removes the handling that feature performs.

Depending on where you live you may also have the right to complain to your data-protection
authority. Questions, or a request the controls do not cover, go to **lumasupport@tidio.xyz**, the
address in Terms §30.

## Security

- Your password is stored only as a salted PBKDF2-SHA-256 hash (210,000 iterations), never in a form
  that can be read back, and it never leaves the device.
- Repeated failed sign-ins are slowed by a growing lock-out.
- Sessions expire on their own, so a copied session stops working.
- The package runs only its own scripts; no remote code is loaded, and connections are limited to
  HTTPS or a loopback listener.
- Partner addresses must be HTTPS or loopback before a credential is sent to them.
- Page access is limited to the catalog's shops and the sites you add one at a time.

No system is perfect. Anyone with access to this browser profile and an open session can see the
account's balances and act in it — if you share a machine, sign out when you are done, or clear the
Extension's data in its settings (Terms §8).

## Children

The Extension is for people aged 18 or over, or the age of majority where you live if that is
higher (Terms §3). It is not directed to children, and we do not knowingly collect data from them.
The age gate uses the date of birth you enter, or the optional face-based check; neither verifies a
government identity document.

## International transfers

We do not transfer your data, because we do not hold it. When you configure a provider — cashback
programme, payout provider, price API or age-check relay — the request goes to the address you
entered, and that provider processes it wherever it operates, under its own notice.

## Legal bases, and the limits we set ourselves

The Extension does its work in your browser, on your instruction, and almost everything it handles
never reaches us. Where a law calls for a legal basis, the handling rests on one or more of these:

- **Your agreement** — the Terms you accepted, the separate agreement to the optional face-based
  check, and the consent your browser records when you add a shop or grant a site permission
  (Terms §1, §11).
- **Performance of what you asked for** — recognising a shop, reading codes, filling a promo field
  you chose, recording a price, issuing a payout you requested (Terms §4, §6).
- **Legitimate interests** — keeping the Extension working, preventing abuse of the wallet and the
  rate limits, keeping a record of what a store's page said, and answering a message you sent,
  balanced against your rights and the fact that the data stays with you (Terms §9, §13).
- **A legal obligation** — where a payout provider, a tax rule, a sanctions rule or a
  consumer-protection rule requires a record to be kept or a check to be made (Terms §3, §24, §27).

Limits we set on ourselves that the law does not always require: no profile of your browsing across
shops, no advertising identifiers, no sale of data, no analytics endpoint, and no feature whose
function depends on sending page content to us.

## Automated processing

Three decisions are made by a program rather than a person: whether a page is a covered shop,
whether a code the store's page accepted counts as verified, and whether an ad-value credit falls
inside the per-page, per-tab and per-day caps. Each is mechanical, visible in the panel, and
overridable through the settings switches.

The optional age check produces an estimate of whether a person appears to be 18 or over, and that
estimate can unlock a payout and a promotional boost. It is a statistical guess, not proof of age,
not an identity check and not a decision about legal capacity; it does not block the codes,
cashback or price features, is not used to build a profile, and can be cleared from the settings
(Terms §11).

No decision with a legal effect on you beyond unlocking a payout is made about you by automated
means, and no advertising profile is built from the pages you visit.

## Browser signals, Do Not Track and Global Privacy Control

The Extension sends no tracking request that a Do Not Track or Global Privacy Control signal would
need to suppress, so there is nothing for such a signal to opt out of. Where your browser offers
other controls — third-party cookie blocking, a site permission for a shop, the Extension's own
switches — those act directly on the Extension and are respected as set (Terms §5).

## United States state privacy rights

State laws give residents rights over personal information: to know what is collected, to access
it, to correct it, to delete it, to obtain a copy, to opt out of its sale or sharing, and not to be
discriminated against for exercising those rights. Most of that resolves on your own device:

- **Sale and sharing** — we do not sell personal information and do not share it for cross-context
  behavioural advertising; there is no store of it here to sell.
- **Access, correction, deletion, portability** — the settings controls perform them: **Export a
  copy** for access and portability, **Clear saved codes and history** and removing the Extension
  for deletion, and re-registering for correction of an account detail.
- **Sensitive information** — the date of birth and the outcome of an optional age check serve only
  the gate they exist for, and a face measurement is never stored.
- **Non-discrimination** — exercising a right cannot cost a feature, a rate or a credit, because the
  controls act on your own data rather than on an account we administer.

A request the controls do not cover can be sent to **lumasupport@tidio.xyz**; where we hold nothing
to act on, the answer says so and names the control that does apply.

## If something goes wrong

Because there is no account server and no copy of a profile at our end, a security problem here
cannot expose data we never received. The exposure that matters is on your device: a shared browser
profile, a copied session, another extension with wider permissions, or a sealed backup whose
recovery key was stored beside the file.

If you think a defect has exposed something, write to **lumasupport@tidio.xyz** before making it
public. If a device is in someone else's hands, sign out, change anything the browser stored, remove
the Extension, and delete any sealed copy you kept.

## Changes to this policy

This policy is versioned alongside the Terms. When the Terms change to a new version, this policy is
updated with it, the version and date at the top change, and the panel asks you to read and agree to
the new Terms before it continues (Terms §19). If you do not agree, the panel stays on its notice
screen and you can remove the Extension.

## How to contact us

Write to **lumasupport@tidio.xyz**. That address is the official contact point for this policy, for
a data request the settings controls do not cover, for a complaint and for a security report. It is
the address named in Terms §30, and `extension/support.html` repeats it.

Include the browser and the Extension version you are using, and what you expected the panel to do.
Never send a password, a full card number, a security code, an export file or a recovery key. We
cannot open a sealed backup, cannot restore an account lost with a browser profile and cannot read
data that never left your device.

---

## Document control (repository note)

This file is the published privacy policy draft for the store listing. It is kept in step with the
gate by hand, and these are the places to re-read when either changes:

| This policy | Terms of Use (`extension/terms.html`) | Code |
| --- | --- | --- |
| Acceptance record, versioning | §1, §19 | `extension/src/lib/terms.js` (`TERMS_VERSION`) |
| Account, hashing, session expiry | §8 | `extension/src/lib/accounts.js` |
| Site access, what is read on a page | §5, §12 | `extension/manifest.json` `content_scripts`; `extension/src/content/*` |
| Face check facts, on-device and relay paths | §11 | `extension/src/lib/age-verify.js` (`consentFacts()`), `age-local.js`, `server/age-verify.mjs` |
| What leaves the device | §13 | `extension/src/lib/settings.js`, `guard.js` (endpoint rules); `extension/src/partners/*` |
| Payout details | §6, §12 | `extension/src/partners/cashback-payout.js` |
| Ad blocking and ad value | §4, §6 | `extension/src/content/ad-guard.js`, `extension/src/lib/ad-value.js`, `rules/ads.json` |
| Contact | §30 | `lumasupport@tidio.xyz`, repeated in `extension/support.html` |

Still open before publication (see `docs/opera-submission.md`):

- [ ] Publish this policy at a public URL and enter it in the store listing.
- [x] Reconcile the export wording with the gate: Terms §13 now describes what **Export a copy**
      contains instead of claiming “everything it holds”, which the service worker never did. Terms
      and this policy are at version 1.4, so the panel asks again.
- [x] Ship a copy of this policy inside the package (`extension/privacy.html`) so it is reachable
      from the notice card, the terms and the settings page, and so a reviewer can read it offline.
- [ ] Publish `extension/support.html` at a URL entered in the submission form.
- [ ] Replace the placeholder identity/contact wording in “Who this policy is from” with the
      operator's legal name and address once the store listing exists.
- [ ] Obtain legal review alongside the Terms of Use.
