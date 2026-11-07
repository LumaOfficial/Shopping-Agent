// Chrome and Microsoft Edge share the extension APIs and this one source, so
// the only thing that differs is the name we show where the browser's own
// autofill is involved. Everything else stays browser-neutral.
export function browserName(userAgent) {
  const agent =
    typeof userAgent === "string"
      ? userAgent
      : String((typeof navigator !== "undefined" && navigator.userAgent) || "");
  return /Edg\//.test(agent) ? "Edge" : "Chrome";
}
