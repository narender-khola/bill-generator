#!/usr/bin/env node
// Fetches Delhi petrol price history from bankbazaar.com (~10 days)
// and writes JSON to src/components/petrol-latest.json.
// Usage: node scripts/fetch-petrol.js [city]
// Default city = delhi. Supported cities follow bankbazaar URL slugs
// (delhi, mumbai, bangalore, chennai, kolkata, hyderabad, ...).

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

async function main() {
  const city = (process.argv[2] || "delhi").toLowerCase();
  const url = `https://www.bankbazaar.com/fuel/petrol-price-${city}.html`;
  console.log(`Fetching ${url}`);
  const html = await fetchHtml(url);
  const rows = parseRows(html);
  if (!rows.length) throw new Error("No rows parsed — page format may have changed.");

  const outPath = path.join(__dirname, "..", "src", "components", "petrol-latest.json");
  const payload = {
    source: url,
    city,
    fetchedAt: new Date().toISOString(),
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
