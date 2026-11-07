import { storeCount } from "./src/lib/stores.js";

const byId = (id) => document.getElementById(id);

const current = { tabId: null, url: null, data: null };

const BLOCKS = ["empty", "cashback-block", "coupon-block", "price-block"];

function money(value) {
  if (typeof value !== "number" || !isFinite(value)) return "—";
  return "$" + (value / 100).toFixed(2);
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

function showEmpty(text) {
  byId("empty").hidden = false;
  byId("empty-text").textContent = text;
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

function renderCashback(data) {
  const cashback = data.offers.cashback;
  if (!cashback) return;
  byId("cashback-block").hidden = false;

  const rate = byId("cashback-rate");
  rate.textContent = cashback.rate || "Offer";
  if (cashback.rate) {
    const unit = document.createElement("small");
    unit.textContent = " back";
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

  if (!current.url || !/^https?:/i.test(current.url)) {
    showEmpty("Open a supported store to see savings.");
    byId("partner-line").textContent = "";
    return;
  }

  const data = await sendWorker({ type: "site:resolve", url: current.url });

  if (!data || !data.store) {
    showEmpty("Not a supported store yet. Savings works on " + storeCount() + " stores.");
    byId("partner-line").textContent = "Coupons, cashback and price data from Partner Platforms.";
    return;
  }

  current.data = data;
  byId("store-name").textContent = "· " + data.store.name;
  renderCashback(data);
  renderCoupons(data);
  renderPrice(data.price);
  byId("partner-line").textContent = data.footer;

  const probe = await toTab({ type: "coupon:probe" });
  if (probe && probe.hasField === false) {
    byId("field-note").hidden = false;
  }
}

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
