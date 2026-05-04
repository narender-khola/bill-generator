import React, { Component } from "react";
import "./RentReceipt.css";
import ReactGA from "react-ga4";
import { getHistory, saveAll } from "../utils/inputHistory";

const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatINR = (n) => "₹" + Number(n).toLocaleString("en-IN");

const randomTilt = () => {
  const sign = Math.random() < 0.5 ? -1 : 1;
  return sign * (2 + Math.random() * 3);
};

const HISTORY_KEYS = {
  tenantName: "rent_tenantName",
  tenantPan: "rent_tenantPan",
  landlord1Name: "rent_landlord1Name",
  landlord1Pan: "rent_landlord1Pan",
  landlord2Name: "rent_landlord2Name",
  landlord2Pan: "rent_landlord2Pan",
  propertyAddress: "rent_propertyAddress",
  monthlyRent: "rent_monthlyRent",
};

const buildReceipt = (opts) => {
  const { receiptNo, isMonthly, startYear, startMonth0, endYear, endMonth0, amount, ...rest } = opts;
  let periodLabel, periodPhrase;
  if (isMonthly) {
    const monthFull = MONTHS_FULL[startMonth0];
    periodLabel = `${monthFull.toUpperCase()} ${startYear}`;
    periodPhrase = `for the month of ${monthFull} ${startYear}`;
  } else {
    const startShort = MONTHS_SHORT[startMonth0];
    const endShort = MONTHS_SHORT[endMonth0];
    periodLabel = `${startShort.toUpperCase()} ${startYear} - ${endShort.toUpperCase()} ${endYear}`;
    periodPhrase = `for the period from ${startShort} ${startYear} to ${endShort} ${endYear}`;
  }
  return {
    receiptNo,
    periodLabel,
    periodPhrase,
    amount,
    amountFormatted: formatINR(amount),
    stampTilt: randomTilt(),
    ...rest,
  };
};

