import { STORES, storeCount } from "./src/lib/stores.js";
import { filterStores, storeCategories, storeHost, storeSite } from "./src/lib/store-directory.js";
import { mergeCodes, SOURCE_LABEL } from "./src/lib/codes.js";
import { money, humanAge } from "./src/lib/format.js";
import { rateLabel } from "./src/lib/ad-value.js";
import { PAGE_SOURCE_NOTE } from "./src/lib/copy.js";
import { browserName } from "./src/lib/browser.js";
import { HOLD_DAYS } from "./src/partners/cashback-ledger.js";
import { startLogoShow } from "./src/lib/logo-show.js";
import { startPanelExtras } from "./src/lib/panel-extras.js";
import { siteHost } from "./src/lib/site-request.js";
import { currentAccount, hasAccounts, signUp, signIn, signOut } from "./src/lib/accounts.js";
import { startAgeCheck } from "./src/lib/age-panel.js";
import { MIN_AGE } from "./src/lib/age-verify.js";
import { acceptTerms, readConsent, termsUrl } from "./src/lib/terms.js";

const byId = (id) => document.getElementById(id);

const state = {
  tabId: null,
  url: null,
  data: null,
  scan: null,
  scannedAt: 0,
  codes: [],
  filter: "",
  filterSource: "all",
  dead: new Set(),
  storeQuery: "",
  storeCategory: "All",
  site: null,
  // The outcome of the last add-or-remove check, shown on the coverage card.
  verdict: null,
  // Nobody signed in means no money is shown and no page is resolved.
  account: null,
  locked: true,
};

const BLOCKS = [
  "empty",
  "source-block",
  "page-block",
  "cashback-block",
  "wallet-block",
  "ads-block",
  "sponsor-block",
  "register-block",
  "coupon-block",
  "price-block",
  "checkout-block",
  "savings-block",
];

function sendWorker(message) {
  return chrome.runtime.sendMessage(message).catch(() => null);
}

// Broadcast to every frame unless a frame is given: the cart or checkout that
// holds the promo field is often an iframe.
function toTab(message, options) {
  if (typeof state.tabId !== "number") return Promise.resolve(null);
  return chrome.tabs.sendMessage(state.tabId, message, options).catch(() => null);
}

function reset() {
  BLOCKS.forEach((id) => {
    byId(id).hidden = true;
  });
  byId("coupons").textContent = "";
  byId("store-name").textContent = "";
  byId("field-note").hidden = true;
  byId("add-status").hidden = true;
  byId("add-status").className = "status";
  byId("clip-status").hidden = true;
  byId("reconnect-row").hidden = true;
  byId("code-search").hidden = true;
  byId("code-search").value = "";
  byId("page-count").hidden = true;
  byId("access-line").textContent = "Codes are applied only in the store's own promo field.";
  byId("empty-action").hidden = true;
  byId("empty-action").onclick = null;
  byId("price-note").textContent = "";
  byId("price-source").textContent = "";
  byId("saved-note").textContent = "";
  byId("autofill-status").className = "muted tiny";
  byId("autofill-status").textContent =
    "We can't verify this store's security — check the address bar before you pay.";
  byId("codes-status").hidden = true;
  byId("codes-status").textContent = "";
  byId("fetch-codes").hidden = true;
  byId("fetch-codes").disabled = false;
  byId("fetch-codes").textContent = "Scan this page again";
  byId("code-filters").hidden = true;
  byId("code-filters").textContent = "";
  byId("detect-site").disabled = false;
  byId("detect-site").textContent = "Check & add this site";
  byId("detect-site").hidden = false;
  byId("remove-site").hidden = true;
  byId("remove-site").disabled = false;
  byId("detect-status").hidden = true;
  byId("detect-status").textContent = "";
  state.site = null;
  byId("copy-all").hidden = true;
  byId("wallet-list").hidden = true;
  byId("wallet-list").textContent = "";
  byId("payout-block").hidden = true;
  byId("payout-link").hidden = true;
  byId("sponsor-list").hidden = true;
  byId("sponsor-list").textContent = "";
  byId("sponsor-note").textContent = "";
  byId("sponsor-status").hidden = true;
  byId("sponsor-status").textContent = "";
  byId("wallet-status").hidden = true;
  byId("wallet-note").hidden = true;
  byId("ads-value").textContent = "$0.00";
  byId("ads-note").textContent = "";
  byId("ads-today").textContent = "0";
  byId("ads-total").textContent = "0";
  byId("ads-rate").textContent = "";
  payoutMode = "unconfigured";
  state.data = null;
  state.scan = null;
  state.scannedAt = 0;
  state.codes = [];
  state.filter = "";
  state.filterSource = "all";
  state.dead = new Set();
  stopAutoScan();
}

function showEmpty(title, text, chips, action) {
  byId("empty").hidden = false;
  byId("empty-title").textContent = title;
  byId("empty-text").textContent = text;
  const row = byId("empty-chips");
  row.textContent = "";
  (chips || []).forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = label;
    row.appendChild(chip);
  });
  const button = byId("empty-action");
  if (action) {
    button.hidden = false;
    button.textContent = action.label;
    button.onclick = action.run;
  }
}

// ---- store directory ----------------------------------------------------
// The whole catalog, browsable from the panel: what is covered, searchable by
// name, host or category, and one tap from the store's own site.
let directoryBuilt = false;

function buildStoreDirectory() {
  if (directoryBuilt) return;
  directoryBuilt = true;
  const row = byId("store-categories");
  ["All"].concat(storeCategories()).forEach((category) => {
    const button = document.createElement("button");
    button.className = "chip filter";
    button.type = "button";
    button.dataset.category = category;
    button.textContent = category;
    button.setAttribute("aria-pressed", String(category === state.storeCategory));
    row.appendChild(button);
  });
  renderStoreList();
}

function renderStoreList() {
  const list = byId("store-list");
  const stores = filterStores(state.storeQuery, state.storeCategory);
  list.textContent = "";
  byId("store-empty").hidden = stores.length > 0;
  stores.forEach((store) => {
    const item = document.createElement("li");

    const open = document.createElement("button");
    open.className = "store-link";
    open.type = "button";
    open.textContent = store.name;
    open.title = "Open " + store.name;
    open.dataset.url = storeSite(store);
    item.appendChild(open);

    const host = document.createElement("span");
    host.className = "lbl";
    host.textContent = storeHost(store);
    item.appendChild(host);

    list.appendChild(item);
  });
}

