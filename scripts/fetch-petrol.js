#!/usr/bin/env node
// Fetches daily Gurugram fuel price history from goodreturns.in and writes
// JSON to src/Components/petrol-latest.json.
//
// Usage: node scripts/fetch-petrol.js [--fuel petrol|diesel] [--timeframe 2Y]
//                                     [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--replace]
//
// --fuel diesel writes src/Components/diesel-latest.json instead.  New days are
// merged into the existing file (its rows win); --replace overwrites it.
//
// Gurugram only: every pump the Fuel Bill generator prints is in Gurugram, so
// another city's rates would put the wrong price on the receipts.  bankbazaar
// was dropped because its Gurgaon page has carried Delhi's price since mid-2026.
const CITY = "gurgaon"; // goodreturns slug: petrol-price-in-gurgaon.html
//
// The page's price chart loads daily rates from /fuel-graph-data.html with a
// short-lived token from /src/get_api_token.php, which is only issued to
// requests that carry a goodreturns Referer.  --timeframe picks the window
// (1M 3M 6M 1Y 2Y 3Y 5Y ALL, default 2Y).  If the API refuses, we fall back to
// the page's "Last 10 Days" table.

const fs = require("fs");
const path = require("path");
const https = require("https");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function request(url, { method = "GET", headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers: { "User-Agent": UA, ...headers } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(request(new URL(res.headers.location, url).href, { method, headers, body }));
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        resolve(data);
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fetchFromApi(pageUrl, city, fuel, timeframe) {
  const tokenRes = JSON.parse(
    await request("https://www.goodreturns.in/src/get_api_token.php", {
      method: "POST",
      headers: { Referer: pageUrl, "Content-Type": "application/json" },
      body: JSON.stringify({ module: "fuel" }),
    })
  );
  const token = tokenRes && tokenRes.data && tokenRes.data.token;
  if (!token) throw new Error(`token refused: ${tokenRes && tokenRes.message}`);
  const q = new URLSearchParams({ token, city, fuel_type: fuel, timeframe });
  const points = JSON.parse(
    await request(`https://www.goodreturns.in/fuel-graph-data.html?${q}`, {
      headers: { Referer: pageUrl, Authorization: `Bearer ${token}`, "X-Requested-With": "XMLHttpRequest" },
    })
  );
  if (!Array.isArray(points)) throw new Error("unexpected graph data");
  // x is midnight IST as epoch ms.
  const byDate = new Map();
  for (const p of points) {
    if (typeof p.x !== "number" || typeof p.y !== "number") continue;
    byDate.set(new Date(p.x + IST_OFFSET_MS).toISOString().slice(0, 10), p.y);
  }
  return [...byDate.entries()].map(([date, rate]) => ({ date, rate })).sort((a, b) => a.date.localeCompare(b.date));
}

// Fallback: "Last 10 Days Petrol Rate in Gurgaon" table, "October 13, 2026 | ₹102.97".
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function parseTable(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, "|").replace(/&#(8377|x20b9);/gi, "₹");
  const re = new RegExp(`(${MONTHS.join("|")}) (\\d{1,2}), (20\\d{2})[|\\s]*₹\\s*([\\d.]+)`, "g");
  const byDate = new Map();
  let m;
  while ((m = re.exec(text)) !== null) {
    const date = `${m[3]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    if (!byDate.has(date)) byDate.set(date, parseFloat(m[4]));
  }
  return [...byDate.entries()].map(([date, rate]) => ({ date, rate })).sort((a, b) => a.date.localeCompare(b.date));
}

// The series has the odd one-day outlier (107.09 in a run of 102.97).  Drop
// any day more than 3% off the median of the week around it: a lone spike
// goes, a genuine price step survives because the days after it agree.
function dropSpikes(rows) {
  return rows.filter((r, i) => {
    const win = rows.slice(Math.max(0, i - 3), i + 4).map((x) => x.rate).sort((a, b) => a - b);
    const med = win[Math.floor(win.length / 2)];
    return Math.abs(r.rate - med) / med <= 0.03;
  });
}

// goodreturns sometimes reports another company's pump for a single day
// (petrol and diesel both jump ~Rs 0.30 on the same day, then fall back to the
// exact previous price).  Pump prices don't move like that, so a day that
// differs from both neighbours while they agree takes the neighbours' price.
function smoothBlips(rows) {
  let fixed = 0;
  const out = rows.map((r, i) => {
    const prev = rows[i - 1];
    const next = rows[i + 1];
    if (prev && next && prev.rate === next.rate && r.rate !== prev.rate) {
      fixed += 1;
      return { date: r.date, rate: prev.rate };
    }
    return r;
  });
  return { rows: out, fixed };
}

function parseArgs(argv) {
  const opts = { fuel: "petrol", timeframe: "2Y", from: null, to: null, replace: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--from") opts.from = argv[++i];
    else if (argv[i] === "--to") opts.to = argv[++i];
    else if (argv[i] === "--replace") opts.replace = true;
    else if (argv[i] === "--fuel") opts.fuel = String(argv[++i] || "").toLowerCase();
    else if (argv[i] === "--timeframe") opts.timeframe = String(argv[++i] || "").toUpperCase();
    else throw new Error(`Unknown argument "${argv[i]}"`);
  }
  if (!["petrol", "diesel"].includes(opts.fuel)) {
    throw new Error(`--fuel must be petrol or diesel, got "${opts.fuel}"`);
  }
  if (!["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "ALL"].includes(opts.timeframe)) {
    throw new Error(`--timeframe must be one of 1M 3M 6M 1Y 2Y 3Y 5Y ALL, got "${opts.timeframe}"`);
  }
  for (const k of ["from", "to"]) {
    if (opts[k] && !/^\d{4}-\d{2}-\d{2}$/.test(opts[k])) {
      throw new Error(`--${k} must be YYYY-MM-DD, got "${opts[k]}"`);
    }
  }
  return opts;
}

async function main() {
  const { fuel, timeframe, from, to, replace } = parseArgs(process.argv.slice(2));
  const city = CITY;
  const url = `https://www.goodreturns.in/${fuel}-price-in-${city}.html`;
  console.log(`Fetching ${fuel} for ${city} from goodreturns (${timeframe})`);

  let rows = [];
  let via = `graph API, ${timeframe}`;
  try {
    rows = await fetchFromApi(url, city, fuel, timeframe);
  } catch (e) {
    console.log(`Graph API failed (${e.message}); falling back to the page table`);
  }
  if (!rows.length) {
    rows = parseTable(await request(url));
    via = "page table (last ~10 days only)";
  }
  if (!rows.length) throw new Error("No rows parsed — page format may have changed.");
  console.log(`Parsed ${rows.length} rows via ${via}`);
  const parsed = rows.length;
  rows = dropSpikes(rows);
  if (rows.length < parsed) console.log(`Dropped ${parsed - rows.length} stray-price day(s)`);
  const smoothed = smoothBlips(rows);
  rows = smoothed.rows;
  if (smoothed.fixed) console.log(`Smoothed ${smoothed.fixed} one-day blip(s)`);

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
