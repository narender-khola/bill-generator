#!/usr/bin/env node
// Fetches petrol price history from bankbazaar.com and writes JSON to
// src/Components/petrol-latest.json.
//
// Usage: node scripts/fetch-petrol.js [city] [--fuel petrol|diesel] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
//
// --fuel diesel writes src/Components/diesel-latest.json instead.  New days are
// merged into the existing file (its rows win); --replace overwrites it.
//
// Default city = delhi. Supported cities follow bankbazaar URL slugs
// (delhi, mumbai, bangalore, chennai, kolkata, hyderabad, ...).
//
// The rendered HTML table only ever carries the last ~10 days, but the page
// embeds a "pricesHistory" JSON blob with ~6 months of daily rates. We read
// that and fall back to scraping the table only if the blob is missing.

const fs = require("fs");
const path = require("path");
const https = require("https");

const MONTHS = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html",
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return resolve(fetchHtml(res.headers.location));
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          }
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => resolve(body));
        }
      )
      .on("error", reject);
  });
}

// Pull a balanced JSON value out of `html` starting at the given key. Regex
// can't do this: the blob nests objects and arrays several levels deep.
function extractJsonAfterKey(html, key) {
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
  } catch (e) {
    return null;
  }
}

// Preferred path: the embedded daily history, newest first, one entry per day.
function parseHistory(html) {
  const hist = extractJsonAfterKey(html, "pricesHistory");
  if (!Array.isArray(hist) || !hist.length) return [];
  // The blob is already scoped to the page's city, but guard against a future
  // change that folds several cities into one array.
  const meta = extractJsonAfterKey(html, "currentCity");
  const cityId = meta && typeof meta.id === "number" ? meta.id : null;
  const byDate = new Map();
  for (const row of hist) {
    if (cityId !== null && row.cityId !== cityId) continue;
    const rate = row && row.prices && row.prices["1L"];
    if (!row.date || typeof rate !== "number") continue;
    byDate.set(row.date, rate);
  }
  return [...byDate.entries()]
    .map(([date, rate]) => ({ date, rate }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The history blob sometimes carries another product's price on a single day
// (diesel 95.20 inside petrol 102.12, and the reverse).  Drop any day more
// than 3% off the median of the week around it: a lone spike goes, a genuine
// price step survives because the days after it agree with it.
function dropSpikes(rows) {
  return rows.filter((r, i) => {
    const win = rows.slice(Math.max(0, i - 3), i + 4).map((x) => x.rate).sort((a, b) => a - b);
    const med = win[Math.floor(win.length / 2)];
    return Math.abs(r.rate - med) / med <= 0.03;
  });
}

function parseRows(html) {
  const re = /(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (20\d{2})<\/td>[^₹]{0,500}?₹\s*([\d.]+)/g;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    const date = `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
    if (seen.has(date)) continue;
    seen.add(date);
    out.push({ date, rate: parseFloat(m[4]) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function parseArgs(argv) {
  const opts = { city: "delhi", fuel: "petrol", from: null, to: null, replace: false };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--from") opts.from = argv[++i];
    else if (argv[i] === "--to") opts.to = argv[++i];
    else if (argv[i] === "--replace") opts.replace = true;
    else if (argv[i] === "--fuel") opts.fuel = String(argv[++i] || "").toLowerCase();
    else rest.push(argv[i]);
  }
  if (rest[0]) opts.city = rest[0].toLowerCase();
  if (!["petrol", "diesel"].includes(opts.fuel)) {
    throw new Error(`--fuel must be petrol or diesel, got "${opts.fuel}"`);
  }
  for (const k of ["from", "to"]) {
    if (opts[k] && !/^\d{4}-\d{2}-\d{2}$/.test(opts[k])) {
      throw new Error(`--${k} must be YYYY-MM-DD, got "${opts[k]}"`);
    }
  }
  return opts;
}

async function main() {
  const { city, fuel, from, to, replace } = parseArgs(process.argv.slice(2));
  const url = `https://www.bankbazaar.com/fuel/${fuel}-price-${city}.html`;
  console.log(`Fetching ${url}`);
  const html = await fetchHtml(url);

  let rows = parseHistory(html);
  let via = "pricesHistory blob";
  if (!rows.length) {
    rows = parseRows(html);
    via = "HTML table (last ~10 days only)";
  }
  if (!rows.length) throw new Error("No rows parsed — page format may have changed.");
  console.log(`Parsed ${rows.length} rows via ${via}`);
  const parsed = rows.length;
  rows = dropSpikes(rows);
  if (rows.length < parsed) console.log(`Dropped ${parsed - rows.length} stray-price day(s)`);

  const available = rows.length ? `${rows[0].date} → ${rows[rows.length - 1].date}` : "none";
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  if (!rows.length) {
    throw new Error(`No rows in range ${from || "-"}..${to || "-"}; source covers ${available}.`);
  }

  const outPath = path.join(__dirname, "..", "src", "Components", `${fuel}-latest.json`);
  // Add new days to what is already there instead of replacing it: the file
  // may hold a hand-supplied series that the source disagrees with, and that
  // series wins wherever both have a day.  --replace starts over.
  if (!replace && fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, "utf8"));
      const byDate = new Map(rows.map((r) => [r.date, r]));
      for (const r of prev.rows || []) byDate.set(r.date, r);
      const added = byDate.size - (prev.rows || []).length;
      rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      console.log(`Merged into existing file: ${added} new day(s)`);
    } catch (e) {
      console.log(`Existing ${outPath} unreadable, replacing it`);
    }
  }
  const payload = {
    source: url,
    city,
    fuel,
    fetchedAt: new Date().toISOString(),
    from: rows[0].date,
    to: rows[rows.length - 1].date,
    rows,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${rows.length} rows to ${outPath}`);
  console.log(`Range: ${rows[0].date} → ${rows[rows.length - 1].date}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
