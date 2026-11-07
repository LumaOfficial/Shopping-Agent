// Cashback connector. Cashback is paid by the cashback network, so the
// extension never claims a payout itself: it only builds the tracked deep link
// that hands the visit to the partner, using the operator's affiliate template.
export function buildCashbackLink(pageUrl, cashback, settings) {
  if (!cashback) return null;

  const template = String(settings.cashbackTemplate || "").trim();
  if (template) {
    return template
      .split("{url}")
      .join(encodeURIComponent(pageUrl))
      .split("{siteId}")
      .join(encodeURIComponent(settings.cashbackSiteId || ""));
  }

  // A feed may already hand over a fully tracked link.
  return cashback.trackingUrl || null;
}