function toggleStoreDirectory() {
  const panel = byId("stores-panel");
  const button = byId("stores-toggle");
  const open = panel.hidden;
  panel.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "Hide" : "Browse";
  if (open) {
    buildStoreDirectory();
    byId("store-search").focus();
  }
}

function syncCategoryChips() {
  Array.from(byId("store-categories").children).forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.category === state.storeCategory));
  });
}

// The category tiles and the All stores card drive the same directory, so a tile
// opens it already filtered and scrolls it into view.
function openStoreDirectory(category) {
  if (typeof category === "string") state.storeCategory = category;
  if (byId("stores-panel").hidden) {
    toggleStoreDirectory();
  } else {
    buildStoreDirectory();
    renderStoreList();
  }
  syncCategoryChips();
  byId("stores-block").scrollIntoView({ behavior: "smooth", block: "start" });
}

// The logo parade: a ~15 second flip through every store's own mark. Opened
// from the All stores card and closed by button, backdrop click or Escape.
let stopLogoShow = null;

function openLogoShow() {
  const root = byId("logo-show");
  if (!root.hidden) return;
  root.hidden = false;
  document.body.classList.add("showing-logos");
  stopLogoShow = startLogoShow(root, STORES);
  byId("logo-show-close").focus();
}

function closeLogoShow() {
  const root = byId("logo-show");
  if (root.hidden) return;
  root.hidden = true;
  document.body.classList.remove("showing-logos");
  if (stopLogoShow) stopLogoShow();
  stopLogoShow = null;
  byId("stores-animate").focus();
}

// ---- blocks -------------------------------------------------------------
function feedStatusText(feed) {
  switch (feed.status) {
    case "denied":
      return "credentials rejected";
    case "unreachable":
      return "unreachable";
    case "error":
      return "error";
    case "off":
      return "coupons turned off";
    default:
      return "not connected";
  }
}

// Where the codes came from and how fresh they are — never invented. With no
// feed configured the page is the source, so the strip reports when the page was
// last read instead of asking for an API.
function renderSource(data, connected) {
  byId("source-block").hidden = false;
  const feed = data.feed || {};
  const live = feed.configured && feed.status === "ok";
  const haveCodes = state.codes.length > 0;

  byId("source-dot").className = "dot " + (live || haveCodes || connected ? "live" : "idle");
  byId("source-label").textContent = feed.configured
    ? (live ? "Authorized feed · " + (feed.label || "connected") : "Feed: " + feedStatusText(feed))
    : "Live page scan";
  const readAt = feed.configured && feed.fetchedAt ? feed.fetchedAt : state.scannedAt;
  byId("source-fresh").textContent = readAt
    ? humanAge(readAt)
    : feed.configured ? "waiting for the feed" : "reading this page";

  const note = byId("source-note");
  const text = feed.configured ? feed.error || "" : haveCodes ? "" : PAGE_SOURCE_NOTE;
  note.textContent = text;
  note.hidden = !text;

  byId("reconnect-row").hidden = Boolean(connected);
}

function renderPage(scan, features) {
  const clips = ((scan && scan.clips) || []).filter(
    () => !features || features.clipOffers !== false
  );
  const pageCodes = pageCodesFrom(scan);
  if (!clips.length && !pageCodes.length) return;

  byId("page-block").hidden = false;
  byId("page-count").hidden = false;
  byId("page-count").textContent = String(clips.length + pageCodes.length);

  const parts = [];
  if (pageCodes.length) {
    parts.push(pageCodes.length + " code" + (pageCodes.length === 1 ? "" : "s") + " published on this page");
  }
  if (clips.length) {
    parts.push(clips.length + " clip coupon" + (clips.length === 1 ? "" : "s") + " the store offers here");
  }
  byId("page-note").textContent = parts.join(" · ") + ".";

  const button = byId("clip-all");
  button.hidden = !clips.length;
  button.disabled = false;
  button.textContent = "Clip " + clips.length + " on-page coupon" + (clips.length === 1 ? "" : "s");
}

function renderCashback(data) {
  const cashback = data.cashback;
  if (!cashback) return;
  byId("cashback-block").hidden = false;

  const rate = byId("cashback-rate");
  rate.textContent = cashback.rate || "Offer";
  if (cashback.rate) {
    const unit = document.createElement("small");
    unit.textContent = "back";
    rate.appendChild(unit);
  }

  const button = byId("activate");
  button.disabled = !cashback.url;
  button.textContent = cashback.url ? "Activate" : "Not configured";
  byId("cashback-note").hidden = Boolean(cashback.url);
}

function chipFor(source) {
  const chip = document.createElement("span");
  chip.className = "chip " + (source === "verified" ? "verified" : source === "saved" ? "own" : source);
  chip.textContent = SOURCE_LABEL[source] || source;
  return chip;
}

function couponRow(coupon, index, onDelete, onDead) {
  const row = document.createElement("div");
  row.className = "coupon";
  row.dataset.code = coupon.code;
  row.style.animationDelay = Math.min(index, 6) * 55 + "ms";

  const main = document.createElement("div");
  main.className = "coupon-main";

  const code = document.createElement("div");
  code.className = "code";
  code.textContent = coupon.code;
  code.appendChild(chipFor(coupon.source));
  main.appendChild(code);

  if (coupon.title || coupon.expires) {
    const title = document.createElement("div");
    title.className = "coupon-title";
    title.textContent = coupon.title || "";
    if (coupon.expires) title.textContent += (coupon.title ? " · " : "") + "expires " + coupon.expires;
    main.appendChild(title);
  }

  const status = document.createElement("div");
  status.className = "status";
  status.hidden = true;
  main.appendChild(status);
  row.appendChild(main);

  const actions = document.createElement("div");
  actions.className = "coupon-actions";

  const copy = document.createElement("button");
  copy.className = "mini";
  copy.type = "button";
  copy.textContent = "Copy";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      copy.textContent = "Copied";
    } catch (_error) {
      copy.textContent = "Select it";
    }
    setTimeout(() => {
      copy.textContent = "Copy";
    }, 1600);
  });
  actions.appendChild(copy);

  const apply = document.createElement("button");
  apply.className = "btn ghost";
  apply.type = "button";
  apply.textContent = "Apply";
  apply.addEventListener("click", () => runApply(coupon.code, apply, status));
  actions.appendChild(apply);

  if (coupon.source === "saved" && onDelete) {
    const remove = document.createElement("button");
    remove.className = "mini remove";
    remove.type = "button";
    remove.title = "Remove this saved code";
    remove.setAttribute("aria-label", "Remove " + coupon.code);
    remove.textContent = "×";
    remove.addEventListener("click", () => onDelete(coupon.code));
    actions.appendChild(remove);
  }

  // Reporting a dead code keeps it out of the list and out of "Try all".
  const nope = document.createElement("button");
  nope.className = "mini nope";
  nope.type = "button";
  nope.title = "This code did not work — hide it";
  nope.setAttribute("aria-label", "Mark " + coupon.code + " as not working");
  nope.textContent = "✕";
  nope.addEventListener("click", () => onDead && onDead(coupon.code));
  actions.appendChild(nope);

  row.appendChild(actions);
  return row;
}

