// Virtual Visa payouts. Only a payout service can issue a card, so the
// extension asks the service the operator configured and stores what comes
// back: a reference and, when the service offers one, a redemption link and
// the last four digits. A full card number is never requested or stored.
//
// With no service connected the wallet issues a clearly-labelled demo card so
// the flow can be used before a provider is set up. A demo card moves no money.

export function payoutConfigured(settings) {
  return Boolean(String((settings && settings.payoutUrl) || "").trim());
}

function payoutHeaders(settings) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  const key = String((settings && settings.payoutKey) || "").trim();
  if (key) headers.authorization = "Bearer " + key;
  return headers;
}

function readCard(payload) {
  const card = (payload && (payload.card || payload.reward)) || null;
  if (!card) return null;
  return {
    brand: String(card.brand || "Visa").slice(0, 24),
    last4: card.last4 ? String(card.last4).slice(-4) : null,
    expiresAt: card.expiresAt || card.expiry || null,
    redeemUrl: card.redeemUrl || card.url || null,
    reference: String(card.reference || card.id || "").slice(0, 64) || null,
  };
}

export async function requestVirtualCard(settings, request) {
  const url = String(settings.payoutUrl || "").trim();
  if (!url) return { ok: false, error: "No payout service is connected." };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: payoutHeaders(settings),
      cache: "no-store",
      body: JSON.stringify({
        method: "virtual_visa",
        amount: request.amount,
        currency: request.currency || "USD",
        earnings: request.earnings || [],
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "The payout service rejected the credentials (HTTP " + response.status + ")." };
    }
    if (!response.ok) {
      return { ok: false, error: "The payout service answered HTTP " + response.status + "." };
    }

    const payload = await response.json();
    const card = readCard(payload);
    if (!card || !card.reference) {
      return { ok: false, error: "The payout service did not return a card reference." };
    }
    return { ok: true, card };
  } catch (error) {
    return { ok: false, error: "Could not reach the payout service: " + String((error && error.message) || error) };
  }
}

// A demo card: it shows the flow, carries no card number, and is labelled as a
// demo everywhere it appears.
export function demoVirtualCard(amount, now) {
  const at = now || Date.now();
  return {
    demo: true,
    brand: "Visa",
    last4: null,
    expiresAt: null,
    redeemUrl: null,
    reference: "DEMO-" + at.toString(36).toUpperCase() + "-" + String(amount),
  };
}
