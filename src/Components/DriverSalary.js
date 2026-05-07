import React, { Component } from "react";
import "./DriverSalary.css";
import ReactGA from "react-ga4";
import { getHistory, saveAll } from "../utils/inputHistory";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatDate = (d) => `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;

const randomTilt = () => {
  const sign = Math.random() < 0.5 ? -1 : 1;
  return sign * (1 + Math.random() * 2);
};

const buildReceipt = ({ employeeName, driverName, vehicleNumber, amount, year, month0 }) => {
  const start = new Date(year, month0, 1);
  const end = new Date(year, month0 + 1, 0);
  return {
    date: formatDate(start),
    periodStart: formatDate(start),
    periodEnd: formatDate(end),
    amount,
    employeeName,
    driverName,
    vehicleNumber,
    stampTilt: randomTilt(),
  };
};

const HISTORY_KEYS = {
  employeeName: "driver_employeeName",
  driverName: "driver_driverName",
  vehicleNumber: "driver_vehicleNumber",
  amount: "driver_amount",
};

export default class DriverSalary extends Component {
  constructor(props) {
    super(props);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const last = (k, fallback) => (getHistory(HISTORY_KEYS[k])[0] ?? fallback);
    this.state = {
      mode: "single",
      employeeName: last("employeeName", ""),
      driverName: last("driverName", ""),
      vehicleNumber: last("vehicleNumber", ""),
      amount: last("amount", "20000"),
      month: currentMonth,
      fyStartYear: String(fyStartYear),
      endMonth: "",
      receipts: [],
      pdfView: false,
    };
  }

  onChange = (e, id) => this.setState({ [id]: e.target.value });

  setMode = (mode) => this.setState({ mode });

  generate = () => {
    const { mode, employeeName, driverName, vehicleNumber, amount, month, fyStartYear, endMonth } = this.state;
    if (!employeeName.trim() || !driverName.trim() || !vehicleNumber.trim()) {
      alert("Employee Name, Driver Name and Vehicle Number are required");
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      alert("Enter a valid monthly amount");
      return;
    }

    const common = {
      employeeName: employeeName.trim(),
      driverName: driverName.trim(),
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      amount: amt,
    };

    let receipts = [];
    if (mode === "single") {
      if (!month || !month.includes("-")) {
        alert("Pick a month");
        return;
      }
      const [y, m] = month.split("-").map(Number);
      receipts.push(buildReceipt({ ...common, year: y, month0: m - 1 }));
    } else {
      const fy = parseInt(fyStartYear, 10);
      if (isNaN(fy) || fy < 2000 || fy > 2100) {
        alert("Enter a valid FY start year (e.g. 2025 for FY 2025-26)");
        return;
      }
      let endY = null, endM0 = null;
      if (endMonth && endMonth.includes("-")) {
        const [ey, em] = endMonth.split("-").map(Number);
        endY = ey; endM0 = em - 1;
      }
      for (let i = 0; i < 12; i++) {
        const month0 = (3 + i) % 12;
        const year = fy + (month0 < 3 ? 1 : 0);
        if (endY !== null && (year > endY || (year === endY && month0 > endM0))) break;
        receipts.push(buildReceipt({ ...common, year, month0 }));
      }
      if (receipts.length === 0) {
        alert("End month is before the start of the financial year");
        return;
      }
    }

    saveAll({
      [HISTORY_KEYS.employeeName]: common.employeeName,
      [HISTORY_KEYS.driverName]: common.driverName,
      [HISTORY_KEYS.vehicleNumber]: common.vehicleNumber,
      [HISTORY_KEYS.amount]: String(common.amount),
    });

    let title;
    if (mode === "single") {
      const [y, m] = month.split("-").map(Number);
      title = `Driver Salary - ${MONTHS_SHORT[m - 1]} ${y}`;
    } else {
      const fy = parseInt(fyStartYear, 10);
      title = `Driver Salary - FY ${fy}-${String(fy + 1).slice(2)}`;
    }
    document.title = title;

    this.setState({ receipts, pdfView: true });
    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({
        category: "User Interaction",
        action: "Clicked a Button",
        label: "Generate Driver Salary Receipts",
        mode,
        count: receipts.length,
      });
    }
  };

  render() {
    const { mode, employeeName, driverName, vehicleNumber, amount, month, fyStartYear, endMonth, receipts, pdfView } = this.state;

    if (pdfView) {
      const totalAmount = receipts.reduce((s, r) => s + r.amount, 0);
      return (
        <>
          <div className="noprint bg-result-bar">
            <div className="bg-result-stats">
              <span className="bg-result-stat">Receipts: <strong>{receipts.length}</strong></span>
              <span className="bg-result-stat">Total: <strong>₹ {totalAmount.toLocaleString("en-IN")}</strong></span>
            </div>
            <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">
              Generate More
            </button>
          </div>
          <div className="ds-receipts">
            {receipts.map((r, idx) => (
              <div key={idx} className="ds-receipt">
                <div className="ds-receipt-date">Date: {r.date}</div>
                <h2 className="ds-receipt-title">Driver Salary Receipt</h2>
                <p className="ds-receipt-body">
                  This is to certify that Mr./Ms. <strong>{r.employeeName}</strong> have paid{" "}
                  <strong>Rs. {r.amount.toLocaleString("en-IN")}</strong> to driver Mr/Ms{" "}
                  <strong>{r.driverName}</strong> towards salary of the period{" "}
                  <strong>{r.periodStart}</strong> to <strong>{r.periodEnd}</strong> (Acknowledged
                  receipt enclosed). I also declare that the driver is exclusively utilized for
                  official purpose only.
                </p>
                <p className="ds-receipt-body">
                  Please reimburse the above amount. I further declare that what is stated above is
                  correct and true.
                </p>
                <div className="ds-receipt-row"><span className="ds-receipt-label">Vehicle Number:</span> {r.vehicleNumber}</div>
                <div className="ds-receipt-row"><span className="ds-receipt-label">Driver Name:</span> {r.driverName}</div>
                <div className="ds-revenue-stamp-wrap">
                  <img
                    src={process.env.PUBLIC_URL + "/images/revenue-stamp.png"}
                    alt="Revenue Stamp"
                    className="ds-revenue-stamp-img"
                    style={{ transform: `rotate(${r.stampTilt.toFixed(2)}deg)` }}
                  />
                </div>
                <div className="ds-receipt-row"><span className="ds-receipt-label">Period:</span> {r.periodStart} - {r.periodEnd}</div>
                <div className="ds-receipt-row"><span className="ds-receipt-label">Employee Name:</span> {r.employeeName}</div>
              </div>
            ))}
          </div>
        </>
      );
    }

    return (
      <div className="bg-card">
        <h2 className="bg-card-title">Driver Salary Receipt Generator</h2>
        <p className="bg-card-desc">Generate driver salary receipts for tax/reimbursement claims.</p>

        <div className="bg-mode" role="tablist">
          <button type="button" className={`bg-mode-btn ${mode === "single" ? "active" : ""}`} onClick={() => this.setMode("single")}>
            Single Month
          </button>
          <button type="button" className={`bg-mode-btn ${mode === "year" ? "active" : ""}`} onClick={() => this.setMode("year")}>
            Financial Year (12 receipts)
          </button>
        </div>

        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Employee Name <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={employeeName} onChange={(e) => this.onChange(e, "employeeName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Driver Name <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={driverName} onChange={(e) => this.onChange(e, "driverName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Vehicle Number <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={vehicleNumber} onChange={(e) => this.onChange(e, "vehicleNumber")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Monthly Amount (Rs.) <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="number" autoComplete="off" value={amount} onChange={(e) => this.onChange(e, "amount")} />
          </div>
          {mode === "single" ? (
            <div className="bg-field">
              <label className="bg-label">Month <span className="bg-label-hint">required</span></label>
              <input className="bg-input" type="month" value={month} onChange={(e) => this.onChange(e, "month")} />
            </div>
          ) : (
            <>
              <div className="bg-field">
                <label className="bg-label">FY Start Year <span className="bg-label-hint">e.g. 2025 → FY 2025-26</span></label>
                <input className="bg-input" type="number" value={fyStartYear} onChange={(e) => this.onChange(e, "fyStartYear")} />
              </div>
              <div className="bg-field">
                <label className="bg-label">End Month <span className="bg-label-hint">optional — stop after this month</span></label>
                <input className="bg-input" type="month" value={endMonth} onChange={(e) => this.onChange(e, "endMonth")} />
              </div>
            </>
          )}
        </div>

        <div className="bg-actions">
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.generate}>
            Generate {mode === "year" ? (endMonth ? "Receipts up to End Month" : "12 Receipts") : "Receipt"}
          </button>
        </div>

        <div className="bg-tips">
          <div className="bg-tips-title">Tips</div>
          <div>Use Single Month for one-off receipts, or Financial Year to generate all 12 monthly receipts at once.</div>
          <div>Receipts are dated to the first of each month and cover that full month.</div>
          <div>After generating, use your browser's Print (Ctrl/Cmd+P) to save as PDF.</div>
        </div>
      </div>
    );
  }
}
