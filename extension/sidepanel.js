import { storeCount } from "./src/lib/stores.js";
import { mergeCodes, SOURCE_LABEL } from "./src/lib/codes.js";
import { money, humanAge } from "./src/lib/format.js";
import { NO_SOURCE_NOTE } from "./src/lib/copy.js";

const byId = (id) => document.getElementById(id);

const state = { tabId: null, url: null, data: null, scan: null, codes: [], filter: "" };

const BLOCKS = [
  "empty",
  "source-block",
  "page-block",
  "cashback-block",
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
  state.data = null;
  state.scan = null;
  state.codes = [];
  state.filter = "";
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

// Where the codes came from and how fresh they are — never invented.
function renderSource(data, connected) {
  byId("source-block").hidden = false;
  const feed = data.feed || {};
  const live = feed.configured && feed.status === "ok";

  byId("source-dot").className = "dot " + (live ? "live" : "idle");
  byId("source-label").textContent = feed.configured
    ? (live ? "Authorized feed · " + (feed.label || "connected") : "Feed: " + feedStatusText(feed))
    : "No feed connected";
  byId("source-fresh").textContent =
    feed.configured && feed.fetchedAt ? humanAge(feed.fetchedAt) : "your own codes only";

  const note = byId("source-note");
  const text = feed.error || (feed.configured ? "" : NO_SOURCE_NOTE);
  note.textContent = text;
  note.hidden = !text;

  byId("reconnect-row").hidden = Boolean(connected);
}

function renderPage(scan, features) {
  const clips = ((scan && scan.clips) || []).filter(
    () => !features || features.clipOffers !== false
  );
  const pageCodes = (scan && scan.codes) || [];
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

function couponRow(coupon, index, onDelete) {
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

  row.appendChild(actions);
  return row;
}

function visibleCodes() {
  const query = state.filter.trim().toUpperCase();
  if (!query) return state.codes;
  return state.codes.filter(
    (coupon) => coupon.code.includes(query) || (coupon.title || "").toUpperCase().includes(query)
  );
}

function renderCoupons() {
  if (state.data && state.data.features && state.data.features.coupons === false) return;
  byId("coupon-block").hidden = false;
  const list = byId("coupons");
  list.textContent = "";

  const codes = visibleCodes();
  byId("try-all").hidden = codes.length < 2;
  byId("code-search").hidden = state.codes.length < 4;

  const empty = byId("coupon-empty");
  empty.hidden = codes.length > 0;
  if (!codes.length) {
    if (state.codes.length) {
      empty.textContent = "No code matches that filter.";
    } else if (state.data && state.data.feed && state.data.feed.configured) {
      empty.textContent = "The source has no codes for this store yet.";
    } else {
      empty.textContent =
        "No codes for this store yet. Connect an offer feed in Settings, or save a code you already have below.";
    }
  }

  codes.forEach((coupon, index) =>
    list.appendChild(
      couponRow(coupon, index, async (code) => {
        await sendWorker({ type: "codes:delete", storeId: state.data.store.id, code });
        state.codes = state.codes.filter((item) => item.code !== code);
        renderCoupons();
      })
    )
  );
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
  const pageCodes = ((state.scan && state.scan.codes) || []).map((coupon) =>
    Object.assign({}, coupon, { source: "page" })
  );
  state.codes = mergeCodes(data.codes, pageCodes);
  renderSource(data, Boolean(state.scan));
  renderCoupons();
  return data;
}

function enableSiteAction() {
  return {
    label: "Use Savings on this site",
    run: async () => {
      const button = byId("empty-action");
      button.disabled = true;
      button.textContent = "Enabling…";
      let origin;
      try {
        origin = new URL(state.url).origin + "/*";
      } catch (_error) {
        return;
      }
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) {
        button.disabled = false;
        button.textContent = "Access declined — try again";
        return;
      }
      await sendWorker({ type: "site:enable", url: state.url, tabId: state.tabId });
      await render();
    },
  };
}

// ---- render -------------------------------------------------------------
async function render() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  state.tabId = tab && typeof tab.id === "number" ? tab.id : null;
  state.url = (tab && tab.url) || null;

  reset();

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
    byId("store-name").textContent = "Not a supported store";
    showEmpty(
      "Not supported yet",
      "Savings covers " + storeCount() + " stores. You can also turn it on for this site and use the same code tools here.",
      ["Codes", "Cashback", "Price tracking"],
      enableSiteAction()
    );
    byId("partner-line").textContent = "Data from Partner Platforms and from this page.";
    return;
  }

  state.data = data;
  const features = data.features || {};
  byId("store-name").textContent = data.store.name + " · " + data.store.category;

  const scan = await toTab({ type: "page:scan" }, { frameId: 0 });
  state.scan = scan && !scan.error ? scan : null;

  const pageCodes = ((state.scan && state.scan.codes) || []).map((coupon) =>
    Object.assign({}, coupon, { source: "page" })
  );
  state.codes = mergeCodes(data.codes, pageCodes);

  renderSource(data, Boolean(state.scan));
  renderPage(state.scan, features);
  renderCashback(data);
  renderCoupons();
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
}

// ---- wiring -------------------------------------------------------------
byId("refresh").addEventListener("click", async () => {
  if (!state.url) return;
  const button = byId("refresh");
  button.disabled = true;
  button.textContent = "Checking…";
  state.scan = await toTab({ type: "page:scan" }, { frameId: 0 });
  await refreshCodes();
  renderPage(state.scan, state.data && state.data.features);
  button.disabled = false;
  button.textContent = "Refresh";
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

  state.scan = await toTab({ type: "page:scan" }, { frameId: 0 });
  renderPage(state.scan, state.data && state.data.features);
});

byId("activate").addEventListener("click", async () => {
  const button = byId("activate");
  button.disabled = true;
  button.textContent = "Opening…";
  const reply = await sendWorker({ type: "cashback:activate", url: state.url });
  button.textContent = reply && reply.ok ? "Activated" : "Not configured";
});

byId("show-autofill").addEventListener("click", async () => {
  const button = byId("show-autofill");
  const status = byId("autofill-status");
  button.disabled = true;
  const result = await toTab({ type: "checkout:focus" });
  button.disabled = false;
  if (result && result.focused) {
    status.textContent =
      "Card field ready below — Chrome offers your saved card. You review and submit it yourself.";
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

render();
