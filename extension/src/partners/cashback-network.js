// Cashback connector. Cashback is paid by the cashback network, so the
// extension never claims a payout itself: it only builds the tracked deep link
// that hands the visit to the partner, using the operator's affiliate template.
// Only an http(s) address is ever opened, whether it comes from the operator's
// template or from a feed.
function httpLink(url) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value) ? value : null;
}

export function buildCashbackLink(pageUrl, cashback, settings) {
  if (!cashback) return null;

  const template = String(settings.cashbackTemplate || "").trim();
  if (template) {
    return httpLink(
      template
        .split("{url}")
        .join(encodeURIComponent(pageUrl))
        .split("{siteId}")
        .join(encodeURIComponent(settings.cashbackSiteId || ""))
    );
  }

  // A feed may already hand over a fully tracked link.
  return httpLink(cashback.trackingUrl);
}

// "$12 back" is only shown for a rate the feed actually published.
export function cashbackLabel(cashback) {
  const rate = String((cashback && cashback.rate) || "").trim();
  return rate || null;
}
