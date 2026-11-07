import { storeCount } from "./src/lib/stores.js";

const byId = (id) => document.getElementById(id);

const current = { tabId: null, url: null, data: null };

const BLOCKS = [
  "empty",
  "source-block",
  "cashback-block",
  "coupon-block",
  "price-block",
  "checkout-block",
];

function money(value) {
  if (typeof value !== "number" || !isFinite(value)) return "—";
  return "$" + (value / 100).toFixed(2);
}

function humanAge(timestamp) {
  if (!timestamp) return "not checked yet";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return "checked just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return "checked " + minutes + " min ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return "checked " + hours + " h ago";
  return "checked " + Math.round(hours / 24) + " d ago";
}

function sendWorker(message) {
  return chrome.runtime.sendMessage(message);
}

function toTab(message) {
  if (!current.tabId) return Promise.resolve(null);
  return chrome.tabs.sendMessage(current.tabId, message).catch(() => null);
}

function hideBlocks() {
  BLOCKS.forEach((id) => {
    byId(id).hidden = true;
  });
}

function showEmpty(title, text, chips) {
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
}

// Sends the code to the content script, which drives the store's own promo
// field. The side panel never claims a result the page did not confirm.
async function runApply(code, button, status) {
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
    status: "error",
    message: "This page is not connected — reload the store tab and try again.",
  };

  const tone = result.status === "applied" ? "ok" : result.status === "rejected" ? "bad" : "wait";
  if (status) {
    status.className = "status " + tone;
    status.textContent = result.message || result.status;
  }
  if (button) {
    button.disabled = false;
    button.textContent = result.status === "applied" ? "Applied" : result.status === "rejected" ? "Retry" : "Check page";
  }

  if (result.status === "applied" && current.data) {
    await sendWorker({ type: "verified:record", storeId: current.data.store.id, code });
    const known = current.data.offers.coupons.some((coupon) => coupon.code === code);
    if (!known) {
      current.data.offers.coupons.unshift({
        code,
        title: "Worked on this store before",
        verified: true,
      });
    }
  }

  return result;
}

function couponRow(coupon, index) {
  const row = document.createElement("div");
  row.className = "coupon";
  row.dataset.code = coupon.code;
  row.style.animationDelay = index * 55 + "ms";

  const main = document.createElement("div");
  main.className = "coupon-main";
  const code = document.createElement("div");
  code.className = "code";
  code.textContent = coupon.code;
  if (coupon.verified) {
    const chip = document.createElement("span");
    chip.className = "chip verified";
    chip.textContent = "works";
    code.appendChild(chip);
  }
  main.appendChild(code);
  if (coupon.title || coupon.expires) {
    const title = document.createElement("div");
    title.className = "coupon-title";
    title.textContent = coupon.title || "";
    if (coupon.expires) title.textContent += " · expires " + coupon.expires;
    main.appendChild(title);
  }
  const status = document.createElement("div");
  status.className = "status";
  status.hidden = true;
  main.appendChild(status);
  row.appendChild(main);

  const button = document.createElement("button");
  button.className = "btn ghost";
  button.type = "button";
  button.textContent = "Apply";
  button.addEventListener("click", () => runApply(coupon.code, button, status));
  row.appendChild(button);
  row.dataset.index = String(index);
  return row;
}

// Where the offers came from and how fresh they are — never invented.
function renderSource(source) {
  if (!source) return;
  byId("source-block").hidden = false;
  const live = source.kind === "live";
  const dot = byId("source-dot");
  dot.className = "dot " + (live ? "live" : "demo");
  byId("source-label").textContent = live
    ? "Authorized feed · " + (source.label || "connected")
    : "Demo catalog";
  byId("source-fresh").textContent = live ? humanAge(source.fetchedAt) : "examples only";

  const note = byId("source-note");
  note.textContent = source.note || "";
  note.hidden = !source.note;
}

function renderCashback(data) {
  const cashback = data.offers.cashback;
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
  button.onclick = async () => {
    button.disabled = true;
    button.textContent = "Opening…";
    const reply = await sendWorker({ type: "cashback:activate", url: current.url });
    button.textContent = reply && reply.ok ? "Activated" : "Not configured";
  };
}

function renderCoupons(data) {
  byId("coupon-block").hidden = false;
  const list = byId("coupons");
  list.textContent = "";

  const coupons = (data.offers.coupons || []).filter((coupon) => coupon && coupon.code);
  byId("demo-chip").hidden = data.offers.source !== "demo";
  byId("coupon-empty").hidden = coupons.length > 0;
  byId("try-all").hidden = coupons.length < 2;

  coupons.forEach((coupon, index) => list.appendChild(couponRow(coupon, index)));
}

