import React, { Component, useEffect, useRef } from "react";
import "./AirtelBlackBill.css";
import ReactGA from "react-ga4";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import { getHistory, saveAll } from "../utils/inputHistory";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Airtel bills on the 27th for the period 26th of last month to 25th of this
// month, due ten days later on the 6th.
const STATEMENT_DAY = 27;
// Late fee is Rs.100 + 18% GST per service.
const LATE_FEE = 118;
const GST = 0.18;

const PAYMENT_METHODS = [
  "payment via airtel pay (payu)",
  "payment via airtel thanks app (upi)",
  "payment via airtel payments bank",
  "auto pay via credit card (si)",
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const r2 = (n) => Math.round(n * 100) / 100;
const f2 = (n) => n.toFixed(2);
const inr = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dmy = (d) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
const dmy2 = (d) => `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
const slash = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const dashed = (d) => `${String(d.getDate()).padStart(2, "0")}-${MONTHS_SHORT[d.getMonth()]}-${d.getFullYear()}`;
const monAbbr = (d) => `${MONTHS_SHORT[d.getMonth()]}'${String(d.getFullYear()).slice(-2)}`;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const below1000 = (n) => {
  const out = [];
  if (n >= 100) { out.push(ONES[Math.floor(n / 100)], "Hundred"); n %= 100; }
  if (n >= 20) { out.push(TENS[Math.floor(n / 10)]); n %= 10; }
  if (n > 0) out.push(ONES[n]);
  return out.join(" ");
};
const intWords = (n) => {
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(below1000(crore), "Crore");
  if (lakh) parts.push(below1000(lakh), "Lakh");
  if (thousand) parts.push(below1000(thousand), "Thousand");
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
};
// "Two Thousand Three Hundred Fifty Eight Rupees And Eighty Two Paise Only"
const rupeesInWords = (amount, and = "And") => {
  const paise = Math.round(amount * 100);
  return `${intWords(Math.floor(paise / 100))} Rupees ${and} ${intWords(paise % 100)} Paise Only`;
};

const Barcode = ({ value }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, String(value), {
        format: "CODE128",
        displayValue: false,
        height: 30,
        width: 1.1,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {}
  }, [value]);
  return <svg ref={ref} className="ab-barcode" />;
};

const AirtelLogo = ({ light }) => (
  <img
    src={process.env.PUBLIC_URL + "/images/airtel-logo.png"}
    alt="airtel"
    className={`ab-logo ${light ? "ab-logo-light" : ""}`}
  />
);

const HISTORY_KEYS = {
  customerName: "ab_customerName",
  email: "ab_email",
  rtn: "ab_rtn",
  address: "ab_address",
  blackId: "ab_blackId",
  connections: "ab_connections",
  planName: "ab_planName",
  accountNo: "ab_accountNo",
  fixedline: "ab_fixedline",
  wifiId: "ab_wifiId",
  wifiRental: "ab_wifiRental",
  wifiDiscount: "ab_wifiDiscount",
  speed: "ab_speed",
  mobileRental: "ab_mobileRental",
  state: "ab_state",
  stateCode: "ab_stateCode",
};

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Default bill date / due date for a "YYYY-MM" month: the 27th, due the 6th of next month.
const defaultDates = (month) => {
  const [y, m] = month.split("-").map(Number);
  return { billDate: iso(new Date(y, m - 1, STATEMENT_DAY)), dueDate: iso(new Date(y, m, 6)) };
};

