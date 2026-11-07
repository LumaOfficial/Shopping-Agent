// Display helpers. Prices travel as integer minor units (cents) end to end.
export function currencySymbol(currency) {
  switch (String(currency || "USD").toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "CAD":
      return "CA$";
    case "AUD":
      return "A$";
    case "JPY":
      return "¥";
    case "INR":
      return "₹";
    default:
      return "";
  }
}

export function money(minor, currency) {
  if (typeof minor !== "number" || !isFinite(minor)) return "—";
  return currencySymbol(currency) + (minor / 100).toFixed(2);
}

export function percent(part, whole) {
  if (!whole || typeof part !== "number" || typeof whole !== "number") return null;
  return Math.round((part / whole) * 100);
}

export function humanAge(timestamp) {
  if (!timestamp) return "not checked yet";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return "checked just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return "checked " + Math.max(1, minutes) + " min ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return "checked " + hours + " h ago";
  return "checked " + Math.round(hours / 24) + " d ago";
}

export function daysAgo(timestamp) {
  if (!timestamp) return null;
  return Math.max(0, Math.round((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
}