function liveCodes() {
  return state.codes.filter((coupon) => !state.dead.has(coupon.code));
}

function visibleCodes() {
  const query = state.filter.trim().toUpperCase();
  return liveCodes().filter((coupon) => {
    if (state.filterSource !== "all" && coupon.source !== state.filterSource) return false;
    if (!query) return true;
    return coupon.code.includes(query) || (coupon.title || "").toUpperCase().includes(query);
  });
}

// Provenance filters with live counts, so a shopper can see page codes apart
// from feed codes and the ones that already worked here.
function renderFilters(alive) {
  const box = byId("code-filters");
  if (alive.length < 2) {
    box.hidden = true;
    box.textContent = "";
    state.filterSource = "all";
    return;
  }

  const groups = [
    ["all", "All", alive.length],
    ["verified", "Works", alive.filter((coupon) => coupon.source === "verified").length],
    ["feed", "Feed", alive.filter((coupon) => coupon.source === "feed").length],
    ["page", "On page", alive.filter((coupon) => coupon.source === "page").length],
    ["saved", "Yours", alive.filter((coupon) => coupon.source === "saved").length],
  ].filter(([, , count]) => count > 0);

  if (!groups.some(([value]) => value === state.filterSource)) state.filterSource = "all";

  box.hidden = false;
  box.textContent = "";
  groups.forEach(([value, label, count]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip filter";
    button.dataset.source = value;
    button.setAttribute("aria-pressed", String(state.filterSource === value));
    button.textContent = label + " " + count;
    box.appendChild(button);
  });
}

function renderCoupons() {
  if (state.data && state.data.features && state.data.features.coupons === false) return;
  byId("coupon-block").hidden = false;
  const list = byId("coupons");
  list.textContent = "";

  const alive = liveCodes();
  const codes = visibleCodes();
  // A "no codes yet" scan message is stale the moment a code shows up.
  if (alive.length) {
    byId("codes-status").hidden = true;
    byId("codes-status").textContent = "";
  }
  renderFilters(alive);
  byId("try-all").hidden = codes.length < 2;
  byId("copy-all").hidden = !alive.length;
  byId("code-search").hidden = alive.length < 4;

  // One tap re-reads this page for codes (and the optional feed, if one is
  // connected). Shown only while the list is empty, which is when there is
  // nothing to apply.
  const fetchButton = byId("fetch-codes");
  fetchButton.hidden = alive.length > 0;
  fetchButton.disabled = false;
  fetchButton.textContent = "Scan this page again";

  const empty = byId("coupon-empty");
  empty.hidden = codes.length > 0;
  if (!codes.length) {
    if (alive.length) {
      empty.textContent = "No code matches that filter.";
    } else if (state.data && state.data.feed && state.data.feed.configured) {
      empty.textContent = "No codes yet — the feed has none for this store and none are published on this page.";
    } else {
      empty.textContent =
        "This store isn't registered yet. Submit it above, or scan again in case the codes load with the cart.";
    }
  }

  codes.forEach((coupon, index) =>
    list.appendChild(
      couponRow(
        coupon,
        index,
        async (code) => {
          await sendWorker({ type: "codes:delete", storeId: state.data.store.id, code });
          state.codes = state.codes.filter((item) => item.code !== code);
          renderCoupons();
        },
        markDead
      )
    )
  );
}

// "Didn't work": hidden locally, never tried again for this store. Undoable.
async function markDead(code, restore) {
  if (!state.data) return;
  const storeId = state.data.store.id;
  await sendWorker({ type: "codes:dead", storeId, code, restore: Boolean(restore) });
  if (restore) state.dead.delete(code);
  else state.dead.add(code);
  renderCoupons();

  const status = byId("codes-status");
  status.hidden = false;
  status.className = "status " + (restore ? "ok" : "wait");
  status.textContent = restore
    ? code + " is back in the list."
    : code + " won't be tried on this store again.";
  if (!restore) {
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "mini undo";
    undo.textContent = "Undo";
    undo.addEventListener("click", () => markDead(code, true));
    status.appendChild(document.createTextNode(" "));
    status.appendChild(undo);
  }
}

function markVerified(code) {
  const row = document.querySelector('#coupons .coupon[data-code="' + CSS.escape(code) + '"]');
  if (!row) return;
  const codeEl = row.querySelector(".code");
  if (!codeEl || codeEl.querySelector(".chip.verified")) return;
  const chip = document.createElement("span");
  chip.className = "chip verified";
  chip.textContent = "works";
  codeEl.appendChild(chip);
}

async function loadSavings() {
  const stats = await sendWorker({ type: "stats:get" });
  if (!stats || !stats.savings || !stats.savings.count) return;
  byId("savings-block").hidden = false;
  byId("saved-total").textContent = money(stats.savings.total || 0, "USD");
  byId("saved-count").textContent = String(stats.savings.count);
  byId("saved-note").textContent =
    stats.verified +
    " verified code" +
    (stats.verified === 1 ? "" : "s") +
    " remembered · " +
    stats.saved +
    " saved by you · " +
    stats.products +
    " product" +
    (stats.products === 1 ? "" : "s") +
    " tracked. Stored on this device only.";
}

// ---- cashback wallet ----------------------------------------------------
// Whether Settings holds a complete payout service (proxy, account, customer
// and reward template). Anything less asks for a generic card instead.
let payoutMode = "unconfigured";

