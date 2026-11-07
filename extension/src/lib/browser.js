// Which browser is running this build. Chrome, Edge, Brave, Opera, Vivaldi and
// Firefox all run the same source, so the only thing that differs is the name
// shown where the browser's own autofill is involved.
export function browserName(userAgent) {
  const agent =
    typeof userAgent === "string"
      ? userAgent
      : String((typeof navigator !== "undefined" && navigator.userAgent) || "");
  if (/Edg\//.test(agent)) return "Edge";
  if (/OPR\//.test(agent)) return "Opera";
  if (/Vivaldi\//.test(agent)) return "Vivaldi";
  if (/Firefox\/|FxiOS/.test(agent)) return "Firefox";
  if (typeof navigator !== "undefined" && navigator.brave) return "Brave";
  return "Chrome";
}
