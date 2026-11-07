// Price-history connector (Keepa-compatible product API).
// Prices come back in the currency's minor unit (-1 means unavailable) and the
// history is a flat [minutesSinceEpoch, price, minutes, price, ...] array.
const ENDPOINT = "https://api.keepa.com/product";
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function extractAsin(pageUrl) {
  const match =
    pageUrl.match(/\/dp\/([A-Z0-9]{10})/i) ||
    pageUrl.match(/\/gp\/product\/([A-Z0-9]{10})/i) ||
    pageUrl.match(/[?&]asin=([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

function seriesFrom(csv) {
  if (!Array.isArray(csv) || !csv.length) return [];
  // Prefer the Amazon-offered price, fall back to the marketplace "new" series.
  return Array.isArray(csv[0]) && csv[0].length ? csv[0] : csv[1] || [];
}

function pricePoints(series) {
  const points = [];
  for (let index = 0; index + 1 < series.length; index += 2) {
    const price = series[index + 1];
    if (typeof price === "number" && price > 0) {
      points.push({ at: series[index] * 60 * 1000, price });
    }
  }
  return points;
}

export async function getPriceHistory(pageUrl, settings) {
  const key = String(settings.priceHistoryKey || "").trim();
  if (!key) return { status: "unconfigured" };

  const asin = extractAsin(pageUrl);
  if (!asin) return { status: "no-product" };

  const endpoint = new URL(ENDPOINT);
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("domain", "1");
  endpoint.searchParams.set("asin", asin);
  endpoint.searchParams.set("history", "1");

  let payload;
  try {
    const response = await fetch(endpoint, { headers: { accept: "application/json" } });
    if (!response.ok) return { status: "error", message: "HTTP " + response.status };
    payload = await response.json();
  } catch (error) {
    return { status: "error", message: String((error && error.message) || error) };
  }

  const product = payload && Array.isArray(payload.products) ? payload.products[0] : null;
  if (!product) return { status: "not-found", asin };

  const points = pricePoints(seriesFrom(product.csv));
  if (!points.length) return { status: "not-found", asin };

  const cutoff = Date.now() - NINETY_DAYS_MS;
  const recent = points.filter((point) => point.at >= cutoff);
  const pool = recent.length ? recent : points;

  return {
    status: "ok",
    asin,
    current: points[points.length - 1].price,
    low90: Math.min.apply(
      null,
      pool.map((point) => point.price)
    ),
    lowAll: Math.min.apply(
      null,
      points.map((point) => point.price)
    ),
  };
}
