// Detecting the site the panel is looking at, and the reward quoted for a store
// we do not cover yet. A request is only paid once the site is added, so the
// range is shown with the request instead of being credited up front.
export const REWARD_MIN = 10; // cents
export const REWARD_MAX = 200; // cents

// The normalized host of the page, which is what a request and the catalog are
// keyed on. Anything that is not a normal web page has no site.
export function siteHost(url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch (_error) {
    return null;
  }
}