function renderWallet(wallet) {
  if (!wallet || !wallet.balances) return;
  byId("wallet-block").hidden = false;

  const totals = wallet.balances;
  const currency = wallet.currency || totals.currency || "USD";
  const minimum = wallet.minimum || 0;
  byId("wallet-available").textContent = money(totals.available, currency);
  byId("wallet-pending").textContent = money(totals.pending, currency);
  byId("wallet-paid").textContent = money(totals.paid, currency);

  // Cash outs are gated on the face age check; the panel says where to go
  // instead of leaving a dead button.
  const ageLocked = wallet.ageVerified === false;
  byId("wallet-mode").textContent = ageLocked
    ? "Cash outs unlock once your face age check clears " + MIN_AGE + "."
    : wallet.mode === "service"
      ? "Cards are issued by " + (wallet.payoutHost || "your payout service") + "."
      : "No reward service connected — cash outs are issued as preview cards here.";

  payoutMode = wallet.mode === "service" ? "service" : "unconfigured";
  const ready = totals.available > 0 && totals.available >= minimum;
  const button = byId("cash-out");
  // The button always reflects the balance, so cashing out is one tap whether or
  // not a reward service is connected.
  button.disabled = !ready;
  button.textContent = ready
    ? ageLocked
      ? "Verify your age to cash out " + money(totals.available, currency)
      : "Cash out " + money(totals.available, currency) + " to a virtual Visa"
    : minimum > 0
      ? "Cash out from " + money(minimum, currency)
      : "Nothing to cash out yet";

  const note = byId("wallet-note");
  note.hidden = !totals.pending;
  note.textContent = totals.pending
    ? "Pending cashback becomes cashable " +
      HOLD_DAYS +
      " days after the visit, once the store confirms the order."
    : "";

  const list = byId("wallet-list");
  list.textContent = "";
  (wallet.entries || []).forEach((entry) => {
    const row = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = entry.storeName || "Store";
    const amount = document.createElement("span");
    amount.className = "amt";
    amount.textContent = money(entry.amount, entry.currency);
    const state = document.createElement("span");
    state.className = "chip " + entry.status;
    state.textContent = entry.status;
    row.append(name, amount, state);
    // The boost is its own figure, so the extra is never mistaken for the rate.
    if (entry.boost) {
      const boosted = document.createElement("span");
      boosted.className = "chip verified";
      boosted.textContent = "+" + money(entry.boost, entry.currency) + " age boost";
      row.appendChild(boosted);
    }
    list.appendChild(row);
  });
  list.hidden = !(wallet.entries || []).length;

  const payout = (wallet.payouts || [])[0];
  byId("payout-block").hidden = !payout;
  if (payout) {
    const card = payout.card || {};
    byId("payout-title").textContent =
      (card.preview ? "Preview Virtual Visa" : "Virtual Visa") +
      (card.last4 ? " ···· " + card.last4 : "") +
      " · " +
      money(payout.amount, payout.currency);
    byId("payout-detail").textContent = card.preview
      ? "No cash value — connect a reward service in Settings for a real card."
      : [card.reference, card.expiresAt ? "expires " + card.expiresAt : null].filter(Boolean).join(" · ");
    const link = byId("payout-link");
    link.hidden = !card.redeemUrl;
    if (card.redeemUrl) link.href = card.redeemUrl;
  }
}

async function loadWallet() {
  const wallet = await sendWorker({ type: "cashback:wallet" });
  if (wallet) renderWallet(wallet);
}

// ---- sponsored offers ---------------------------------------------------
// Advertisers and their rewards come from the sponsor service in Settings. The
// panel shows what it returns and records only what the sponsor books.
function renderSponsor(payload) {
  if (!payload || !payload.configured) return;
  byId("sponsor-block").hidden = false;

  const offers = payload.offers || [];
  byId("sponsor-note").textContent = offers.length
    ? "Sponsored offers pay the amount shown into your cashback wallet."
    : payload.error || "No sponsored offers right now.";

  const list = byId("sponsor-list");
  list.textContent = "";
  list.hidden = !offers.length;
  offers.forEach((offer) => {
    const row = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = offer.advertiser;
    if (offer.title) name.title = offer.title;
    const amount = document.createElement("span");
    amount.className = "amt";
    amount.textContent = money(offer.reward, offer.currency);
    const open = document.createElement("button");
    open.type = "button";
    open.className = "mini";
    open.textContent = "Open";
    open.addEventListener("click", () => openSponsorOffer(offer, open));
    row.append(name, amount, open);
    list.appendChild(row);
  });
}

async function loadSponsor() {
  const payload = await sendWorker({ type: "sponsor:offers" });
  if (payload) renderSponsor(payload);
}

// The shopper opens the advertiser themselves; the sponsor decides the reward.
async function openSponsorOffer(offer, button) {
  const status = byId("sponsor-status");
  button.disabled = true;
  button.textContent = "Opening…";
  await chrome.tabs.create({ url: offer.url });

  status.hidden = false;
  status.className = "status wait";
  status.textContent = "Checking what " + offer.advertiser + " booked for this visit…";

  const reply = await sendWorker({ type: "sponsor:claim", offerId: offer.id });
  if (reply && reply.wallet) renderWallet(reply.wallet);

  if (reply && reply.ok) {
    status.className = "status ok";
    status.textContent =
      money(reply.entry.amount, reply.entry.currency) +
      " added to your wallet as " +
      reply.entry.status +
      ".";
    button.textContent = "Opened";
    return;
  }
  status.className = "status bad";
  status.textContent = (reply && reply.error) || "The sponsor did not confirm a reward.";
  button.disabled = false;
  button.textContent = "Open";
}

// ---- ad value -----------------------------------------------------------
// The background blocks the ad requests and the page script hides the empty
// slots; the panel shows what those impressions were worth on this browser.
async function renderAds() {
  const [stats, probe] = await Promise.all([
    sendWorker({ type: "ads:stats" }),
    toTab({ type: "ads:probe" }, { frameId: 0 }),
  ]);
  if (!stats || stats.error) return;

  byId("ads-block").hidden = false;
  byId("ads-value").textContent = money(stats.value || 0);
  byId("ads-today").textContent = String(stats.today || 0);
  byId("ads-total").textContent = String(stats.total || 0);

  const onPage = probe && typeof probe.count === "number" ? probe.count : null;
  byId("ads-note").textContent =
    stats.enabled === false
      ? "Ad blocking is off — turn it back on in Settings."
      : onPage === null
        ? "Ads are blocked as you browse and counted here."
        : onPage === 0
          ? "No ads on this page."
          : onPage + (onPage === 1 ? " ad blocked on this page." : " ads blocked on this page.");
  byId("ads-rate").textContent =
    "Valued at " + rateLabel() + " — what those impressions would have cost the advertiser.";
}

