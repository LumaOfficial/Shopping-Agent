// Code bookkeeping shared by the service worker and the side panel: one code
// shape, one de-duplication order, one definition of "expired".
export const SOURCE_RANK = { verified: 5, feed: 4, catalog: 3, saved: 2, page: 1 };

export const SOURCE_LABEL = {
  verified: "works",
  feed: "feed",
  catalog: "list",
  saved: "yours",
  page: "on page",
};

export function cleanCode(input) {
  const code = String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!/^[A-Z0-9][A-Z0-9._-]{2,23}$/.test(code)) return null;
  return code;
}

// Feeds publish an expiry as an ISO date or as epoch milliseconds; both become
// one ISO string so isExpired() reads them the same way.
function normalizeExpiry(value) {
  if (!value) return null;
  const at = typeof value === "number" ? value : Date.parse(value);
  if (!isFinite(at)) return null;
  return new Date(at).toISOString();
}

export function normalizeCode(raw, fallbackSource) {
  if (!raw) return null;
  const code = cleanCode(raw.code || raw.couponCode || raw.value);
  if (!code) return null;
  const title = String(raw.title || raw.description || raw.label || "").trim();
  return {
    code,
    title: title ? title.slice(0, 160) : null,
    expires: normalizeExpiry(raw.expires || raw.expiresAt),
    source: raw.source || fallbackSource || "feed",
    verifiedAt: raw.verifiedAt || raw.at || null,
  };
}

export function isExpired(coupon, now) {
  if (!coupon || !coupon.expires) return false;
  const at = Date.parse(coupon.expires);
  if (!isFinite(at)) return false;
  return at < (now || Date.now()) - 24 * 60 * 60 * 1000;
}

// Later lists lose to earlier sources of higher rank, but a title or expiry from
// any source is kept so the row is as informative as the data allows.
export function mergeCodes(...lists) {
  const byCode = new Map();
  lists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((raw) => {
      const coupon = normalizeCode(raw, raw && raw.source);
      if (!coupon) return;
      const existing = byCode.get(coupon.code);
      if (!existing) {
        byCode.set(coupon.code, coupon);
        return;
      }
      const better = (SOURCE_RANK[coupon.source] || 0) > (SOURCE_RANK[existing.source] || 0);
      byCode.set(coupon.code, {
        code: coupon.code,
        title: existing.title || coupon.title,
        expires: existing.expires || coupon.expires,
        source: better ? coupon.source : existing.source,
        verifiedAt: existing.verifiedAt || coupon.verifiedAt,
      });
    });
  });
  const now = Date.now();
  return Array.from(byCode.values())
    .filter((coupon) => !isExpired(coupon, now))
    .sort((a, b) => {
      const rank = (SOURCE_RANK[b.source] || 0) - (SOURCE_RANK[a.source] || 0);
      return rank || a.code.localeCompare(b.code);
    });
}
