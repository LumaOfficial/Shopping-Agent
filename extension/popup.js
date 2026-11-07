const byId = (id) => document.getElementById(id);

function money(value) {
  if (typeof value !== "number" || !isFinite(value)) return "—";
  return "$" + (value / 100).toFixed(2);
}

function send(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (reply) => {
      const failure = chrome.runtime.lastError;
      if (failure) reject(new Error(failure.message));
      else resolve(reply);
    });
  });
}

function showEmpty(text) {
  byId("empty").hidden = false;
  byId("empty-text").textContent = text;
}

function renderCoupons(data) {
  const block = byId("coupon-block");
  const list = byId("coupons");
  list.textContent = "";
  block.hidden = false;
  byId("demo-chip").hidden = data.offers.source !== "demo";

  const coupons = (data.offers.coupons || []).filter((coupon) => coupon.code);
  byId("coupon-empty").hidden = coupons.length > 0;

  coupons.forEach((coupon) => {
    const row = document.createElement("div");
    row.className = "coupon";

    const main = document.createElement("div");
    main.className = "coupon-main";
    const code = document.createElement("div");
    code.className = "code";
    code.textContent = coupon.code;
    main.appendChild(code);
    if (coupon.title) {
      const title = document.createElement("div");
      title.className = "coupon-title";
      title.textContent = coupon.title;
      main.appendChild(title);
    }
    row.appendChild(main);

    const copy = document.createElement("button");
    copy.className = "btn ghost";
    copy.type = "button";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(coupon.code);
        copy.textContent = "Copied";
      } catch {
        copy.textContent = "Select it";
      }
    });
    row.appendChild(copy);
    list.appendChild(row);
  });
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

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Opening…";
    const reply = await send({ type: "cashback:activate", url: data.pageUrl });
    button.textContent = reply && reply.ok ? "Activated" : "Not configured";
  });
}

function renderPrice(price) {
  if (!price || price.status !== "ok") return;
  byId("price-block").hidden = false;
  byId("price-low").textContent = money(price.low90);
  byId("price-now").textContent = money(price.current);
}

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url;

  if (!url || !/^https?:/i.test(url)) {
    showEmpty("Open a supported store to see savings.");
    return;
  }

  let data;
  try {
    data = await send({ type: "site:resolve", url });
  } catch (error) {
    showEmpty("Could not reach the savings service: " + error.message);
    return;
  }

  if (!data || !data.store) {
    showEmpty("This store is not supported yet. Savings works on the merchant list in Settings.");
    byId("partner-line").textContent =
      "Coupons, cashback and price data from Partner Platforms.";
    return;
  }

  byId("store-name").textContent = "· " + data.store.name;
  data.pageUrl = url;
  renderCashback(data);
  renderCoupons(data);
  renderPrice(data.price);
  byId("partner-line").textContent = data.footer;
}

main();
