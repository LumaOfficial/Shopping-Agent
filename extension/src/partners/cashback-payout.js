// Virtual Visa payouts through a hosted proxy in front of Tango Card's order
// API. The proxy holds the Tango Card platform credentials and adds them to the
// order; the extension only ever sends its own bearer token. Orders use
// deliveryMethod NONE, so Tango returns the redemption link here, and a full
// card number is never requested or stored.
//
//   POST <payoutUrl>
//   { externalRefID, customerIdentifier, accountIdentifier, utid, amount,
//     deliveryMethod: "NONE", notes }
//   -> Tango Card order
//   { referenceOrderID, rewardName,
//     reward: { credentials: { redemptionUrl, expirationDate }, credentialList } }

export function payoutConfigured(settings) {
  return Boolean(
    String((settings && settings.payoutUrl) || "").trim() &&
      String((settings && settings.payoutAccount) || "").trim() &&
      String((settings && settings.payoutCustomer) || "").trim() &&
      String((settings && settings.payoutUtid) || "").trim()
  );
}

function payoutHeaders(settings) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  const key = String((settings && settings.payoutKey) || "").trim();
  if (key) headers.authorization = "Bearer " + key;
  return headers;
}

function credential(reward, wanted) {
  const list = reward && Array.isArray(reward.credentialList) ? reward.credentialList : [];
  for (const item of list) {
    const key = String((item && (item.credentialType || item.label)) || "").toLowerCase();
    if (wanted.indexOf(key) !== -1 && item.value) return String(item.value);
  }
  return null;
}

function readCard(payload) {
  if (!payload || !payload.referenceOrderID) return null;
  const reward = payload.reward || {};
  const credentials = reward.credentials || {};
  return {
    brand: String(payload.rewardName || "Visa").slice(0, 40),
    last4: credentials.last4 ? String(credentials.last4).slice(-4) : null,
    expiresAt: credentials.expirationDate || credential(reward, ["expirationdate"]),
    redeemUrl: credentials.redemptionUrl || credential(reward, ["redemptionurl"]),
    reference: String(payload.referenceOrderID).slice(0, 64),
  };
}

function serviceError(status, payload) {
  const first = payload && Array.isArray(payload.errors) ? payload.errors[0] : null;
  const detail = first && first.message ? " " + first.message : "";
  if (status === 401 || status === 403) {
    return "The payout service rejected the credentials (HTTP " + status + ")." + detail;
  }
  if (status === 402) return "The payout account cannot fund this card (HTTP 402)." + detail;
  if (status === 429) return "The payout service is rate limiting requests (HTTP 429). Try again shortly.";
  return "The payout service answered HTTP " + status + "." + detail;
}

// Retries reuse the oldest earning's id, so the proxy and Tango see the same
// externalRefID and do not issue a second card for the same balance.
function externalRef(earnings, amount) {
  const first = Array.isArray(earnings) && earnings.length ? String(earnings[0]) : "";
  return ("savings-" + (first || Date.now().toString(36)) + "-" + amount).slice(0, 100);
}

export async function requestVirtualCard(settings, request) {
  const url = String((settings && settings.payoutUrl) || "").trim();
  if (!url) return { ok: false, error: "No payout service is connected." };

  const accountIdentifier = String(settings.payoutAccount || "").trim();
  const customerIdentifier = String(settings.payoutCustomer || "").trim();
  const utid = String(settings.payoutUtid || "").trim();
  if (!accountIdentifier || !customerIdentifier || !utid) {
    return { ok: false, error: "The payout service is missing its account, customer or reward template id." };
  }

  const amount = Math.round(Number(request.amount)) / 100;
  if (!isFinite(amount) || amount <= 0) {
    return { ok: false, error: "There is no cashable balance to pay out." };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: payoutHeaders(settings),
      cache: "no-store",
      body: JSON.stringify({
        externalRefID: externalRef(request.earnings, request.amount),
        customerIdentifier,
        accountIdentifier,
        utid,
        amount,
        deliveryMethod: "NONE",
        notes: "Savings cashback payout",
      }),
    });

    const body = await response.text();
    let payload = null;
    try {
      payload = body ? JSON.parse(body) : null;
    } catch (_error) {
      payload = null;
    }

    if (!response.ok) return { ok: false, error: serviceError(response.status, payload) };

    const card = readCard(payload);
    if (!card) return { ok: false, error: "The payout service did not return a card reference." };
    return { ok: true, card };
  } catch (error) {
    return { ok: false, error: "Could not reach the payout service: " + String((error && error.message) || error) };
  }
}