const parseISO = (v) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// `actual` holds the bill no / bill date / due date copied from the real bill;
// anything left blank is generated.
const buildBill = (f, year, month0, actual = {}) => {
  const stmt = actual.billDate ? parseISO(actual.billDate) : new Date(year, month0, STATEMENT_DAY);
  const from = new Date(year, month0 - 1, 26);
  const to = new Date(year, month0, 25);
  const due = actual.dueDate ? parseISO(actual.dueDate) : new Date(year, month0 + 1, 6);
  const paidOn = new Date(year, month0, randInt(5, 20));

  const flNet = r2(f.wifiRental - f.wifiDiscount);
  const flHalfTax = r2(flNet * GST / 2);
  const flTax = r2(flHalfTax * 2);
  const flTotal = r2(flNet + flTax);
  const mobTax = r2(f.mobileRental * GST);
  const mobTotal = r2(f.mobileRental + mobTax);
  const blackTotal = r2(flTotal + mobTotal);
  const history = [0, 1, 2, 3].map((i) => new Date(year, month0 - i, 1));

  return {
    ...f,
    stmtDate: dmy(stmt),
    stmtDate2: dmy2(stmt),
    periodDash: `${dmy(from)} - ${dmy(to)}`,
    periodTo: `${dmy(from)} to ${dmy(to)}`,
    fromSlash: slash(from),
    toSlash: slash(to),
    dueDate: dmy(due),
    dueDate2: dmy2(due),
    dueShort: `${due.getDate()} ${MONTHS_SHORT[due.getMonth()]}`,
    dueShort2: `${String(due.getDate()).padStart(2, "0")}${MONTHS_SHORT[due.getMonth()]}`,
    paidOn: dashed(paidOn),
    paymentMethod: PAYMENT_METHODS[randInt(0, PAYMENT_METHODS.length - 1)],
    billNo: actual.billNo || `HF${String(stmt.getDate()).padStart(2, "0")}${f.stateCode.padStart(2, "0")}I00${randInt(1000000, 9999999)}`,
    flNet,
    flHalfTax,
    flTax,
    flTotal,
    flLate: r2(flTotal + LATE_FEE),
    flWords: rupeesInWords(flTotal, "and"),
    planCharges: r2(f.wifiRental + f.mobileRental),
    revised: r2(f.wifiRental + f.mobileRental - f.wifiDiscount),
    blackTax: r2(flTax + mobTax),
    blackTotal,
    blackLate: r2(blackTotal + LATE_FEE * 2),
    blackWords: rupeesInWords(blackTotal),
    history: history.map((d) => monAbbr(d)),
    monthLabel: `${MONTHS_SHORT[month0]} ${year}`,
  };
};

