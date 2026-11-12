// Figures drawn from what the wallet already holds. Nothing here reads a page or
// calls out: it is arithmetic over the shopper's own confirmed earnings.
function entriesOf(source) {
  const list = Array.isArray(source) ? source : (source && source.entries) || [];
  return list.filter((entry) => entry && typeof entry.amount === "number" && entry.amount > 0);
}

export function monthEarned(source, now) {
  const at = new Date(typeof now === "number" ? now : Date.now());
  return entriesOf(source)
    .filter((entry) => {
      const when = new Date(Number(entry.at));
      if (!isFinite(when.getTime())) return false;
      return when.getFullYear() === at.getFullYear() && when.getMonth() === at.getMonth();
    })
    .reduce((total, entry) => total + entry.amount, 0);
}

// The shop that has actually paid the most, in the wallet's own currency. A
// sponsored credit is an advertiser, not a shop, so it is left out here.
export function bestStore(source) {
  const totals = new Map();
  entriesOf(source).forEach((entry) => {
    if (entry.sponsored) return;
    const name = String(entry.storeName || entry.storeId || "").trim();
    if (!name) return;
    const current = totals.get(name) || { name, amount: 0, currency: entry.currency || "USD" };
    current.amount += entry.amount;
    current.currency = entry.currency || current.currency;
    totals.set(name, current);
  });
  let best = null;
  totals.forEach((entry) => {
    if (!best || entry.amount > best.amount) best = entry;
  });
  return best;
}

// Categories come from the bundled catalog, so a shop the catalog does not list
// simply does not contribute a category.
export function topCategory(source, categoryOf) {
  if (typeof categoryOf !== "function") return null;
  const totals = new Map();
  entriesOf(source).forEach((entry) => {
    if (entry.sponsored) return;
    const category = categoryOf(entry.storeId);
    if (!category) return;
    totals.set(category, (totals.get(category) || 0) + entry.amount);
  });
  let best = null;
  totals.forEach((amount, name) => {
    if (!best || amount > best.amount) best = { name, amount };
  });
  return best;
}

function quote(value) {
  const text = String(value == null ? "" : value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// One row per earning, in the currency it was booked in. Amounts are written as
// decimals because that is what a spreadsheet expects.
export function toCsv(source) {
  const rows = [["date", "store", "status", "amount", "currency"]];
  entriesOf(source).forEach((entry) => {
    const at = Number(entry.at);
    rows.push([
      isFinite(at) ? new Date(at).toISOString() : "",
      entry.storeName || entry.storeId || "",
      entry.status || "",
      (entry.amount / 100).toFixed(2),
      entry.currency || "USD",
    ]);
  });
  return rows.map((row) => row.map(quote).join(",")).join("\r\n") + "\r\n";
}

// A few lines a shopper can drop into a message. It says what the panel knows
// and nothing about the shopper's identity.
export function summaryText(facts) {
  const input = facts || {};
  const lines = ["Luma Pay — my savings on this device"];
  if (input.goal && input.goal.set) {
    lines.push("Monthly goal: " + (input.goal.saved / 100).toFixed(2) + " of " + (input.goal.goal / 100).toFixed(2));
  }
  if (typeof input.month === "number") lines.push("This month: " + (input.month / 100).toFixed(2));
  if (typeof input.today === "number") lines.push("Today: " + (input.today / 100).toFixed(2));
  if (typeof input.streak === "number") lines.push("Streak: " + input.streak + " day(s)");
  if (input.best) lines.push("Best store: " + input.best.name);
  if (input.category) lines.push("Top category: " + input.category.name);
  if (typeof input.watch === "number") lines.push("Watched products: " + input.watch);
  return lines.join("\n");
}
