// Per-browser layers over the bundled fuel price series:
//   bundled (Fueldata.js)  <  fetched (Fetch latest button)  <  edited (month submit)
// Each layer is a { "YYYY-MM-DD": rate } map in localStorage.

const LAYER_KEY = (layer, fuel) => `bg_fuel_${layer}_${fuel}`;

const readLayer = (layer, fuel) => {
  try {
    const raw = window.localStorage.getItem(LAYER_KEY(layer, fuel));
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
};

const writeLayer = (layer, fuel, map) => {
  try {
    window.localStorage.setItem(LAYER_KEY(layer, fuel), JSON.stringify(map));
  } catch {}
};

export const getFetched = (fuel) => readLayer("fetched", fuel);
export const getEdits = (fuel) => readLayer("edits", fuel);

export const getFetchedAt = (fuel) => {
  try {
    return window.localStorage.getItem(LAYER_KEY("fetchedAt", fuel));
  } catch {
    return null;
  }
};

export const saveFetched = (fuel, rows) => {
  const map = { ...getFetched(fuel) };
  for (const r of rows) map[r.date] = r.rate;
  writeLayer("fetched", fuel, map);
  try {
    window.localStorage.setItem(LAYER_KEY("fetchedAt", fuel), new Date().toISOString());
  } catch {}
};

// Replace the edits for one month (prefix "YYYY-MM") with `monthMap`.
export const saveMonthEdits = (fuel, month, monthMap) => {
  const map = {};
  for (const [d, r] of Object.entries(getEdits(fuel))) if (!d.startsWith(month)) map[d] = r;
  for (const [d, r] of Object.entries(monthMap)) map[d] = r;
  writeLayer("edits", fuel, map);
};

export const clearMonthEdits = (fuel, month) => saveMonthEdits(fuel, month, {});

// Bundled rows plus both layers, sorted by date.  Each row carries its source.
// includeEdits: false gives what the month would show without this browser's edits.
export const applyLayers = (fuel, baseRows, { includeEdits = true } = {}) => {
  const byDate = new Map(baseRows.map((r) => [r.date, { date: r.date, rate: parseFloat(r.rate), source: "bundled" }]));
  const layers = includeEdits ? [["fetched", "fetched"], ["edits", "edited"]] : [["fetched", "fetched"]];
  for (const [layer, source] of layers) {
    for (const [date, rate] of Object.entries(readLayer(layer, fuel))) {
      const v = parseFloat(rate);
      if (!isNaN(v)) byDate.set(date, { date, rate: v, source });
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
};

// ---- Fetching from bankbazaar --------------------------------------------
// bankbazaar sends no CORS header, so the browser goes through a public proxy.
// These are free and flaky (rate limits, outages), so try each in turn.
const PROXIES = [
  (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://everyorigin.jwvbremen.nl/api/get?url=${encodeURIComponent(u)}`,
];

// Same parsing as scripts/fetch-petrol.js: the page embeds a "pricesHistory"
// JSON blob with ~6 months of daily rates.
const extractJsonAfterKey = (html, key) => {
  const at = html.indexOf(`"${key}"`);
  if (at === -1) return null;
  let i = html.indexOf(":", at) + 1;
  while (i < html.length && /\s/.test(html[i])) i += 1;
  const open = html[i];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;
  if (!close) return null;
  const start = i;
  let depth = 0;
  let inStr = false;
  for (; i < html.length; i += 1) {
    const c = html[i];
    if (inStr) {
      if (c === "\\") i += 1;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  try {
    return JSON.parse(html.slice(start, i + 1));
  } catch {
    return null;
  }
};

const parseHistory = (html) => {
  const hist = extractJsonAfterKey(html, "pricesHistory");
  if (!Array.isArray(hist) || !hist.length) return [];
  const meta = extractJsonAfterKey(html, "currentCity");
  const cityId = meta && typeof meta.id === "number" ? meta.id : null;
  const byDate = new Map();
  for (const row of hist) {
    if (cityId !== null && row.cityId !== cityId) continue;
    const rate = row && row.prices && row.prices["1L"];
    if (!row.date || typeof rate !== "number") continue;
    byDate.set(row.date, rate);
  }
  return [...byDate.entries()].map(([date, rate]) => ({ date, rate })).sort((a, b) => a.date.localeCompare(b.date));
};

// The blob sometimes carries the other product's price on a single day; drop
// any day more than 3% off the median of the week around it.
const dropSpikes = (rows) =>
  rows.filter((r, i) => {
    const win = rows.slice(Math.max(0, i - 3), i + 4).map((x) => x.rate).sort((a, b) => a - b);
    const med = win[Math.floor(win.length / 2)];
    return Math.abs(r.rate - med) / med <= 0.03;
  });

export const fetchLatestRates = async (fuel, city = "delhi") => {
  const url = `https://www.bankbazaar.com/fuel/${fuel}-price-${city}.html`;
  const errors = [];
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let html = await res.text();
      // everyorigin wraps the page as { contents: "<html>…" }
      if (html.trimStart().startsWith("{")) {
        try { html = JSON.parse(html).contents || html; } catch {}
      }
      const rows = dropSpikes(parseHistory(html));
      if (rows.length) return rows;
      throw new Error("no price history in page");
    } catch (e) {
      errors.push(`${new URL(proxy(url)).host}: ${e.message}`);
    }
  }
  throw new Error(`All proxies failed — ${errors.join("; ")}`);
};