const BlackStatement = ({ b }) => (
  <div className="ab-page">
    <div className="ab-black-head">
      <span>Black Monthly Statement</span>
      <AirtelLogo light />
    </div>

    <div className="ab-black-top">
      <div className="ab-black-cust">
        <div className="ab-cust-name">{b.customerName}</div>
        <div className="ab-muted">Registered Email:</div>
        <div className="ab-strong">{b.email}</div>
        <div className="ab-muted">Registered Telephone Number (RTN):</div>
        <div className="ab-strong">{b.rtn}</div>
        <div className="ab-plan-label">Your Plan:</div>
        <div className="ab-plan-name">{b.planName}</div>
        <div className="ab-kv-grid">
          <div><div className="ab-muted">Airtel Black ID</div><div className="ab-strong">{b.blackId}</div></div>
          <div><div className="ab-muted">Number of connections</div><div className="ab-strong">{b.connections}</div></div>
          <div><div className="ab-muted">Statement Date</div><div className="ab-strong">{b.stmtDate}</div></div>
          <div><div className="ab-muted">Statement Period</div><div className="ab-strong">{b.periodDash}</div></div>
        </div>
      </div>
      <div className="ab-pay-box">
        <div className="ab-pay-box-top">
          <div>
            <div className="ab-muted">Total Amount Payable:</div>
            <div className="ab-big">₹{inr(b.blackTotal)}</div>
          </div>
          <div className="ab-right">
            <div className="ab-muted">Due Date:</div>
            <div className="ab-big">{b.dueDate}</div>
          </div>
        </div>
        <div className="ab-pay-box-bottom">
          <div className="ab-pay-via">
            <div>Pay via</div>
            <div>Airtel Thanks App</div>
            <div className="ab-link">www.airtel.in/pay</div>
          </div>
          <div className="ab-qr-block">
            <QRCodeSVG value={`upi://pay?pa=${b.blackId}.BLACK@mairtel&pn=Airtel&am=${f2(b.blackTotal)}`} size={106} level="L" />
            <div className="ab-tiny">Scan and pay via any UPI apps</div>
            <div className="ab-tiny">Powered by <b className="ab-red">airtel</b> <span className="ab-pb">Payments Bank</span></div>
          </div>
        </div>
      </div>
    </div>

    <div className="ab-dark-strip">
      <div><span>Last bill amount</span><b>₹{inr(b.blackTotal)}</b></div>
      <em>-</em>
      <div><span>Payment made</span><b>₹{inr(b.blackTotal)}</b></div>
      <em>-</em>
      <div><span>Payment Coupon</span><b>₹0.00</b></div>
      <em>-</em>
      <div><span>Credits</span><b>₹0.00</b></div>
      <em>+</em>
      <div><span>This Month's Charges</span><b>₹{inr(b.blackTotal)}</b></div>
      <em>=</em>
      <div><span className="ab-white">Total Amount</span><b>₹{inr(b.blackTotal)}</b></div>
      <div><span className="ab-white">Amount after due date ({b.dueShort})</span><b>₹{inr(b.blackLate)}</b></div>
    </div>

    <div className="ab-box">
      <div className="ab-box-head"><span>This Month's Charges Summary</span><small>(Amounts in ₹)</small></div>
      <table className="ab-sum-table">
        <thead>
          <tr><th>Services</th><th>Connections</th><th>Plan Charges</th><th>Other Charges</th><th>Total</th></tr>
        </thead>
        <tbody>
          <tr><td>Airtel Black Plan - {b.blackId}</td><td>{b.connections}</td><td>{inr(b.planCharges)}</td><td>0.00</td><td>{inr(b.planCharges)}</td></tr>
          <tr><td>Plan Discount</td><td>-</td><td>{inr(b.wifiDiscount)}</td><td>-</td><td>{inr(b.wifiDiscount)}</td></tr>
          <tr><td>Revised Charges</td><td>-</td><td>{inr(b.revised)}</td><td>-</td><td>{inr(b.revised)}</td></tr>
          <tr><td>Taxes</td><td>-</td><td>{inr(b.blackTax)}</td><td>-</td><td>{inr(b.blackTax)}</td></tr>
          <tr className="ab-row-strong"><td colSpan={4}>This month's charges</td><td>{inr(b.blackTotal)}</td></tr>
        </tbody>
      </table>
      <div className="ab-total-row"><span>TOTAL Payable Amount</span><span>₹{inr(b.blackTotal)}</span></div>
      <div className="ab-words">Total: {b.blackWords}</div>
    </div>

    <div className="ab-box">
      <div className="ab-box-head"><span>Last Bill Summary</span><small>(Amounts in ₹)</small></div>
      <div className="ab-line-row"><span>Last Bill Amount</span><span>{f2(b.blackTotal)}</span></div>
      <div className="ab-line-row"><span>Last Payment made</span><span>{f2(b.blackTotal)}</span></div>
    </div>

    <div className="ab-box">
      <div className="ab-box-head ab-center">Bills &amp; Payments Summary</div>
      <table className="ab-hist-table">
        <thead>
          <tr>
            <th>Month</th><th>Previous Dues (A)</th><th>Payments (B)</th><th>Payment Coupon (C)</th>
            <th>Credits (D)</th><th>This Month's Charges (E)</th><th>Total Amount (A+B+C+D+E)</th>
          </tr>
        </thead>
        <tbody>
          {b.history.map((m) => (
            <tr key={m}>
              <td>{m}</td><td>{inr(b.blackTotal)}</td><td>-{inr(b.blackTotal)}</td><td>0.00</td>
              <td>0.00</td><td>{inr(b.blackTotal)}</td><td>{inr(b.blackTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const FixedlineInvoice = ({ b }) => (
  <div className="ab-page ab-inv">
    <div className="ab-inv-head">
      <div>
        <div className="ab-inv-title">FIXEDLINE AND Wi-Fi SERVICES</div>
        <div className="ab-inv-sub">Original Copy for Recipient provided by&nbsp; Bharti Airtel Limited- Tax Invoice</div>
        <div className="ab-inv-ids">Fixedline number :&nbsp; <span>{b.fixedline}</span> / Wi-Fi ID :&nbsp; <span>{b.wifiId}</span></div>
      </div>
      <AirtelLogo />
    </div>

    <div className="ab-bar">Billing Address</div>
    <div className="ab-inv-split">
      <div className="ab-inv-addr">
        <div>{b.customerName}</div>
        {b.addressLines.map((l, i) => <div key={i}>{l}</div>)}
        <div>Email id : {b.email}</div>
        <div>Registered Telephone Number (RTN): {b.rtn}</div>
      </div>
      <div className="ab-inv-bar-col">
        <Barcode value={b.billNo} />
        <div className="ab-two"><span>{b.billNo}</span><span>{b.accountNo}</span></div>
        <div className="ab-two ab-gap"><span>Ship To State Code : {b.stateCode.padStart(2, "0")}</span><span>Place of Supply : {b.state}</span></div>
      </div>
    </div>

    <div className="ab-bar">Account</div>
    <div className="ab-inv-split">
      <div className="ab-kv">
        <div><span>Account No</span><b>{b.accountNo}</b></div>
        <div><span>GST No</span><b>.</b></div>
        <div><span>Bill Period</span><b>{b.periodTo}</b></div>
      </div>
      <div className="ab-kv">
        <div><span>Bill NO</span><b>{b.billNo}</b></div>
        <div><span>Bill Date</span><b>{b.stmtDate2}</b></div>
        <div><span>Due date</span><b>{b.dueDate2}</b></div>
        <div><span>Credit limit</span><b>2500.00</b></div>
        <div><span>Security deposit</span><b>0.00</b></div>
      </div>
    </div>

    <div className="ab-dark-strip ab-strip-black">
      <div><span>Last bill amount</span><b>₹{f2(b.flTotal)}</b></div>
      <em>-</em>
      <div><span>Payment made</span><b>₹{f2(b.flTotal)}</b></div>
      <em>-</em>
      <div><span>Payment Coupon</span><b>₹0.00</b></div>
      <em>-</em>
      <div><span>Credits</span><b>₹0.00</b></div>
      <em>+</em>
      <div><span>This month's charges</span><b>₹{f2(b.flTotal)}</b></div>
      <em>=</em>
      <div><span>Total Amount</span><b>₹{f2(b.flTotal)}</b></div>
      <div><span>Amount after due date({b.dueShort2})</span><b>₹{f2(b.flLate)}</b></div>
    </div>

    <div className="ab-bar ab-bar-split"><span>This Month's Charges</span><small>Charges(₹)</small></div>
    <div className="ab-charges">
      <div className="ab-line-row ab-bold"><span>Rental Charges</span><span>{f2(b.flNet)}</span></div>
      <div className="ab-line-row"><span>Taxes</span><span>{f2(b.flTax)}</span></div>
      <div className="ab-line-row ab-bold ab-lg"><span>Total Amount</span><span>₹{f2(b.flTotal)}</span></div>
      <div className="ab-words ab-bold">Total:{b.flWords}</div>
    </div>
    <div className="ab-note">Detailed breakup of these charges can be found on next page</div>

    <div className="ab-inv-foot">
      <div className="ab-sign">
        <div className="ab-bold">For Bharti Airtel Limited</div>
        <div className="ab-sign-script">S. Vasim Unissa</div>
        <div className="ab-bold">Vasim Unissa S,</div>
        <div className="ab-bold">Head - Experience Operations (VP)</div>
      </div>
      <div className="ab-upi">
        <div className="ab-bhim">BHIM UPI</div>
        <div>Send payment to</div>
        <div>{b.accountNo}.FL@mairtel</div>
        <QRCodeSVG value={`upi://pay?pa=${b.accountNo}.FL@mairtel&pn=Airtel&am=${f2(b.flTotal)}`} size={110} level="L" />
        <div>Scan &amp; pay via any UPI Apps</div>
        <div>Powered by <b className="ab-red">airtel</b> <span className="ab-pb">Payments Bank</span></div>
      </div>
    </div>
    <div className="ab-page-no">Page 1 of 2</div>
  </div>
);

const FixedlineDetail = ({ b }) => (
  <div className="ab-page ab-inv">
    <div className="ab-det-head">
      <AirtelLogo />
      <div className="ab-bold">Relationship No&nbsp;&nbsp;&nbsp; :&nbsp;&nbsp; {b.accountNo}</div>
    </div>
    <div className="ab-det-title">YOUR CHARGES IN DETAIL</div>

    <div className="ab-sec">Rentals</div>
    <table className="ab-det-table">
      <thead>
        <tr><th>Description</th><th>From date</th><th>To date</th><th>Rental</th><th>Discount</th><th>Net charges</th><th>Total(₹)</th></tr>
      </thead>
      <tbody>
        <tr><td className="ab-red ab-bold">Plan Details</td><td /><td /><td /><td /><td /><td rowSpan={2} className="ab-tot ab-bold ab-mid">{f2(b.flNet)}</td></tr>
        <tr><td>Wi-Fi Plan @ ₹ {b.wifiRental}</td><td>{b.fromSlash}</td><td>{b.toSlash}</td><td>{f2(b.wifiRental)}</td><td>{f2(b.wifiDiscount)}</td><td>{f2(b.flNet)}</td></tr>
      </tbody>
    </table>

    <div className="ab-sec">Tax Details</div>
    <table className="ab-det-table ab-tax-table">
      <thead>
        <tr><th rowSpan={2}>HSN</th><th rowSpan={2}>Taxable Value</th><th colSpan={2}>CGST</th><th colSpan={2}>SGST/UTGST</th><th rowSpan={2}>Total Tax</th><th rowSpan={2}>Total(₹)</th></tr>
        <tr><th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th></tr>
      </thead>
      <tbody>
        <tr><td>998412</td><td>{f2(b.flNet)}</td><td>9%</td><td>{f2(b.flHalfTax)}</td><td>9%</td><td>{f2(b.flHalfTax)}</td><td>{f2(b.flTax)}</td><td className="ab-tot ab-bold">{f2(b.flTax)}</td></tr>
      </tbody>
    </table>
    <div className="ab-line-row ab-bold ab-lg ab-ruled"><span>This month's charges</span><span>{f2(b.flTotal)}</span></div>

    <div className="ab-sec">Payments and refunds-details</div>
    <table className="ab-det-table">
      <thead>
        <tr><th>Description</th><th>Date</th><th>Amount</th><th>Total(₹)</th></tr>
      </thead>
      <tbody>
        <tr><td>{b.paymentMethod}</td><td>{b.paidOn}</td><td>-{f2(b.flTotal)}</td><td className="ab-tot ab-bold">-{f2(b.flTotal)}</td></tr>
      </tbody>
    </table>

    <div className="ab-plan-box">
      <div className="ab-plan-head">Bill Plan Details : {b.wifiRental} WiFi_{b.speed}Mbps</div>
      <div className="ab-plan-row">
        <span><b>Rental:</b> ₹ {f2(b.wifiRental)}</span>
        <span><b>Quota:</b> Unlimited</span>
        <span><b>*Speed:</b> {b.speed} Mbps</span>
      </div>
      <div>( {f2(b.wifiRental)}&nbsp; Rental includes Rs.{b.wifiRental - 250}&nbsp; towards Wi-Fi &amp; Fixed Line Plan&nbsp; and Rs.250&nbsp; towards Platform Services )</div>
      <div className="ab-plan-gap">Voice - call rates: Unlimited local and STD calls</div>
      <div>ISD - call rates: for country specific rates visit www.airtel.in</div>
      <div className="ab-plan-gap">*Post consumption of Unlimited quota, the speed would be revised to 2 Mbps</div>
      <div>For information on other plans, visit www.airtel.in/business/thanksforbusiness/login/</div>
    </div>

    <div className="ab-fine">
      <p><b>Payment Modes</b> - Pay online using debit/credit card, netbanking on My Airtel App, www.airtel.in, eWallets, UPI, visit an Airtel Store to pay using cash/cheque/credit/debit cards or activate Auto pay options from bank account (NACH) or Credit card account (SI)</p>
      <p><b>Contact Information</b> - For Queries: Call 121 (toll free for Airtel), 011-44444121(for Non-Airtel number, call charges apply) | Complaints: Call 198 (toll free for Airtel), 011-44444198(for Non-Airtel number, call charges apply) | NDNC Registration: Call 1909 (Activation time: 7 days) | Complaint/SR Status: www.airtel.in/help. | Appellate Desk: Mr. Raja Bose, 0180-4600150; appellate.haryana@in.airtel.com; address: Bharti Airtel Limited, Plot No 41 &amp; 42, Industrial Park , Sector 2,Growth Center, Saha, Distt Ambala , Haryana</p>
      <p><b>Call 1930 for cyber-crime fraud reporting.</b></p>
      <p><b>Corporate Coordinator Contact Information</b> - For queries and complaints: Call 1800102002 | Email: Esupport@in.airtel.com</p>
      <p><b>Charges</b> - Itemized bill: Rs. 50/Bill | Duplicate Bill: Rs. 50/Bill (Last 2 months free) | Cheque / SI / ECS Decline: Rs. 200 | Late payment charges shall be Rs. 100 for bill value between Rs. 300 and Rs. 5,000; and for bill value above Rs. 5,000, a charge of 2% of the amount, capped at a maximum of Rs. 750 will be applied. As per the Government directive, effective 1-July-17, 18% GST is applicable on Late Fee Charges. No charge is levied for any service without your explicit consent.</p>
      <p><b>Address change</b> - Visit the nearest Airtel Store with new address proof. For store details, visit www.airtel.in/store</p>
      <p><b>Other Information</b> - Tariff Plan: No increase in any line item (except ISD) for first 6months effective enrolment date. T&amp;C apply | No fee is charged for migrating to any plan | Disconnection: For permanent disconnection, security deposit will be refunded within 60days. Else, interest will be paid @10%p.a. | Call pulses will be rounded off | Billing disagreements should be reported within 2months of bill receipt. Post this period no claim shall be entertained. | Whether tax is payable on Reverse Charge Basis - "NO". The Airtel Wi-Fi router is Airtel's property &amp; may be reclaimed if the customer discontinues Airtel's Wi-Fi services.</p>
      <p><b>Registered Office</b> : Bharti Airtel Limited, Plot No. 16, Udyog Vihar, Phase IV, Gurugram - 122015, Haryana, India. Tel: +91-124-4248655, e-mail: 121@in.airtel.com, website: www.airtel.in</p>
      <p><b>Corporate Identity Number</b> : L74899HR1995PLC095967 Bharti Airtel Ltd, Plot No- 16, Airtel Center, Udyog Vihar, Phase -IV, Gurgaon, Haryana -122015</p>
      <p><b>Ship To State Code : {Number(b.stateCode)}&nbsp;&nbsp; GST registration no :</b> 06AAACB2894G1ZR under Category TELECOMMUNICATION SERVICE&nbsp;&nbsp; <b>PAN :</b> AAACB2894G</p>
      <p><b>HSN : 998412</b> Fixed Telephony Service , <b>998433</b> On-line video content , <b>996812</b> Courier Services , <b>997317</b> Leasing or rental services concerning telecommunications equipment with or without operator , <b>9983</b> Support services , <b>998716</b> Maintenance and repair services of telecommunication equipment and apparatus , <b>999799</b> Other Services n.e.c</p>
    </div>
    <div className="ab-page-no">Page 2 of 2</div>
  </div>
);

export default class AirtelBlackBill extends Component {
  constructor(props) {
    super(props);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);
    this.state = {
      mode: "single",
      customerName: last("customerName", ""),
      email: last("email", ""),
      rtn: last("rtn", ""),
      address: last("address", ""),
      blackId: last("blackId", ""),
      connections: last("connections", "5"),
      planName: last("planName", "Airtel Black 1999 Plan"),
      accountNo: last("accountNo", ""),
      fixedline: last("fixedline", ""),
      wifiId: last("wifiId", ""),
      wifiRental: last("wifiRental", "999"),
      wifiDiscount: last("wifiDiscount", "199"),
      speed: last("speed", "200"),
      mobileRental: last("mobileRental", "1199"),
      state: last("state", "Haryana"),
      stateCode: last("stateCode", "06"),
      includeBlack: true,
      month: currentMonth,
      endMonthSingle: "",
      billNo: "",
      ...defaultDates(currentMonth),
      fyStartYear: String(fyStartYear),
      endMonth: "",
      bills: [],
      pdfView: false,
    };
  }

  onChange = (e, id) => this.setState({ [id]: e.target.value });
  // Changing the month resets the bill/due dates to that month's defaults.
  onMonth = (e) => {
    const v = e.target.value;
    this.setState(v ? { month: v, ...defaultDates(v) } : { month: v });
  };
  // Picking a bill date in another month moves the month (and its due date) along.
  onBillDate = (e) => {
    const v = e.target.value;
    if (!v) return this.setState({ billDate: v });
    const month = v.slice(0, 7);
    this.setState(month === this.state.month
      ? { billDate: v }
      : { billDate: v, month, dueDate: defaultDates(month).dueDate });
  };

  setMode = (mode) => this.setState({ mode });

  // [year, month0] pairs for the chosen single month / range / financial year.
  months = () => {
    const { mode, month, endMonthSingle, fyStartYear, endMonth } = this.state;
    const out = [];
    if (mode === "single") {
      if (!month || !month.includes("-")) return "Pick a month";
      const [y, m] = month.split("-").map(Number);
      let endY = y, endM0 = m - 1;
      if (endMonthSingle && endMonthSingle.includes("-")) {
        const [ey, em] = endMonthSingle.split("-").map(Number);
        endY = ey; endM0 = em - 1;
        if (endY < y || (endY === y && endM0 < m - 1)) return "End month is before the start month";
      }
      let cy = y, cm0 = m - 1;
      while (cy < endY || (cy === endY && cm0 <= endM0)) {
        out.push([cy, cm0]);
        cm0++;
        if (cm0 > 11) { cm0 = 0; cy++; }
      }
      return out;
    }
    const fy = parseInt(fyStartYear, 10);
    if (isNaN(fy) || fy < 2000 || fy > 2100) return "Enter a valid FY start year (e.g. 2025 for FY 2025-26)";
    let endY = null, endM0 = null;
    if (endMonth && endMonth.includes("-")) {
      [endY, endM0] = endMonth.split("-").map(Number);
      endM0 -= 1;
    }
    for (let i = 0; i < 12; i++) {
      const month0 = (3 + i) % 12;
      const year = fy + (month0 < 3 ? 1 : 0);
      if (endY !== null && (year > endY || (year === endY && month0 > endM0))) break;
      out.push([year, month0]);
    }
    return out.length ? out : "End month is before the start of the financial year";
  };

  generate = () => {
    const s = this.state;
    const required = ["customerName", "email", "rtn", "address", "accountNo", "fixedline", "wifiId"];
    if (s.includeBlack) required.push("blackId");
    if (required.some((k) => !String(s[k]).trim())) {
      alert("Fill in all the required fields");
      return;
    }
    const nums = {};
    for (const k of ["wifiRental", "wifiDiscount", "mobileRental", "speed", "connections"]) {
      nums[k] = parseFloat(s[k]);
      if (isNaN(nums[k]) || nums[k] < 0) {
        alert("Enter valid plan amounts");
        return;
      }
    }
    if (nums.wifiDiscount > nums.wifiRental) {
      alert("Discount is larger than the Wi-Fi rental");
      return;
    }
    const months = this.months();
    if (typeof months === "string") {
      alert(months);
      return;
    }

    const fields = {
      customerName: s.customerName.trim().toUpperCase(),
      email: s.email.trim(),
      rtn: s.rtn.trim(),
      addressLines: s.address.split("\n").map((l) => l.trim()).filter(Boolean),
      blackId: s.blackId.trim(),
      planName: s.planName.trim(),
      accountNo: s.accountNo.trim(),
      fixedline: s.fixedline.trim(),
      wifiId: s.wifiId.trim(),
      state: s.state.trim(),
      stateCode: s.stateCode.trim(),
      ...nums,
    };
    // The actual bill's numbers only make sense for a single month.
    const actual = s.mode === "single" && months.length === 1
      ? { billNo: s.billNo.trim().toUpperCase(), billDate: s.billDate, dueDate: s.dueDate }
      : {};
    const bills = months.map(([y, m0]) => buildBill(fields, y, m0, actual));

    saveAll(Object.fromEntries(Object.entries(HISTORY_KEYS).map(([k, hk]) => [hk, s[k]])));

    const first = bills[0].monthLabel;
    const lastLabel = bills[bills.length - 1].monthLabel;
    document.title = s.mode === "year"
      ? `Airtel Bill - FY ${s.fyStartYear}-${String(Number(s.fyStartYear) + 1).slice(-2)}`
      : `Airtel Bill - ${first}${bills.length > 1 ? ` to ${lastLabel}` : ""}`;

    this.setState({ bills, pdfView: true });
    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({
        category: "User Interaction",
        action: "Clicked a Button",
        label: "Generate Airtel Black Bills",
        mode: s.mode,
        count: bills.length,
      });
    }
  };

  field = (id, label, hint = "required", type = "text") => (
    <div className="bg-field">
      <label className="bg-label">{label} {hint ? <span className="bg-label-hint">{hint}</span> : null}</label>
      <input className="bg-input" type={type} autoComplete="off" value={this.state[id]} onChange={(e) => this.onChange(e, id)} />
    </div>
  );

  render() {
    const { mode, address, includeBlack, month, endMonthSingle, billDate, fyStartYear, endMonth, bills, pdfView } = this.state;

    if (pdfView) {
      const total = bills.reduce((sum, b) => sum + (includeBlack ? b.blackTotal : b.flTotal), 0);
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
            <React.Fragment key={idx}>
              {includeBlack ? <BlackStatement b={b} /> : null}
              <FixedlineInvoice b={b} />
              <FixedlineDetail b={b} />
            </React.Fragment>
          ))}
        </>
      );
    }

    return (
      <div className="bg-card">
        <h2 className="bg-card-title">Airtel Black Statement</h2>
        <p className="bg-card-desc">Monthly Airtel Black statement with the fixed-line &amp; Wi-Fi tax invoice.</p>

        <div className="bg-mode" role="tablist">
          <button type="button" className={`bg-mode-btn ${mode === "single" ? "active" : ""}`} onClick={() => this.setMode("single")}>
            Single Month
          </button>
          <button type="button" className={`bg-mode-btn ${mode === "year" ? "active" : ""}`} onClick={() => this.setMode("year")}>
            Financial Year (12)
          </button>
        </div>

        <div className="bg-grid">
          {this.field("customerName", "Customer Name")}
          {this.field("email", "Registered Email")}
          {this.field("rtn", "Registered Telephone Number (RTN)")}
          {this.field("accountNo", "Fixed-line Account No")}
          {this.field("fixedline", "Fixedline Number", "required — e.g. 0124xxxxxxx")}
          {this.field("wifiId", "Wi-Fi ID", "required — e.g. 0124xxxxxxx_wifi")}
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Billing Address <span className="bg-label-hint">required — one line per row</span></label>
            <textarea className="bg-input" rows={4} value={address} onChange={(e) => this.onChange(e, "address")} />
          </div>
          {this.field("state", "Place of Supply (State)")}
          {this.field("stateCode", "State Code", "e.g. 06 for Haryana")}
          {this.field("wifiRental", "Wi-Fi Plan Rental (Rs.)", "before tax", "number")}
          {this.field("wifiDiscount", "Wi-Fi Plan Discount (Rs.)", "", "number")}
          {this.field("speed", "Speed (Mbps)", "", "number")}
          <div className="bg-field">
            <label className="bg-label">Airtel Black summary page</label>
            <label className="ab-check">
              <input type="checkbox" checked={includeBlack} onChange={(e) => this.setState({ includeBlack: e.target.checked })} />
              Include the Black Monthly Statement cover page
            </label>
          </div>
          {includeBlack ? (
            <>
              {this.field("blackId", "Airtel Black ID")}
              {this.field("planName", "Black Plan Name", "")}
              {this.field("connections", "Number of Connections", "", "number")}
              {this.field("mobileRental", "Mobile Postpaid Rental (Rs.)", "before tax", "number")}
            </>
          ) : null}
          {mode === "single" ? (
            <>
              <div className="bg-field">
                <label className="bg-label">Month <span className="bg-label-hint">required</span></label>
                <input className="bg-input" type="month" value={month} onChange={this.onMonth} />
              </div>
              <div className="bg-field">
                <label className="bg-label">End Month <span className="bg-label-hint">optional — generate range</span></label>
                <input className="bg-input" type="month" value={endMonthSingle} onChange={(e) => this.onChange(e, "endMonthSingle")} />
              </div>
              {endMonthSingle ? null : (
                <>
                  {this.field("billNo", "Bill No", "optional — random if blank")}
                  <div className="bg-field">
                    <label className="bg-label">Bill Date <span className="bg-label-hint">defaults to the 27th — edit to match the bill</span></label>
                    <input className="bg-input" type="date" value={billDate} onChange={this.onBillDate} />
                  </div>
                  {this.field("dueDate", "Due Date", "defaults to the 6th of next month", "date")}
                </>
              )}
            </>
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
            Generate {mode === "year" ? (endMonth ? "Bills up to End Month" : "12 Bills") : (endMonthSingle ? "Bills for Range" : "Bill")}
          </button>
        </div>

        <div className="bg-tips">
          <div className="bg-tips-title">Tips</div>
          <div>Each month is statement-dated the 27th, covers 26th–25th and falls due on the 6th. Taxes are 18% GST (9% CGST + 9% SGST).</div>
          <div>The Black cover page totals Wi-Fi + mobile; the fixed-line invoice pages show only the Wi-Fi charges.</div>
          <div>For a single month, Bill Date and Due Date are prefilled from the month and can be edited to match the actual bill; leave Bill No blank for a random one. Bills in a range use the defaults.</div>
        </div>
      </div>
    );
  }
}
