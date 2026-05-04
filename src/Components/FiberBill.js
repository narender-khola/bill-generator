import React, { Component } from "react";
import "./FiberBill.css";
import ReactGA from "react-ga4";
import { getHistory, saveAll } from "../utils/inputHistory";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PAYMENT_SOURCES = [
  "Self-care payment via Amazon Wallet",
  "Self-care payment via Paytm Wallet",
  "Self-care payment via Google Pay",
  "Self-care payment via PhonePe",
  "Self-care payment via UPI",
  "Auto-debit from registered card",
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const formatTime = (h, m, s) => {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${period}`;
};

const HISTORY_KEYS = {
  customerName: "fiber_customerName",
  accountNumber: "fiber_accountNumber",
  dslNumber: "fiber_dslNumber",
  amount: "fiber_amount",
};

const buildBill = ({ customerName, accountNumber, dslNumber, amount, year, month0, monthIndex }) => {
  const day = randInt(1, 15);
  const dateStr = `${day}/${MONTHS_SHORT[month0]}/${String(year).slice(-2)}`;
  const time = formatTime(randInt(8, 22), randInt(0, 59), randInt(0, 59));
  const receiptNumber = String(99000000 + monthIndex * 500000 + randInt(0, 400000));
  const txnRef = `200${String(month0 + 1).padStart(2, "0")}${String(randInt(10, 28)).padStart(2, "0")}${randInt(100000, 999999)}`;
  const paymentFrom = PAYMENT_SOURCES[randInt(0, PAYMENT_SOURCES.length - 1)];
  return {
    customerName: customerName.toUpperCase(),
    accountNumber,
    dslNumber,
    amount,
    amountFormatted: `Rs.${amount.toFixed(2)}`,
    dateStr,
    time,
    receiptNumber,
    txnRef,
    paymentFrom,
  };
};

export default class FiberBill extends Component {
  constructor(props) {
    super(props);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);
    this.state = {
      mode: "year",
      customerName: last("customerName", ""),
      accountNumber: last("accountNumber", ""),
      dslNumber: last("dslNumber", ""),
      amount: last("amount", "3140"),
      month: currentMonth,
      fyStartYear: String(fyStartYear),
      bills: [],
      pdfView: false,
    };
  }

  onChange = (e, id) => this.setState({ [id]: e.target.value });
  setMode = (mode) => this.setState({ mode });

  generate = () => {
    const { mode, customerName, accountNumber, dslNumber, amount, month, fyStartYear } = this.state;
    if (!customerName.trim() || !accountNumber.trim() || !dslNumber.trim()) {
      alert("Customer Name, Account Number and DSL/Fixed Line Number are required");
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      alert("Enter a valid monthly amount");
      return;
    }

    const common = {
      customerName: customerName.trim(),
      accountNumber: accountNumber.trim(),
      dslNumber: dslNumber.trim(),
      amount: amt,
    };

    let bills = [];
    if (mode === "single") {
      if (!month || !month.includes("-")) {
        alert("Pick a month");
        return;
      }
      const [y, m] = month.split("-").map(Number);
      bills.push(buildBill({ ...common, year: y, month0: m - 1, monthIndex: 0 }));
    } else {
      const fy = parseInt(fyStartYear, 10);
      if (isNaN(fy) || fy < 2000 || fy > 2100) {
        alert("Enter a valid FY start year (e.g. 2025 for FY 2025-26)");
        return;
      }
      for (let i = 0; i < 12; i++) {
        const month0 = (3 + i) % 12;
        const year = fy + (month0 < 3 ? 1 : 0);
        bills.push(buildBill({ ...common, year, month0, monthIndex: i }));
      }
    }

    saveAll({
      [HISTORY_KEYS.customerName]: common.customerName,
      [HISTORY_KEYS.accountNumber]: common.accountNumber,
      [HISTORY_KEYS.dslNumber]: common.dslNumber,
      [HISTORY_KEYS.amount]: String(common.amount),
    });

    let title;
    if (mode === "single") {
      const [y, m] = month.split("-").map(Number);
      title = `Phone Bill - ${MONTHS_SHORT[m - 1]} ${y}`;
    } else {
      const fy = parseInt(fyStartYear, 10);
      title = `Phone Bill - FY ${fy}-${String(fy + 1).slice(-2)}`;
    }
    document.title = title;

    this.setState({ bills, pdfView: true });
    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({
        category: "User Interaction",
        action: "Clicked a Button",
        label: "Generate Phone Bills",
        mode,
        count: bills.length,
      });
    }
  };

  render() {
    const { mode, customerName, accountNumber, dslNumber, amount, month, fyStartYear, bills, pdfView } = this.state;

    if (pdfView) {
      const total = bills.reduce((s, b) => s + b.amount, 0);
      return (
        <>
          <div className="noprint bg-result-bar">
            <div className="bg-result-stats">
              <span className="bg-result-stat">Bills: <strong>{bills.length}</strong></span>
              <span className="bg-result-stat">Total: <strong>Rs.{total.toFixed(2)}</strong></span>
            </div>
            <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">
              Generate More
            </button>
          </div>
          {bills.map((b, idx) => (
            <div key={idx} className="fb-bill">
              <div className="fb-top-text">airtel: Prepaid | Postpaid | Broadband | 4G | DTH Services in India</div>
              <div className="fb-content">
                <div className="fb-left">
                  <div className="fb-logo">airtel</div>
                  <h1 className="fb-title">Payment Details</h1>
                  <div className="fb-date">{b.dateStr}</div>
                  <div className="fb-info-icon" aria-hidden="true">&#9432;</div>
                  <ol className="fb-terms">
                    <li>All payments made are subject to realization of the same.</li>
                    <li>Customer is liable to pay surcharge levied for delayed payment at such rates as specified by Airtel from time to time.</li>
                    <li>Customer is advised to make payment in full of the due amount along with delayed payment charges, if any.</li>
                    <li>The payment made by the customer vide this receipt shall under no circumstances be deemed for full &amp; final settlement.</li>
                    <li>All claims subject to exclusive jurisdiction of Delhi courts only.</li>
                    <li>This is a system generated document and does not require signature. Any unauthorized use, disclosure, dissemination, or copying of this document is strictly prohibited and may be unlawful.</li>
                  </ol>
                </div>
                <div className="fb-right">
                  <div className="fb-row-receipt">
                    <div className="fb-field">
                      <div className="fb-field-label">RECEIPT NUMBER</div>
                      <div className="fb-field-value">{b.receiptNumber}</div>
                    </div>
                    <div className="fb-print-icon" aria-hidden="true">&#x1F5B6;</div>
                  </div>
                  <div className="fb-row">
                    <div className="fb-field">
                      <div className="fb-field-label">NAME</div>
                      <div className="fb-field-value">{b.customerName}</div>
                    </div>
                    <div className="fb-field">
                      <div className="fb-field-label">ACCOUNT</div>
                      <div className="fb-field-value">{b.accountNumber}</div>
                    </div>
                  </div>
                  <div className="fb-row">
                    <div className="fb-field">
                      <div className="fb-field-label">DSL/FIXED LINE NUMBER</div>
                      <div className="fb-field-value">{b.dslNumber}</div>
                    </div>
                    <div className="fb-field">
                      <div className="fb-field-label">TRANSACTION REFERENCE</div>
                      <div className="fb-field-value">{b.txnRef}</div>
                    </div>
                  </div>
                  <div className="fb-row">
                    <div className="fb-field">
                      <div className="fb-field-label">PAYMENT TIME</div>
                      <div className="fb-field-value">{b.time}</div>
                    </div>
                    <div className="fb-field">
                      <div className="fb-field-label">PAYMENT FROM</div>
                      <div className="fb-field-value">{b.paymentFrom}</div>
                    </div>
                  </div>
                  <hr className="fb-divider" />
                  <div className="fb-field">
                    <div className="fb-field-label">AMOUNT PAID</div>
                    <div className="fb-field-value">{b.amountFormatted}</div>
                  </div>
                </div>
              </div>
              <div className="fb-footer">
                <span>https://www.airtel.in/s/selfcare/broadband/{b.dslNumber}_dsl/DSL/bill/payment-history</span>
                <span>1/1</span>
              </div>
            </div>
          ))}
        </>
      );
    }

    return (
      <div className="bg-card">
        <h2 className="bg-card-title">Phone / Fiber Bill Generator</h2>
        <p className="bg-card-desc">Generate Airtel-style broadband payment receipts.</p>

        <div className="bg-mode" role="tablist">
          <button type="button" className={`bg-mode-btn ${mode === "single" ? "active" : ""}`} onClick={() => this.setMode("single")}>
            Single Month
          </button>
          <button type="button" className={`bg-mode-btn ${mode === "year" ? "active" : ""}`} onClick={() => this.setMode("year")}>
            Financial Year (12)
          </button>
        </div>

        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Customer Name <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={customerName} onChange={(e) => this.onChange(e, "customerName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Account Number <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={accountNumber} onChange={(e) => this.onChange(e, "accountNumber")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">DSL / Fixed Line Number <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={dslNumber} onChange={(e) => this.onChange(e, "dslNumber")} />
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
            <div className="bg-field">
              <label className="bg-label">FY Start Year <span className="bg-label-hint">e.g. 2025 → FY 2025-26</span></label>
              <input className="bg-input" type="number" value={fyStartYear} onChange={(e) => this.onChange(e, "fyStartYear")} />
            </div>
          )}
        </div>

        <div className="bg-actions">
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.generate}>
            Generate {mode === "year" ? "12 Bills" : "Bill"}
          </button>
        </div>

        <div className="bg-tips">
          <div className="bg-tips-title">Tips</div>
          <div>Receipt numbers, transaction references, payment dates, times, and payment methods are randomized per bill.</div>
          <div>FY mode generates 12 bills (Apr-Mar). Each prints on its own page.</div>
        </div>
      </div>
    );
  }
}
