import React, { Component } from "react";
import "./FuelRates.css";
import { getFuelSeries } from "./Fueldata";
import { fetchLatestRates, saveFetched, getFetchedAt, getEdits, saveMonthEdits, clearMonthEdits } from "../utils/fuelRates";

const FUELS = [
  { id: "petrol", label: "Petrol" },
  { id: "diesel", label: "Diesel" },
];
const FUEL_STORAGE_KEY = "fuel_bill_fuel_type";
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SOURCE_LABEL = { bundled: "Bundled", fetched: "Fetched", edited: "Edited" };

const pad2 = (n) => String(n).padStart(2, "0");
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const monthLabel = (month) => {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
};
const daysOf = (month) => {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${month}-${pad2(i + 1)}`);
};
const fmt = (v) => (v === undefined || v === null || isNaN(v) ? "" : Number(v).toFixed(2));

const loadFuel = () => {
  try {
    const saved = localStorage.getItem(FUEL_STORAGE_KEY);
    if (FUELS.some((f) => f.id === saved)) return saved;
  } catch (e) {}
  return "petrol";
};

export default class FuelRates extends Component {
  constructor(props) {
    super(props);
    const fuel = loadFuel();
    const month = currentMonth();
    this.state = { fuel, month, draft: this.draftFor(fuel, month), fillValue: "", fetching: false, status: null };
  }

  // Inputs for every day of the month, prefilled with the rate in use today.
  draftFor = (fuel, month) => {
    const byDate = new Map(getFuelSeries(fuel).map((r) => [r.date, r.rate]));
    const draft = {};
    for (const d of daysOf(month)) draft[d] = byDate.has(d) ? fmt(byDate.get(d)) : "";
    return draft;
  };

  load = (fuel, month, status = null) => {
    this.setState({ fuel, month, draft: this.draftFor(fuel, month), status });
  };

  setFuel = (fuel) => {
    try { localStorage.setItem(FUEL_STORAGE_KEY, fuel); } catch (e) {}
    this.load(fuel, this.state.month);
  };

  setMonth = (month) => {
    if (month && month.includes("-")) this.load(this.state.fuel, month);
  };

  isDirty = () => {
    const saved = this.draftFor(this.state.fuel, this.state.month);
    return Object.keys(saved).some((d) => saved[d] !== this.state.draft[d]);
  };

  onRate = (date, value) => this.setState((s) => ({ draft: { ...s.draft, [date]: value } }));

  fillMonth = () => {
    const v = parseFloat(this.state.fillValue);
    if (isNaN(v) || v <= 0) {
      this.setState({ status: { kind: "error", text: "Enter a rate to fill the month with." } });
      return;
    }
    const draft = {};
    for (const d of daysOf(this.state.month)) draft[d] = v.toFixed(2);
    this.setState({ draft, status: null });
  };

  submit = () => {
    const { fuel, month, draft } = this.state;
    // Only keep days that differ from what the bundled + fetched rates already say.
    const underlying = new Map(getFuelSeries(fuel, { includeEdits: false }).map((r) => [r.date, r.rate]));
    const edits = {};
    for (const [date, raw] of Object.entries(draft)) {
      if (String(raw).trim() === "") continue;
      const v = parseFloat(raw);
      if (isNaN(v) || v <= 0 || v > 500) {
        this.setState({ status: { kind: "error", text: `Invalid rate on ${date}: "${raw}"` } });
        return;
      }
      const rate = Math.round(v * 100) / 100;
      if (!underlying.has(date) || Math.abs(underlying.get(date) - rate) > 0.001) edits[date] = rate;
    }
    saveMonthEdits(fuel, month, edits);
    const n = Object.keys(edits).length;
    this.load(fuel, month, {
      kind: "ok",
      text: n ? `Saved ${n} edited day(s) for ${monthLabel(month)}. Fuel bills now use these rates.` : `No changes from the stored rates for ${monthLabel(month)}.`,
    });
  };

  resetMonth = () => {
    const { fuel, month } = this.state;
    clearMonthEdits(fuel, month);
    this.load(fuel, month, { kind: "ok", text: `Removed your edits for ${monthLabel(month)}.` });
  };

  fetchLatest = async () => {
    const { fuel } = this.state;
    this.setState({ fetching: true, status: { kind: "info", text: "Fetching from bankbazaar…" } });
    try {
      const rows = await fetchLatestRates(fuel);
      saveFetched(fuel, rows);
      const last = rows[rows.length - 1];
      this.setState({ fetching: false });
      this.load(this.state.fuel, this.state.month, {
        kind: "ok",
        text: `Fetched ${rows.length} days (${rows[0].date} → ${last.date}). Latest ${fuel}: ₹${fmt(last.rate)}.`,
      });
    } catch (e) {
      this.setState({
        fetching: false,
        status: { kind: "error", text: `Couldn't fetch: ${e.message}. Try again in a minute, or enter the rates by hand below.` },
      });
    }
  };

  exportEdits = () => {
    const out = {};
    for (const f of FUELS) out[f.id] = getEdits(f.id);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fuel-rate-edits.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  render() {
    const { fuel, month, draft, fillValue, fetching, status } = this.state;
    const series = getFuelSeries(fuel);
    const bySource = new Map(series.map((r) => [r.date, r]));
    const latest = series[series.length - 1];
    const fetchedAt = getFetchedAt(fuel);
    const dirty = this.isDirty();

    // Previous day's rate, shown as a placeholder for days with no stored rate.
    let prev = null;
    for (const r of series) {
      if (r.date >= `${month}-01`) break;
      prev = r.rate;
    }

    // Last 12 months at a glance.
    const overview = [];
    for (let i = 0; i < 12; i++) {
      const m = shiftMonth(currentMonth(), -i);
      const rows = series.filter((r) => r.date.startsWith(m));
      if (!rows.length) continue;
      const rates = rows.map((r) => r.rate);
      overview.push({
        month: m,
        avg: rates.reduce((a, b) => a + b, 0) / rates.length,
        min: Math.min(...rates),
        max: Math.max(...rates),
        days: rows.length,
        edited: rows.filter((r) => r.source === "edited").length,
      });
    }

    return (
      <div className="bg-card">
        <h2 className="bg-card-title">Fuel Rates</h2>
        <p className="bg-card-desc">
          Daily Delhi pump prices used by the Fuel Bill generator. Fetch the latest, or correct a month by hand and submit it.
        </p>

        <div className="bg-mode-row">
          <div className="bg-mode" role="tablist">
            {FUELS.map((f) => (
              <button key={f.id} type="button" className={`bg-mode-btn ${fuel === f.id ? "active" : ""}`} onClick={() => this.setFuel(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fr-summary">
          <div className="bg-result-stats">
            <span className="bg-result-stat">Latest: <strong>{latest ? `₹${fmt(latest.rate)}` : "—"}</strong></span>
            <span className="bg-result-stat">As of: <strong>{latest ? latest.date : "—"}</strong></span>
            <span className="bg-result-stat">
              Last fetched: <strong>{fetchedAt ? new Date(fetchedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "never (bundled data)"}</strong>
            </span>
          </div>
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.fetchLatest} disabled={fetching}>
            {fetching ? "Fetching…" : "Fetch latest rates"}
          </button>
        </div>

        {status ? <div className={`fr-status fr-status-${status.kind}`}>{status.text}</div> : null}

        <div className="fr-month-bar">
          <button type="button" className="bg-btn bg-btn-ghost" onClick={() => this.setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <input className="bg-input fr-month-input" type="month" value={month} onChange={(e) => this.setMonth(e.target.value)} />
          <button type="button" className="bg-btn bg-btn-ghost" onClick={() => this.setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
          <div className="fr-fill">
            <input
              className="bg-input"
              type="number"
              step="0.01"
              placeholder="Rate for every day"
              value={fillValue}
              onChange={(e) => this.setState({ fillValue: e.target.value })}
            />
            <button type="button" className="bg-btn bg-btn-secondary" onClick={this.fillMonth}>Fill month</button>
          </div>
        </div>

        <div className="fr-table-wrap">
          <table className="fr-table">
            <thead>
              <tr><th>Date</th><th>Day</th><th>Rate (₹/L)</th><th>Source</th></tr>
            </thead>
            <tbody>
              {daysOf(month).map((d) => {
                const stored = bySource.get(d);
                if (stored) prev = stored.rate;
                const changed = (stored ? fmt(stored.rate) : "") !== draft[d];
                const [y, m, day] = d.split("-").map(Number);
                return (
                  <tr key={d} className={changed ? "fr-row-changed" : ""}>
                    <td>{pad2(day)} {MONTHS_SHORT[m - 1]}</td>
                    <td className="fr-muted">{WEEKDAYS[new Date(y, m - 1, day).getDay()]}</td>
                    <td>
                      <input
                        className="bg-input fr-rate-input"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={draft[d]}
                        placeholder={prev !== null ? fmt(prev) : ""}
                        onChange={(e) => this.onRate(d, e.target.value)}
                      />
                    </td>
                    <td>
                      {changed ? (
                        <span className="fr-badge fr-badge-changed">Unsaved</span>
                      ) : stored ? (
                        <span className={`fr-badge fr-badge-${stored.source}`}>{SOURCE_LABEL[stored.source]}</span>
                      ) : (
                        <span className="fr-badge fr-badge-missing">No rate</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-actions">
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.submit}>
            Submit {monthLabel(month)}
          </button>
          <button type="button" className="bg-btn bg-btn-secondary" onClick={() => this.load(fuel, month)} disabled={!dirty}>
            Discard changes
          </button>
          <button type="button" className="bg-btn bg-btn-ghost" onClick={this.resetMonth}>
            Reset month to stored rates
          </button>
        </div>

        {overview.length ? (
          <>
            <h3 className="fr-section-title">Last 12 months</h3>
            <div className="fr-table-wrap">
              <table className="fr-table fr-overview">
                <thead>
                  <tr><th>Month</th><th>Avg</th><th>Min</th><th>Max</th><th>Days</th><th>Edited</th></tr>
                </thead>
                <tbody>
                  {overview.map((o) => (
                    <tr key={o.month} className={o.month === month ? "fr-row-active" : ""} onClick={() => this.setMonth(o.month)}>
                      <td>{monthLabel(o.month)}</td>
                      <td>{fmt(o.avg)}</td>
                      <td>{fmt(o.min)}</td>
                      <td>{fmt(o.max)}</td>
                      <td>{o.days}</td>
                      <td>{o.edited || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        <div className="bg-tips">
          <div className="bg-tips-title">How it works</div>
          <div>Fetched and edited rates are saved in this browser only and override the rates built into the site. Edits win over fetched rates.</div>
          <div>Fetching goes through a free public proxy because bankbazaar blocks direct browser requests, so it can fail now and then; just retry.</div>
          <div>
            <button type="button" className="fr-link" onClick={this.exportEdits}>Export your edits as JSON</button> to keep a copy.
          </div>
        </div>
      </div>
    );
  }
}