function renderPrice(price) {
  if (!price || price.status !== "ok") return;
  byId("price-block").hidden = false;
  byId("price-low").textContent = money(price.low90);
  byId("price-now").textContent = money(price.current);

  const meter = byId("price-meter");
  const note = byId("price-note");
  if (typeof price.low90 === "number" && typeof price.current === "number" && price.current > 0) {
    const ratio = Math.max(0.06, Math.min(1, price.low90 / price.current));
    meter.style.width = Math.round(ratio * 100) + "%";
    note.textContent =
      price.current <= price.low90
        ? "You are at the 90-day low."
        : "Current price is " + Math.round((price.current / price.low90 - 1) * 100) + "% above the 90-day low.";
  } else {
    meter.style.width = "0%";
    note.textContent = "";
  }
}

// Checkout guidance only. The extension never reads card values; the content
// script reports whether card fields exist from field metadata alone.
function renderCheckout(probe) {
  if (!probe || !probe.hasPaymentFields) return;
  byId("checkout-block").hidden = false;
}

async function probeCheckout() {
  const probe = await toTab({ type: "checkout:probe" });
  renderCheckout(probe);
}

async function render() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  current.tabId = tab && typeof tab.id === "number" ? tab.id : null;
  current.url = (tab && tab.url) || null;
  current.data = null;

  hideBlocks();
  byId("coupons").textContent = "";
  byId("store-name").textContent = "";
  byId("field-note").hidden = true;
  byId("add-status").hidden = true;
  byId("access-line").textContent = "Codes are applied only in the store's own promo field.";

  if (!current.url || !/^https?:/i.test(current.url)) {
    byId("store-name").textContent = "No store open";
    showEmpty(
      "Open a store to see savings",
      "Browse any supported store and this panel fills in with codes, cashback and price history.",
      [storeCount() + " stores", "No card data", "Free"]
    );
    byId("partner-line").textContent = "";
    return;
  }

  byId("store-name").textContent = "Looking up this page…";
  const data = await sendWorker({ type: "site:resolve", url: current.url });

  if (!data || !data.store) {
    byId("store-name").textContent = "Not a supported store";
    showEmpty(
      "Not a supported store yet",
      "Savings works on " + storeCount() + " stores. Open one of them to see codes and cashback.",
      ["Add stores in Settings"]
    );
    byId("partner-line").textContent = "Coupons, cashback and price data from Partner Platforms.";
    return;
  }

  current.data = data;
  byId("store-name").textContent = data.store.name + " · " + data.store.category;
  byId("access-line").textContent =
    storeCount() + " stores supported. Only the store's own promo field is touched.";

  renderSource(data.source);
  renderCashback(data);
  renderCoupons(data);
  renderPrice(data.price);
  byId("partner-line").textContent = data.footer;

  const probe = await toTab({ type: "coupon:probe" });
  if (probe && probe.hasField === false) {
    byId("field-note").hidden = false;
  }
  await probeCheckout();
}

byId("refresh").addEventListener("click", async () => {
  if (!current.url) return;
  const button = byId("refresh");
  button.disabled = true;
  button.textContent = "Checking…";
  const data = await sendWorker({ type: "offers:refresh", url: current.url });
  button.disabled = false;
  button.textContent = "Refresh";
  if (data && data.store) {
    current.data = data;
    renderSource(data.source);
    renderCoupons(data);
  }
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
  }
});

byId("try-all").addEventListener("click", async () => {
  const button = byId("try-all");
  const rows = Array.from(document.querySelectorAll("#coupons .coupon"));
  if (!rows.length) return;
  button.disabled = true;
  const label = button.textContent;
  const applied = [];

  for (const row of rows) {
    button.textContent = "Trying " + row.dataset.code + "…";
    const result = await runApply(
      row.dataset.code,
      row.querySelector(".btn"),
      row.querySelector(".status")
    );
    if (result.status === "applied") applied.push(row.dataset.code);
  }

  button.textContent = applied.length ? applied.length + " applied" : "None applied";
  button.disabled = false;
  setTimeout(() => {
    button.textContent = label;
  }, 4000);
});

byId("add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = byId("add-code");
  const code = input.value.trim();
  if (!code) return;
  const status = byId("add-status");
  const button = byId("add-form").querySelector("button");
  await runApply(code.toUpperCase(), button, status);
  if (status.className.includes("ok")) input.value = "";
});

chrome.tabs.onActivated.addListener(render);
chrome.tabs.onUpdated.addListener((_tabId, info) => {
  if (info.status === "complete" || typeof info.url === "string") render();
});

render();
