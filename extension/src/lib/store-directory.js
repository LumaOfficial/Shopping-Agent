// Read-only helpers for the panel's "All stores" directory. The catalog itself
// lives in stores.js; nothing here changes host matching or saved codes.
import { STORES, hostsOf } from "./stores.js";

// Categories in the order they first appear in the catalog, so the directory
// reads like the store list rather than an alphabetized guess.
export function storeCategories() {
  const seen = [];
  STORES.forEach((store) => {
    if (!seen.includes(store.category)) seen.push(store.category);
  });
  return seen;
}

export function filterStores(query, category) {
  const text = String(query || "").trim().toLowerCase();
  return STORES.filter((store) => {
    if (category && category !== "All" && store.category !== category) return false;
    if (!text) return true;
    return (
      store.name.toLowerCase().includes(text) ||
      store.category.toLowerCase().includes(text) ||
      hostsOf(store).some((host) => host.toLowerCase().includes(text))
    );
  });
}

// The store's own site, taken from the first catalog host.
export function storeSite(store) {
  return "https://" + hostsOf(store)[0];
}

// What the directory shows beside the name: the host, minus "www." (the catalog
// never includes it, but a custom entry might).
export function storeHost(store) {
  return hostsOf(store)[0].replace(/^www\./, "");
}