export default class RentReceipt extends Component {
  constructor(props) {
    super(props);
    const now = new Date();
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);
    this.state = {
      mode: "quarterly",
      tenantName: last("tenantName", ""),
      tenantPan: last("tenantPan", ""),
      landlord1Name: last("landlord1Name", ""),
      landlord1Pan: last("landlord1Pan", ""),
      landlord2Name: last("landlord2Name", ""),
      landlord2Pan: last("landlord2Pan", ""),
      propertyAddress: last("propertyAddress", ""),
      monthlyRent: last("monthlyRent", "20000"),
      fyStartYear: String(fyStartYear),
      receipts: [],
      pdfView: false,
    };
  }

  onChange = (e, id) => this.setState({ [id]: e.target.value });
  setMode = (mode) => this.setState({ mode });

  generate = () => {
    const { mode, tenantName, tenantPan, landlord1Name, landlord1Pan, landlord2Name, landlord2Pan, propertyAddress, monthlyRent, fyStartYear } = this.state;
    if (!tenantName.trim() || !landlord1Name.trim() || !propertyAddress.trim()) {
      alert("Tenant Name, Landlord 1 Name and Property Address are required");
      return;
    }
    const rent = parseFloat(monthlyRent);
    if (!monthlyRent || isNaN(rent) || rent <= 0) {
      alert("Enter a valid monthly rent");
      return;
    }
    const fy = parseInt(fyStartYear, 10);
    if (isNaN(fy) || fy < 2000 || fy > 2100) {
      alert("Enter a valid FY start year (e.g. 2025 for FY 2025-26)");
      return;
    }

    const landlords = [{ name: landlord1Name.trim(), pan: landlord1Pan.trim() }];
    if (landlord2Name.trim()) {
      landlords.push({ name: landlord2Name.trim(), pan: landlord2Pan.trim() });
    }

    const common = {
      isMonthly: mode === "monthly",
      tenantName: tenantName.trim(),
      tenantPan: tenantPan.trim(),
      propertyAddress: propertyAddress.trim(),
      landlords,
    };

    let receipts = [];
    if (mode === "monthly") {
      for (let i = 0; i < 12; i++) {
        const month0 = (3 + i) % 12;
        const year = fy + (month0 < 3 ? 1 : 0);
        receipts.push(buildReceipt({
          ...common,
          receiptNo: i + 1,
          startYear: year,
          startMonth0: month0,
          endYear: year,
          endMonth0: month0,
          amount: rent,
        }));
      }
    } else {
      const quarters = [
        [3, 5, 0, 0],
        [6, 8, 0, 0],
        [9, 11, 0, 0],
        [0, 2, 1, 1],
      ];
      quarters.forEach(([sm, em, syo, eyo], i) => {
        receipts.push(buildReceipt({
          ...common,
          receiptNo: i + 1,
          startYear: fy + syo,
          startMonth0: sm,
          endYear: fy + eyo,
          endMonth0: em,
          amount: rent * 3,
        }));
      });
    }

    saveAll({
      [HISTORY_KEYS.tenantName]: tenantName.trim(),
      [HISTORY_KEYS.tenantPan]: tenantPan.trim(),
      [HISTORY_KEYS.landlord1Name]: landlord1Name.trim(),
      [HISTORY_KEYS.landlord1Pan]: landlord1Pan.trim(),
      [HISTORY_KEYS.landlord2Name]: landlord2Name.trim(),
      [HISTORY_KEYS.landlord2Pan]: landlord2Pan.trim(),
      [HISTORY_KEYS.propertyAddress]: propertyAddress.trim(),
      [HISTORY_KEYS.monthlyRent]: String(rent),
    });

    this.setState({ receipts, pdfView: true });
    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({
        category: "User Interaction",
        action: "Clicked a Button",
        label: "Generate Rent Receipts",
        mode,
        count: receipts.length,
      });
    }
  };

  render() {
    const { mode, tenantName, tenantPan, landlord1Name, landlord1Pan, landlord2Name, landlord2Pan, propertyAddress, monthlyRent, fyStartYear, receipts, pdfView } = this.state;

    if (pdfView) {
      const total = receipts.reduce((s, r) => s + r.amount, 0);
      return (
        <>
          <div className="noprint bg-result-bar">
            <div className="bg-result-stats">
              <span className="bg-result-stat">Receipts: <strong>{receipts.length}</strong></span>
              <span className="bg-result-stat">Total: <strong>{formatINR(total)}</strong></span>
            </div>
            <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">
              Generate More
            </button>
          </div>
          <div className="rr-receipts">
            {receipts.map((r, idx) => (
              <div key={idx} className="rr-receipt">
                <div className="rr-header">
                  <div>
                    <div className="rr-title">RENT RECEIPT</div>
                    <div className="rr-period-label">{r.periodLabel}</div>
                  </div>
                  <div className="rr-receipt-no">Receipt: {r.receiptNo}</div>
                </div>
                <p className="rr-body">
                  Received sum of <u>{r.amountFormatted}</u> from <u>{r.tenantName}</u> towards the rent of property located at <u>{r.propertyAddress}</u> {r.periodPhrase}.
                </p>
                <div className="rr-bottom">
                  <div className="rr-landlords">
                    {r.landlords.map((l, j) => (
                      <div key={j} className="rr-landlord">
                        {l.name}{l.pan ? ` (${l.pan})` : ""}
                      </div>
                    ))}
                  </div>
                  <div className="rr-stamp-zone">
                    <img
                      src={process.env.PUBLIC_URL + "/images/revenue-stamp.png"}
                      alt="Revenue Stamp"
                      className="rr-stamp"
                      style={{ transform: `rotate(${r.stampTilt.toFixed(2)}deg)` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      );
    }

    return (
      <div className="bg-card">
        <h2 className="bg-card-title">Rent Receipt Generator (HRA)</h2>
        <p className="bg-card-desc">Generate rent receipts for HRA tax claims. Choose monthly or quarterly format.</p>

        <div className="bg-mode" role="tablist">
          <button type="button" className={`bg-mode-btn ${mode === "monthly" ? "active" : ""}`} onClick={() => this.setMode("monthly")}>
            Monthly (12)
          </button>
          <button type="button" className={`bg-mode-btn ${mode === "quarterly" ? "active" : ""}`} onClick={() => this.setMode("quarterly")}>
            Quarterly (4)
          </button>
        </div>

        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Tenant Name <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={tenantName} onChange={(e) => this.onChange(e, "tenantName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Tenant PAN <span className="bg-label-hint">optional</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={tenantPan} onChange={(e) => this.onChange(e, "tenantPan")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Landlord 1 Name <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={landlord1Name} onChange={(e) => this.onChange(e, "landlord1Name")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Landlord 1 PAN <span className="bg-label-hint">optional</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={landlord1Pan} onChange={(e) => this.onChange(e, "landlord1Pan")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Landlord 2 Name <span className="bg-label-hint">optional, joint owner</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={landlord2Name} onChange={(e) => this.onChange(e, "landlord2Name")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Landlord 2 PAN <span className="bg-label-hint">optional</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={landlord2Pan} onChange={(e) => this.onChange(e, "landlord2Pan")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Property Address <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={propertyAddress} onChange={(e) => this.onChange(e, "propertyAddress")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Monthly Rent (Rs.) <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="number" autoComplete="off" value={monthlyRent} onChange={(e) => this.onChange(e, "monthlyRent")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">FY Start Year <span className="bg-label-hint">e.g. 2025 → FY 2025-26</span></label>
            <input className="bg-input" type="number" value={fyStartYear} onChange={(e) => this.onChange(e, "fyStartYear")} />
          </div>
        </div>

        <div className="bg-actions">
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.generate}>
            Generate {mode === "monthly" ? "12 Receipts" : "4 Receipts"}
          </button>
        </div>

        <div className="bg-tips">
          <div className="bg-tips-title">Tips</div>
          <div>Quarterly mode generates 4 receipts (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar). Per-quarter amount is 3 x monthly rent.</div>
          <div>Add Landlord 2 only if the property has joint owners.</div>
          <div>After generating, use Cmd/Ctrl+P to save as PDF.</div>
        </div>
      </div>
    );
  }
}