function renderPrice(tracked, keepa) {
  const hasTracked = tracked && typeof tracked.current === "number";
  const hasKeepa = keepa && keepa.status === "ok" && typeof keepa.current === "number";
  if (!hasTracked && !hasKeepa) return;

  byId("price-block").hidden = false;
  const current = hasTracked ? tracked.current : keepa.current;
  const low = hasTracked ? tracked.low : keepa.low90;
  const currency = (hasTracked && tracked.currency) || "USD";

  byId("price-low").textContent = money(low, currency);
  byId("price-now").textContent = money(current, currency);
  byId("price-meter").style.width =
    Math.round((current > 0 ? Math.max(0.06, Math.min(1, low / current)) : 0) * 100) + "%";
  byId("price-note").textContent =
    current <= low
      ? "This is the lowest price tracked here."
      : Math.round((current / low - 1) * 100) + "% above the lowest price tracked here.";

  const sources = [];
  if (hasTracked) {
    sources.push(
      "From pages you visited: " +
        tracked.points +
        " price point" +
        (tracked.points === 1 ? "" : "s") +
        " over " +
        tracked.windowDays +
        " day" +
        (tracked.windowDays === 1 ? "" : "s") +
        "."
    );
  }
  if (hasKeepa) sources.push("Product API 90-day low " + money(keepa.low90, "USD") + ".");
  byId("price-source").textContent = sources.join(" ");
}

// ---- actions ------------------------------------------------------------
// Sends the code to the content script, which drives the store's own promo
// field. The side panel never claims a result the page did not confirm.
async function runApply(code, button, status) {
  if (!state.data) return { status: "error", message: "Open a store first." };

  if (button) {
    button.disabled = true;
    button.textContent = "Trying…";
  }
  if (status) {
    status.hidden = false;
    status.className = "status wait";
    status.textContent = "Applying " + code + "…";
  }

  const result = (await toTab({ type: "coupon:apply", code })) || {
    status: "no-field",
    message: "No coupon field on this screen — open your cart or checkout.",
  };

  const tone =
    result.status === "applied" ? "ok" : result.status === "rejected" ? "bad" : "wait";
  if (status) {
    status.className = "status " + tone;
    status.textContent = result.message || result.status;
  }
  if (button) {
    button.disabled = false;
    button.textContent = result.status === "applied" ? "Applied" : result.status === "rejected" ? "Retry" : "Check page";
  }

  if (result.status === "applied") {
    await sendWorker({
      type: "verified:record",
      storeId: state.data.store.id,
      code,
      saving: result.saving || null,
    });
    markVerified(code);
    loadSavings();
  }

  return result;
}

async function refreshCodes() {
  if (!state.url) return null;
  const data = await sendWorker({ type: "offers:refresh", url: state.url });
  if (!data || !data.store) return null;
  state.data = data;
  state.dead = new Set(Array.isArray(data.dead) ? data.dead : []);
  state.codes = mergeCodes(data.codes, pageCodesFrom(state.scan));
  renderSource(data, Boolean(state.scan));
  renderCoupons();
  return data;
}

// ---- automatic coupon scanner -------------------------------------------
// The panel is its own document, so the merchant page is read through the
// content script, which only reports what the page actually publishes. Every
// read is validated here before it can reach the list: one shape per code,
// duplicates collapsed, expired or malformed entries dropped. Codes the
// shopper marked as not working are kept out by liveCodes().
const SCAN_DELAYS = [900, 2500, 6000, 12000];
let scanTimer = null;
let scanRound = 0;

function stopAutoScan() {
  clearTimeout(scanTimer);
  scanTimer = null;
  scanRound = 0;
}

// A read counts only when it describes the page the shopper is on. mergeCodes
// applies the shared code shape and expiry rule, so nothing unvalidated is
// merged.
function pageCodesFrom(scan) {
  if (!scan || scan.error || scan.top === false) return [];
  const raw = Array.isArray(scan.codes) ? scan.codes : [];
  return mergeCodes(
    raw.map((coupon) => Object.assign({}, coupon, { source: "page" }))
  );
}

// Merge one read into the list and return how many codes it added, which is
// what tells the scanner whether the page has gone quiet.
function ingestScan(scan) {
  // A read from a sub-frame describes an embedded widget, not the page the
  // shopper is shopping on, so it never replaces the last good read.
  if (!scan || scan.error || scan.top === false) return 0;
  const before = state.codes.length;
  state.scan = scan;
  state.scannedAt = Date.now();
  state.codes = mergeCodes(state.codes, pageCodesFrom(scan));
  const added = state.codes.length - before;
  if (!state.data) return added;

  renderSource(state.data, true);
  renderPage(scan, state.data.features);
  if (added) renderCoupons();
  return added;
}

// Coupon widgets render after the first read — a cart drawer, a banner that
// loads late — so the page is re-read a few times while it settles, and two
// quiet rounds in a row end the scan early.
function startAutoScan() {
  stopAutoScan();
  const step = () => {
    scanTimer = setTimeout(async () => {
      if (!state.data || !state.url) return;
      const added = ingestScan(await toTab({ type: "page:scan" }, { frameId: 0 }));
      scanRound += 1;
      if ((added || scanRound < 2) && scanRound < SCAN_DELAYS.length) step();
    }, SCAN_DELAYS[scanRound]);
  };
  step();
}

// The coverage card: a site outside the catalog can be checked against what the
// page itself declares and added on the spot, or it is left out. A site that was
// added here gets a remove control in the same place.
function renderRegister() {
  const block = byId("register-block");
  const features = (state.data && state.data.features) || {};
  const registered = Boolean(state.data && state.data.store);
  const custom = Boolean(registered && state.data.store.custom);
  const show =
    Boolean(state.site) && (custom || (!registered && !state.codes.length && features.coupons !== false));
  block.hidden = !show;
  if (!show) return;

  const evidence = (custom && state.data.store.evidence) || [];
  byId("register-title").textContent = custom ? "Added from this page" : "This page isn't covered yet";
  byId("register-site").textContent =
    "Detected site: " + state.site + (registered ? " · " + state.data.store.name : "");
  byId("register-note").textContent = custom
    ? "Added on the spot from the page's own " +
      (evidence.join(", ") || "storefront") +
      " data. Remove it to stop covering this site."
    : "Savings reads what the page itself declares — store or product markup, a known shop platform, a real cart or checkout — and adds it on the spot when that is clear.";
  byId("detect-site").hidden = registered;

  const button = byId("detect-site");
  button.disabled = false;
  button.textContent = "Check & add this site";

  const removeButton = byId("remove-site");
  removeButton.hidden = !custom;
  removeButton.disabled = false;
  removeButton.textContent = "Remove this site";

  const status = byId("detect-status");
  status.hidden = !state.verdict;
  status.textContent = state.verdict ? state.verdict.text : "";
  status.className = "status " + (state.verdict ? state.verdict.tone : "");
}

