// Panel keyboard shortcuts. Letters do nothing while the shopper is typing in a
// field, so a note or a search never triggers a jump, and a modifier key means
// the browser's own shortcut, not ours.
const TYPING = { INPUT: true, TEXTAREA: true, SELECT: true };

export const SHORTCUTS = [
  { keys: "/", what: "Open the store directory and search it" },
  { keys: "g", what: "Open the monthly goal in Settings" },
  { keys: "w", what: "Watch the product on this page" },
  { keys: "p", what: "Pin the store you are on" },
  { keys: "d", what: "Jump to the deals for this store" },
  { keys: "c", what: "Jump to the store categories" },
  { keys: "s", what: "Open Settings" },
  { keys: "k", what: "Open your savings toolkit" },
  { keys: "?", what: "Show or hide this list" },
  { keys: "Esc", what: "Clear the search, or close this list" },
];

// What a keydown should do, or null when the panel should leave it alone.
export function actionFor(event) {
  if (!event) return null;
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (event.key === "Escape") return "escape";
  const target = event.target || {};
  if (TYPING[target.tagName] || target.isContentEditable) return null;
  switch (String(event.key || "").toLowerCase()) {
    case "/":
      return "focus-search";
    case "g":
      return "focus-goal";
    case "w":
      return "watch-product";
    case "p":
      return "pin-store";
    case "d":
      return "deals";
    case "c":
      return "categories";
    case "s":
      return "settings";
    case "k":
      return "toolkit";
    case "?":
      return "help";
    default:
      return null;
  }
}
