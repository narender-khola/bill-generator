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

// ---- Fetching from goodreturns -------------------------------------------
// The full daily history (scripts/fetch-petrol.js) needs a token that is only
// issued with a goodreturns Referer, which a page on another site can't send.
// So the button reads the "Last 10 Days" table off the public city page, which
// is enough to keep the series current.  goodreturns sends no CORS header for
// the page, so it goes through a public proxy; these are free and flaky (rate
// limits, outages), so try each in turn.
const PROXIES = [
  (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://everyorigin.jwvbremen.nl/api/get?url=${encodeURIComponent(u)}`,
];

// Gurugram only: every pump the Fuel Bill generator prints is in Gurugram.
export const RATES_CITY = { slug: "gurgaon", label: "Gurugram" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "October 13, 2026</td><td>&#x20b9;102.97</td>"
const parseTable = (html) => {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, "|").replace(/&#(8377|x20b9);/gi, "₹");
  const re = new RegExp(`(${MONTHS.join("|")}) (\\d{1,2}), (20\\d{2})[|\\s]*₹\\s*([\\d.]+)`, "g");
  const byDate = new Map();
  let m;
  while ((m = re.exec(text)) !== null) {
    const date = `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    if (!byDate.has(date)) byDate.set(date, parseFloat(m[4]));
  }
  return [...byDate.entries()].map(([date, rate]) => ({ date, rate })).sort((a, b) => a.date.localeCompare(b.date));
};

// goodreturns sometimes reports another company's pump for a single day, then
// falls back to the exact previous price; a day that differs from both
// neighbours while they agree takes their price (same as fetch-petrol.js).
const smoothBlips = (rows) =>
  rows.map((r, i) => {
    const prev = rows[i - 1];
    const next = rows[i + 1];
    return prev && next && prev.rate === next.rate && r.rate !== prev.rate ? { date: r.date, rate: prev.rate } : r;
  });

export const fetchLatestRates = async (fuel) => {
  const url = `https://www.goodreturns.in/${fuel}-price-in-${RATES_CITY.slug}.html`;
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
      const rows = parseTable(html);
      if (rows.length) return smoothBlips(rows);
      throw new Error("no price table in page");
    } catch (e) {
      errors.push(`${new URL(proxy(url)).host}: ${e.message}`);
    }
  }
  throw new Error(`All proxies failed — ${errors.join("; ")}`);
};