// The click is the browser gesture the origin permission needs. With access
// granted the worker reads the page and either adds or removes the site; the
// panel only shows what it decided.
async function checkSite(button) {
  if (!state.url) return;
  let origin;
  try {
    origin = new URL(state.url).origin + "/*";
  } catch (_error) {
    return;
  }
  button.disabled = true;
  button.textContent = "Checking this site…";

  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    state.verdict = { tone: "bad", text: "Access declined — nothing was added." };
    renderRegister();
    return;
  }

  const reply = await sendWorker({ type: "site:detect", url: state.url, tabId: state.tabId });
  if (!reply || reply.error || !reply.ok) {
    state.verdict = {
      tone: "bad",
      text: (reply && (reply.message || reply.error)) || "Could not read this page — nothing was added.",
    };
    renderRegister();
    return;
  }

  if (reply.action === "added") {
    state.verdict = {
      tone: "ok",
      text: "Added " + reply.store.name + " — coupons, cashback and price history are on.",
    };
    await render();
    return;
  }

  state.verdict = {
    tone: "bad",
    text:
      "Not added — " +
      ((reply.verdict && reply.verdict.reason) || "this page has no storefront data."),
  };
  renderRegister();
}

async function removeSite(button) {
  if (!state.url) return;
  button.disabled = true;
  button.textContent = "Removing…";
  const reply = await sendWorker({ type: "site:remove", url: state.url });
  if (!reply || !reply.ok) {
    state.verdict = { tone: "bad", text: "Could not remove this site — try again." };
    renderRegister();
    return;
  }
  state.data = null;
  state.codes = [];
  state.verdict = { tone: "ok", text: "Removed — this site is no longer covered." };
  await render();
}

// ---- render -------------------------------------------------------------
async function render() {
  if (state.locked) return;
  // currentWindow, not lastFocusedWindow: in Opera's sidebar the panel belongs
  // to the window it is docked in, which is not necessarily the focused one.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const previousUrl = state.url;
  state.tabId = tab && typeof tab.id === "number" ? tab.id : null;
  state.url = (tab && tab.url) || null;
  // A verdict belongs to the site it was reached on.
  if (state.url !== previousUrl) state.verdict = null;

  reset();

  renderAds();

  if (!state.url || !/^https?:/i.test(state.url)) {
    byId("store-name").textContent = "No store open";
    showEmpty(
      "Open a store to see savings",
      "Browse a store and this panel fills in with codes, cashback and price history.",
      [storeCount() + " stores", "No card data", "Free"]
    );
    byId("partner-line").textContent = "";
    return;
  }

  byId("store-name").textContent = "Checking this page…";
  const data = await sendWorker({ type: "site:resolve", url: state.url });

  if (!data || !data.store) {
    state.data = null;
    state.codes = [];
    state.site = (data && data.site) || siteHost(state.url);
    byId("store-name").textContent = state.site ? state.site + " · not covered" : "Not a supported store";
    renderRegister();
    byId("partner-line").textContent = "Data from Partner Platforms and from this page.";
    return;
  }

  state.data = data;
  state.dead = new Set(Array.isArray(data.dead) ? data.dead : []);
  const features = data.features || {};
  byId("store-name").textContent = data.store.name + " · " + data.store.category;

  const scan = await toTab({ type: "page:scan" }, { frameId: 0 });
  state.scan = scan && !scan.error ? scan : null;
  state.scannedAt = Date.now();

  state.codes = mergeCodes(data.codes, pageCodesFrom(state.scan));
  state.site = data.site || siteHost(state.url);

  renderSource(data, Boolean(state.scan));
  renderPage(state.scan, features);
  renderCashback(data);
  renderRegister();
  renderCoupons();
  if (features.coupons !== false) startAutoScan();
  byId("partner-line").textContent = data.footer;
  byId("access-line").textContent =
    storeCount() + " stores supported. Only the store's own promo field is touched.";

  if (features.priceTracking !== false && state.scan && state.scan.product) {
    const tracked = await sendWorker({
      type: "price:record",
      product: Object.assign({ storeId: data.store.id }, state.scan.product),
    });
    renderPrice(tracked && tracked.current ? tracked : null, data.keepa);
  } else {
    renderPrice(null, data.keepa);
  }

  const probe = await toTab({ type: "coupon:probe" });
  byId("field-note").hidden = Boolean(probe && probe.hasField);

  const checkout = await toTab({ type: "checkout:probe" });
  byId("checkout-block").hidden = !(checkout && checkout.hasPaymentFields);

  loadSavings();
  loadWallet();
  loadSponsor();
}

// ---- accounts -----------------------------------------------------------
function firstName(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "Account";
}

function authStatus(message, kind) {
  const status = byId("auth-status");
  status.hidden = !message;
  status.className = "status " + (kind || "bad");
  status.textContent = message || "";
}

function showAuthTab(which) {
  const signup = which !== "signin";
  byId("auth-tab-signup").setAttribute("aria-selected", String(signup));
  byId("auth-tab-signin").setAttribute("aria-selected", String(!signup));
  byId("signup-form").hidden = !signup;
  byId("signin-form").hidden = signup;
  authStatus("");
}

async function applyAccount(account) {
  // Both gates are needed: an account, and agreement to the terms that explain
  // what the panel asks the browser for. Neither is assumed.
  const consent = Boolean(await readConsent());
  state.account = account;
  state.locked = !account || !consent;
  byId("panel").classList.toggle("locked", state.locked);
  byId("terms-block").hidden = consent;
  byId("auth-block").hidden = Boolean(account) || !consent;
  byId("acct-menu").hidden = true;
  const chip = byId("account-chip");
  chip.hidden = !account || !consent;
  // Verification belongs to the account, so the card follows the session.
  ageCheck.show(Boolean(account) && consent);
  if (!consent) {
    byId("store-name").textContent = "Read and agree first";
    return;
  }
  if (account) {
    chip.textContent = firstName(account.fullName);
    chip.title = "Signed in as " + account.email + " · Open account";
    byId("acct-line").textContent =
      account.email + " · this device stays signed in until you sign out.";
  } else {
    byId("store-name").textContent = "Sign in to start";
    showAuthTab("signin");
  }
}

