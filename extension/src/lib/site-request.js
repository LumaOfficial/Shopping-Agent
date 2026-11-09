// The site key everything is filed under: the normalized host of the page. A
// site is the same site with or without "www.", and anything that is not a
// normal web page has no site at all.
export function siteHost(url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return parsed.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch (_error) {
    return null;
  }
}
