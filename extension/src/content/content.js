// Content script: asks the service worker what is available for this store,
// then renders the savings panel in a shadow root so store CSS cannot leak in.
(function () {
  "use strict";

  var HOST_ID = "sa-savings-root";

  var PANEL_CSS = `
    :host { all: initial; }
    .panel {
      position: fixed; right: 18px; bottom: 18px; z-index: 2147483647;
      width: 320px; max-height: 70vh; overflow: auto;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #0f172a; background: #ffffff;
      border: 1px solid #e2e8f0; border-radius: 14px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, .18);
    }
    header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; border-bottom: 1px solid #eef2f7;
    }
    .title { font-weight: 600; font-size: 13px; flex: 1; }
    .store { color: #475569; font-weight: 400; }
    .icon-btn {
      all: unset; cursor: pointer; color: #64748b; font-size: 16px;
      line-height: 1; padding: 2px 4px; border-radius: 6px;
    }
    .icon-btn:hover { background: #f1f5f9; }
    section { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; }
    section:last-of-type { border-bottom: 0; }
    .label {
      font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
      color: #64748b; margin-bottom: 6px;
    }
    .cashback { display: flex; align-items: center; gap: 10px; }
    .rate { font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
    .rate small { font-size: 11px; font-weight: 500; color: #64748b; }
    .btn {
      all: unset; cursor: pointer; text-align: center;
      padding: 7px 11px; border-radius: 8px; font-size: 12px; font-weight: 600;
      background: #0f172a; color: #fff;
    }
    .btn:hover { background: #1e293b; }
    .btn[disabled] { background: #cbd5e1; color: #64748b; cursor: default; }
    .btn.ghost { background: #f1f5f9; color: #0f172a; }
    .btn.ghost:hover { background: #e2e8f0; }
    .coupon {
      display: flex; align-items: center; gap: 10px; padding: 7px 0;
    }
    .coupon + .coupon { border-top: 1px dashed #eef2f7; }
    .coupon-main { flex: 1; min-width: 0; }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px; font-weight: 600; letter-spacing: .02em; color: #b45309;
    }
    .coupon-title { color: #475569; font-size: 12px; }
    .status { font-size: 12px; margin-top: 2px; }
    .status.ok { color: #15803d; }
    .status.bad { color: #b91c1c; }
    .status.wait { color: #64748b; }
    .price { display: flex; gap: 14px; }
    .price div { flex: 1; }
    .price strong { display: block; font-size: 15px; }
    .price span { font-size: 11px; color: #64748b; }
    .muted { color: #64748b; font-size: 12px; }
    footer {
      padding: 9px 14px 11px; font-size: 11px; color: #64748b;
      background: #f8fafc; border-radius: 0 0 14px 14px;
    }
    .chip {
      display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px;
      background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 600;
      letter-spacing: .04em; text-transform: uppercase;
    }
    [hidden] { display: none !important; }
  `;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function send(message) {
    return new Promise(function (resolve, reject) {
      try {
        chrome.runtime.sendMessage(message, function (reply) {
          var failure = chrome.runtime.lastError;
          if (failure) reject(new Error(failure.message));
          else resolve(reply);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function money(value) {
    if (typeof value !== "number" || !isFinite(value)) return "—";
    return "$" + (value / 100).toFixed(2);
  }

  var root = null;
  var statusLine = null;

  function setStatus(text, tone) {
    if (!statusLine) return;
    statusLine.textContent = text || "";
    statusLine.className = "status " + (tone || "wait");
    statusLine.hidden = !text;
  }

  function renderCashback(parent, cashback) {
    var section = el("section");
    section.appendChild(el("div", "label", "Cashback"));
    if (!cashback) {
      section.appendChild(el("p", "muted", "No cashback offer for this store right now."));
      parent.appendChild(section);
      return;
    }
    var row = el("div", "cashback");
    var rate = el("div", "rate");
    rate.textContent = cashback.rate || "Offer";
    if (cashback.rate) rate.appendChild(el("small", null, " back"));
    row.appendChild(rate);

    var button = el("button", "btn", cashback.url ? "Activate" : "Unavailable");
    button.id = "activate";
    button.type = "button";
    button.disabled = !cashback.url;
    button.addEventListener("click", async function () {
      button.disabled = true;
      button.textContent = "Opening…";
      try {
        var reply = await send({ type: "cashback:activate", url: location.href });
        button.textContent = reply && reply.ok ? "Activated" : "Could not open";
      } catch (error) {
        button.textContent = "Could not open";
      }
    });
    row.appendChild(button);
    section.appendChild(row);
    if (!cashback.url) {
      section.appendChild(el("p", "muted", "Cashback links are not configured yet."));
    }
    parent.appendChild(section);
  }

  function renderPrice(parent, price) {
    if (!price || price.status === "unconfigured") {
      var section = el("section");
      section.appendChild(el("div", "label", "Price history"));
      section.appendChild(
        el("p", "muted", "Add a price-history API key in Settings to see 90-day lows.")
      );
      parent.appendChild(section);
      return;
    }
    if (price.status !== "ok") {
      var missing = el("section");
      missing.appendChild(el("div", "label", "Price history"));
      missing.appendChild(el("p", "muted", "Price history is not available for this page."));
      parent.appendChild(missing);
      return;
    }
    var wrap = el("section");
    wrap.appendChild(el("div", "label", "Price history"));
    var grid = el("div", "price");
    var low = el("div");
    low.appendChild(el("strong", null, money(price.low90)));
    low.appendChild(el("span", null, "90-day low"));
    var now = el("div");
    now.appendChild(el("strong", null, money(price.current)));
    now.appendChild(el("span", null, "current"));
    grid.appendChild(low);
    grid.appendChild(now);
    wrap.appendChild(grid);
    parent.appendChild(wrap);
  }

  function renderCoupons(parent, offers) {
    var section = el("section");
    var heading = el("div", "label", "Coupon codes");
    if (offers.source === "demo") heading.appendChild(el("span", "chip", "demo"));
    section.appendChild(heading);

    var coupons = (offers.coupons || []).filter(function (coupon) {
      return coupon && coupon.code;
    });

    if (!coupons.length) {
      section.appendChild(el("p", "muted", "No codes found for this store."));
      parent.appendChild(section);
      return;
    }

    coupons.forEach(function (coupon) {
      var row = el("div", "coupon");
      var main = el("div", "coupon-main");
      main.appendChild(el("div", "code", coupon.code));
      if (coupon.title) main.appendChild(el("div", "coupon-title", coupon.title));
      var status = el("div", "status");
      status.hidden = true;
      main.appendChild(status);
      row.appendChild(main);

      var apply = el("button", "btn ghost", "Apply");
      apply.type = "button";
      apply.addEventListener("click", async function () {
        apply.disabled = true;
        apply.textContent = "Trying…";
        status.hidden = false;
        setStatus("", "wait");
        status.className = "status wait";
        status.textContent = "Applying " + coupon.code + "…";
        var result = await window.CouponEngine.applyCode(coupon.code);
        status.textContent = result.message;
        status.className = "status " + (result.status === "applied" ? "ok" : result.status === "rejected" ? "bad" : "wait");
        apply.textContent = result.status === "applied" ? "Applied" : "Retry";
        apply.disabled = false;
      });
      row.appendChild(apply);
      section.appendChild(row);
    });

    parent.appendChild(section);
  }

  function mount(data) {
    var host = el("div");
    host.id = HOST_ID;
    var shadow = host.attachShadow({ mode: "open" });
    var style = el("style");
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);

    var panel = el("div", "panel");

    var header = el("header");
    var title = el("div", "title", "Savings");
    title.appendChild(el("span", "store", " · " + data.store.name));
    header.appendChild(title);
    var refresh = el("button", "icon-btn", "⟳");
    refresh.type = "button";
    refresh.title = "Refresh offers";
    refresh.addEventListener("click", async function () {
      refresh.textContent = "…";
      try {
        var fresh = await send({ type: "offers:refresh", url: location.href });
        unmount();
        mount(fresh);
      } catch (error) {
        refresh.textContent = "⟳";
        setStatus("Could not refresh offers.", "bad");
      }
    });
    header.appendChild(refresh);
    var close = el("button", "icon-btn", "×");
    close.type = "button";
    close.title = "Hide";
    close.addEventListener("click", function () {
      panel.hidden = true;
      var reopen = el("button", "btn", "$");
      reopen.type = "button";
      reopen.style.position = "fixed";
      reopen.style.right = "18px";
      reopen.style.bottom = "18px";
      reopen.style.zIndex = "2147483647";
      reopen.addEventListener("click", function () {
        panel.hidden = false;
        reopen.remove();
      });
      shadow.appendChild(reopen);
    });
    header.appendChild(close);
    panel.appendChild(header);

    var notice = el("section");
    statusLine = el("div", "status");
    statusLine.hidden = true;
    notice.appendChild(statusLine);
    notice.style.display = "none";
    panel.appendChild(notice);

    renderCashback(panel, data.offers.cashback);
    renderCoupons(panel, data.offers);
    renderPrice(panel, data.price);

    var footer = el("footer", null, data.footer);
    panel.appendChild(footer);
    shadow.appendChild(panel);
    document.documentElement.appendChild(host);
    root = host;
  }

  function unmount() {
    if (root) root.remove();
    root = null;
  }

  (async function boot() {
    if (document.getElementById(HOST_ID)) return;
    var data;
    try {
      data = await send({ type: "site:resolve", url: location.href });
    } catch (error) {
      return;
    }
    if (!data || !data.store) return;
    mount(data);
  })();
})();