async function boot() {
  const account = await currentAccount();
  await applyAccount(account);
  if (!account && (await readConsent())) {
    // A fresh browser has nothing to sign in to yet, so open on signup.
    showAuthTab((await hasAccounts()) ? "signin" : "signup");
  }
  if (!state.locked) render();
}

// ---- terms --------------------------------------------------------------
function openTerms(event) {
  event.preventDefault();
  chrome.tabs.create({ url: termsUrl() });
}

byId("terms-read").addEventListener("click", openTerms);
byId("acct-terms").addEventListener("click", openTerms);

// The tick box is the agreement: it starts empty and the button stays disabled
// until it is ticked, so no tap alone can accept the terms.
byId("terms-agree").addEventListener("change", (event) => {
  byId("terms-accept").disabled = !event.target.checked;
});

byId("terms-accept").addEventListener("click", async () => {
  if (!byId("terms-agree").checked) return;
  await acceptTerms();
  byId("terms-agree").checked = false;
  byId("terms-accept").disabled = true;
  byId("terms-note").textContent = "Nothing is scanned or shown without agreement.";
  await boot();
});

byId("terms-decline").addEventListener("click", () => {
  byId("terms-note").textContent =
    "Not agreed, so nothing runs. Tick the box whenever you want to continue.";
});

byId("auth-tab-signup").addEventListener("click", () => showAuthTab("signup"));
byId("auth-tab-signin").addEventListener("click", () => showAuthTab("signin"));

byId("signup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = byId("signup-submit");
  button.disabled = true;
  button.textContent = "Creating…";
  const result = await signUp({
    fullName: byId("su-name").value,
    email: byId("su-email").value,
    phone: byId("su-phone").value,
    dob: byId("su-dob").value,
    password: byId("su-pass").value,
  });
  button.disabled = false;
  button.textContent = "Create account";
  if (!result.ok) {
    authStatus(result.error);
    return;
  }
  byId("signup-form").reset();
  authStatus("");
  await applyAccount(result.account);
  render();
});

byId("signin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = byId("signin-submit");
  button.disabled = true;
  button.textContent = "Signing in…";
  const result = await signIn(byId("si-email").value, byId("si-pass").value, {
    remember: byId("si-remember").checked,
  });
  button.disabled = false;
  button.textContent = "Sign in";
  if (!result.ok) {
    authStatus(result.error);
    return;
  }
  byId("signin-form").reset();
  authStatus("");
  await applyAccount(result.account);
  render();
});

// The chip opens the account card: signing out is a deliberate second tap, so a
// stray click never costs someone their session.
byId("account-chip").addEventListener("click", () => {
  const menu = byId("acct-menu");
  menu.hidden = !menu.hidden;
  if (!menu.hidden) menu.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

byId("acct-signout").addEventListener("click", async () => {
  await signOut();
  reset();
  await applyAccount(null);
});

// ---- wiring -------------------------------------------------------------
byId("refresh").addEventListener("click", async () => {
  if (!state.url) return;
  const button = byId("refresh");
  button.disabled = true;
  button.textContent = "Checking…";
  ingestScan(await toTab({ type: "page:scan" }, { frameId: 0 }));
  await refreshCodes();
  renderPage(state.scan, state.data && state.data.features);
  button.disabled = false;
  button.textContent = "Refresh";
});

// One tap re-reads the page the shopper is on and, when an extra feed is
// connected, that too. Works with no configuration at all.
byId("fetch-codes").addEventListener("click", async () => {
  if (!state.data || !state.url) return;
  const button = byId("fetch-codes");
  const status = byId("codes-status");
  const label = button.textContent;

  button.disabled = true;
  button.textContent = "Scanning…";
  status.hidden = false;
  status.className = "status wait";
  status.textContent = "Reading this page for codes…";

  ingestScan(await toTab({ type: "page:scan" }, { frameId: 0 }));

  const data = await refreshCodes();
  button.disabled = false;
  button.textContent = label;

  if (!data) {
    status.className = "status bad";
    status.textContent = "Could not read this page for codes.";
    return;
  }

  const feed = data.feed || {};
  const pageCodes = (data.codes || []).filter((coupon) => coupon.source === "page").length;
  const feedCodes = (data.codes || []).filter((coupon) => coupon.source === "feed").length;
  const parts = [];
  if (pageCodes) parts.push(pageCodes + " code" + (pageCodes === 1 ? "" : "s") + " on this page");
  if (feedCodes) parts.push(feedCodes + " from " + (feed.label || "the connected feed"));

  if (parts.length) {
    status.className = "status ok";
    status.textContent = "Found " + parts.join(" and ") + ".";
    return;
  }

  status.className = "status wait";
  status.textContent =
    feed.status === "off"
      ? "Coupons are turned off in Settings."
      : "No codes on this page yet. They often appear in the cart or a banner — open it, then scan again.";
});

byId("reconnect").addEventListener("click", () => {
  if (typeof state.tabId === "number") chrome.tabs.reload(state.tabId);
});

byId("clip-all").addEventListener("click", async () => {
  const button = byId("clip-all");
  const status = byId("clip-status");
  button.disabled = true;
  button.textContent = "Clipping…";
  status.hidden = false;
  status.className = "status wait";
  status.textContent = "Clipping the coupons on this page…";

  const result = await toTab({ type: "page:clip" });
  if (!result || !result.ok) {
    status.className = "status bad";
    status.textContent = "The page did not accept the clicks — clip them by hand in the cart.";
  } else {
    status.className = "status ok";
    status.textContent =
      "Clipped " + result.clicked + " coupon" + (result.clicked === 1 ? "" : "s") + " on the store's page.";
  }

  ingestScan(await toTab({ type: "page:scan" }, { frameId: 0 }));
});

byId("activate").addEventListener("click", async () => {
  const button = byId("activate");
  const product = state.scan && state.scan.product;
  button.disabled = true;
  button.textContent = "Opening…";
  const reply = await sendWorker({
    type: "cashback:activate",
    url: state.url,
    total: product ? product.price : null,
    currency: (product && product.currency) || "USD",
  });
  button.textContent = reply && reply.ok ? "Activated" : "Not configured";
  if (reply && reply.wallet) renderWallet(reply.wallet);
});

byId("cash-out").addEventListener("click", async () => {
  const status = byId("wallet-status");
  status.hidden = false;
  status.className = "status wait";
  status.textContent = "Requesting your virtual Visa…";

  const reply = await sendWorker({ type: "cashback:cashout", simple: payoutMode !== "service" });
  if (reply && reply.wallet) renderWallet(reply.wallet);

  if (reply && reply.ok) {
    status.className = "status ok";
    status.textContent = reply.preview
      ? "Preview card issued — no cash value. Connect a reward service in Settings for a real card."
      : "Virtual Visa issued for your cashback balance.";
    return;
  }
  if (reply && reply.reason === "below-minimum") {
    status.className = "status wait";
    status.textContent = "Cashback has to reach the payout minimum before it can be cashed out.";
    return;
  }
  if (reply && reply.reason === "age-unverified") {
    status.className = "status wait";
    status.textContent = "Cash out needs an " + MIN_AGE + "+ face check first — the card below does it.";
    byId("age-block").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  status.className = "status bad";
  status.textContent = (reply && reply.error) || "The payout did not go through.";
});

byId("show-autofill").addEventListener("click", async () => {
  const button = byId("show-autofill");
  const status = byId("autofill-status");
  button.disabled = true;
  const result = await toTab({ type: "checkout:focus" });
  button.disabled = false;
  if (result && result.focused) {
    status.textContent =
      "Card field ready below — " +
      browserName() +
      " offers your saved card. You review and submit it yourself.";
    status.className = "muted tiny ok";
  } else {
    status.textContent = "No card field on this screen yet. Open the payment step and try again.";
    status.className = "muted tiny";
  }
});

byId("try-all").addEventListener("click", async () => {
  const button = byId("try-all");
  const rows = Array.from(document.querySelectorAll("#coupons .coupon"));
  if (!rows.length) return;
  const label = button.textContent;
  button.disabled = true;

  let applied = false;
  for (const row of rows) {
    if (!row.isConnected) continue;
    button.textContent = "Trying " + row.dataset.code + "…";
    const result = await runApply(
      row.dataset.code,
      row.querySelector(".btn"),
      row.querySelector(".status")
    );
    if (result.status === "applied") {
      applied = true;
      break;
    }
  }

  button.textContent = applied ? "Code applied" : "None worked";
  button.disabled = false;
  setTimeout(() => {
    button.textContent = label;
  }, 4000);
});

byId("code-search").addEventListener("input", (event) => {
  state.filter = event.target.value;
  renderCoupons();
});

byId("code-filters").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-source]");
  if (!button) return;
  state.filterSource = button.dataset.source;
  renderCoupons();
});

byId("copy-all").addEventListener("click", async () => {
  const codes = visibleCodes().map((coupon) => coupon.code);
  if (!codes.length) return;
  const status = byId("codes-status");
  status.hidden = false;
  try {
    await navigator.clipboard.writeText(codes.join("\n"));
    status.className = "status ok";
    status.textContent =
      "Copied " + codes.length + " code" + (codes.length === 1 ? "" : "s") + " to the clipboard.";
  } catch (_error) {
    status.className = "status wait";
    status.textContent = "Copy one code at a time with its Copy button.";
  }
});

byId("add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.data) return;
  const input = byId("add-code");
  const code = input.value.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return;

  const status = byId("add-status");
  const button = byId("add-form").querySelector("button");
  const result = await runApply(code, button, status);

  if (result.status === "applied" || result.status === "unverified") {
    await sendWorker({ type: "codes:save", storeId: state.data.store.id, code });
    state.codes = mergeCodes(state.codes, [{ code, source: "saved" }]);
    renderCoupons();
    input.value = "";
    status.hidden = false;
    status.className = "status " + (result.status === "applied" ? "ok" : "wait");
    status.textContent =
      (result.message || "") + " Saved for this store, so it is one tap next time.";
  }
});

chrome.tabs.onActivated.addListener(render);
chrome.tabs.onUpdated.addListener((_tabId, info) => {
  if (info.status === "complete" || typeof info.url === "string") render();
});

// Chrome and Microsoft Edge both run this panel, so name the browser the
// shopper actually has wherever the browser's own autofill is involved.
function applyBrowserCopy() {
  const name = browserName();
  const slot = byId("checkout-browser");
  if (slot) slot.textContent = name;
  const button = byId("show-autofill");
  if (button) button.textContent = "Show " + name + " autofill";
}

byId("detect-site").addEventListener("click", (event) => checkSite(event.currentTarget));
byId("remove-site").addEventListener("click", (event) => removeSite(event.currentTarget));

byId("stores-count").textContent = String(STORES.length);
byId("stores-toggle").addEventListener("click", toggleStoreDirectory);
byId("faq-hold").textContent = String(HOLD_DAYS);

// The pick rail and category tiles come from the catalog, so the panel has
// something useful on it before any store has been visited.
startPanelExtras({
  rail: byId("picks-rail"),
  grid: byId("category-grid"),
  shuffleButton: byId("picks-shuffle"),
  onOpenStore: (store) => chrome.tabs.create({ url: storeSite(store) }),
  onOpenCategory: openStoreDirectory,
});
byId("stores-animate").addEventListener("click", openLogoShow);
byId("logo-show-close").addEventListener("click", closeLogoShow);
document.querySelector("[data-show-browse]").addEventListener("click", () => {
  closeLogoShow();
  openStoreDirectory("All");
});
byId("logo-show").addEventListener("click", (event) => {
  if (event.target === byId("logo-show")) closeLogoShow();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLogoShow();
});

byId("store-search").addEventListener("input", (event) => {
  state.storeQuery = event.target.value;
  renderStoreList();
});

byId("store-categories").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.storeCategory = button.dataset.category;
  Array.from(byId("store-categories").children).forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip === button));
  });
  renderStoreList();
});

byId("store-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-url]");
  if (!button) return;
  chrome.tabs.create({ url: button.dataset.url });
});

applyBrowserCopy();

// The face age check card owns its own consent and capture; the panel only tells
// it who is signed in, and refreshes the wallet once a verdict lands.
const ageCheck = startAgeCheck({
  onChange: () => {
    loadWallet();
  },
});

boot();
