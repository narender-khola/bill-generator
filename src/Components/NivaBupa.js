import React, { Component } from "react";
import "./NivaBupa.css";
import ReactGA from "react-ga4";
import { getHistory, addToHistory } from "../utils/inputHistory";

const formatDDMMYYYY = (d) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const numToWordsIndian = (n) => {
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inHundreds = (num) => {
    let s = "";
    if (num >= 100) { s += ones[Math.floor(num / 100)] + " Hundred "; num %= 100; }
    if (num >= 20) { s += tens[Math.floor(num / 10)]; if (num % 10) s += "-" + ones[num % 10]; s += " "; }
    else if (num > 0) { s += ones[num] + " "; }
    return s.trim();
  };
  const num = Math.round(n);
  if (num < 0) return "Minus " + numToWordsIndian(-num);
  let result = "";
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;
  if (crore) result += inHundreds(crore) + " Crore ";
  if (lakh) result += inHundreds(lakh) + " Lakh ";
  if (thousand) result += inHundreds(thousand) + " Thousand ";
  if (rest) result += inHundreds(rest);
  return result.trim() + " Only";
};

const HISTORY_KEYS = {
  policyHolder: "nb_policyHolder",
  customerId: "nb_customerId",
  address: "nb_address",
  mobile: "nb_mobile",
  policyNumber: "nb_policyNumber",
  productName: "nb_productName",
  productUIN: "nb_productUIN",
  variant: "nb_variant",
  planOpted: "nb_planOpted",
  policyPeriodYears: "nb_policyPeriodYears",
  baseSumInsured: "nb_baseSumInsured",
  startDate: "nb_startDate",
  netPremium: "nb_netPremium",
  nomineeName: "nb_nomineeName",
  nomineeRelation: "nb_nomineeRelation",
  members: "nb_members",
  portedFrom: "nb_portedFrom",
  portedDate: "nb_portedDate",
};

const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);

export default class NivaBupa extends Component {
  constructor(props) {
    super(props);
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    let savedMembers = null;
    try {
      const raw = last("members", null);
      if (raw) savedMembers = JSON.parse(raw);
    } catch {}

    this.state = {
      policyHolder: last("policyHolder", ""),
      customerId: last("customerId", ""),
      address: last("address", ""),
      mobile: last("mobile", ""),
      policyNumber: last("policyNumber", ""),
      productName: last("productName", "ReAssure 2.0"),
      productUIN: last("productUIN", "NBHHLIP23169V012223"),
      variant: last("variant", "Titanium+"),
      planOpted: last("planOpted", "Family Floater"),
      policyPeriodYears: last("policyPeriodYears", "3"),
      baseSumInsured: last("baseSumInsured", "1000000"),
      startDate: last("startDate", todayISO),
      issueDate: last("startDate", todayISO),
      netPremium: last("netPremium", ""),
      nomineeName: last("nomineeName", ""),
      nomineeRelation: last("nomineeRelation", "Father"),
      portedFrom: last("portedFrom", ""),
      portedDate: last("portedDate", ""),
      members: savedMembers || [
        { name: "", baseSumInsured: "1000000", personalAccident: "0" },
      ],
      pdfView: false,
      output: null,
    };
  }

  onChange = (e, id) => this.setState({ [id]: e.target.value });

  updateMember = (idx, field, value) => {
    this.setState((s) => ({
      members: s.members.map((m, i) => (i === idx ? { ...m, [field]: value } : m)),
    }));
  };

  addMember = () => {
    this.setState((s) => ({
      members: [...s.members, { name: "", baseSumInsured: s.baseSumInsured || "1000000", personalAccident: "0" }],
    }));
  };

  removeMember = (idx) => {
    this.setState((s) => ({ members: s.members.filter((_, i) => i !== idx) }));
  };

  generate = () => {
    const s = this.state;
    if (!s.policyHolder.trim() || !s.address.trim() || !s.policyNumber.trim() || !s.startDate) {
      alert("Policyholder, Address, Policy Number and Start Date are required");
      return;
    }
    if (!s.netPremium || isNaN(parseFloat(s.netPremium)) || parseFloat(s.netPremium) <= 0) {
      alert("Enter a valid net premium");
      return;
    }
    if (s.members.length === 0) {
      alert("Add at least one insured member");
      return;
    }
    for (let i = 0; i < s.members.length; i++) {
      if (!s.members[i].name.trim()) {
        alert(`Fill name for member ${i + 1}`);
        return;
      }
    }

    const start = parseISO(s.startDate);
    const years = parseInt(s.policyPeriodYears, 10) || 1;
    const expiry = new Date(start.getFullYear() + years, start.getMonth(), start.getDate() - 1);
    const renewal = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate() - 1);

    const net = parseFloat(s.netPremium);
    const igst = +(net * 0.18).toFixed(2);
    const gross = +(net + igst).toFixed(2);

    addToHistory(HISTORY_KEYS.policyHolder, s.policyHolder.trim());
    addToHistory(HISTORY_KEYS.customerId, s.customerId.trim());
    addToHistory(HISTORY_KEYS.address, s.address.trim());
    addToHistory(HISTORY_KEYS.mobile, s.mobile.trim());
    addToHistory(HISTORY_KEYS.policyNumber, s.policyNumber.trim());
    addToHistory(HISTORY_KEYS.productName, s.productName.trim());
    addToHistory(HISTORY_KEYS.productUIN, s.productUIN.trim());
    addToHistory(HISTORY_KEYS.variant, s.variant.trim());
    addToHistory(HISTORY_KEYS.planOpted, s.planOpted.trim());
    addToHistory(HISTORY_KEYS.policyPeriodYears, s.policyPeriodYears);
    addToHistory(HISTORY_KEYS.baseSumInsured, s.baseSumInsured);
    addToHistory(HISTORY_KEYS.startDate, s.startDate);
    addToHistory(HISTORY_KEYS.netPremium, s.netPremium);
    addToHistory(HISTORY_KEYS.nomineeName, s.nomineeName.trim());
    addToHistory(HISTORY_KEYS.nomineeRelation, s.nomineeRelation);
    addToHistory(HISTORY_KEYS.portedFrom, s.portedFrom.trim());
    addToHistory(HISTORY_KEYS.portedDate, s.portedDate);
    try { addToHistory(HISTORY_KEYS.members, JSON.stringify(s.members)); } catch {}

    document.title = `Niva Bupa 80D - ${s.policyHolder.trim()} - FY ${start.getFullYear()}-${String(start.getFullYear() + 1).slice(-2)}`;

    this.setState({
      pdfView: true,
      output: {
        policyHolder: s.policyHolder.trim().toUpperCase(),
        customerId: s.customerId.trim(),
        addressLines: s.address.trim().split("\n").filter(Boolean),
        mobile: s.mobile.trim(),
        policyNumber: s.policyNumber.trim(),
        productName: s.productName.trim() || "ReAssure 2.0",
        productUIN: s.productUIN.trim(),
        variant: s.variant.trim(),
        planOpted: s.planOpted.trim(),
        policyPeriodYears: years,
        baseSumInsured: parseInt(s.baseSumInsured, 10) || 0,
        startStr: formatDDMMYYYY(start),
        expiryStr: formatDDMMYYYY(expiry),
        renewalStr: formatDDMMYYYY(renewal),
        issueDate: formatDDMMYYYY(start),
        netPremium: net,
        igst,
        gross,
        grossWords: numToWordsIndian(gross),
        nomineeName: s.nomineeName.trim(),
        nomineeRelation: s.nomineeRelation,
        portedFrom: s.portedFrom.trim(),
        portedDateStr: s.portedDate ? formatDDMMYYYY(parseISO(s.portedDate)) : "",
        members: s.members.map((m) => ({
          name: m.name.trim(),
          baseSumInsured: parseInt(m.baseSumInsured, 10) || 0,
          personalAccident: parseInt(m.personalAccident, 10) || 0,
        })),
      },
    });

    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({
        category: "User Interaction",
        action: "Clicked a Button",
        label: "Generate Niva Bupa Cert",
        members: s.members.length,
      });
    }
  };

  render() {
    const { pdfView, output } = this.state;
    if (pdfView && output) {
      return (
        <>
          <div className="noprint bg-result-bar">
            <div className="bg-result-stats">
              <span className="bg-result-stat">Members: <strong>{output.members.length}</strong></span>
              <span className="bg-result-stat">Gross premium: <strong>Rs. {output.gross.toLocaleString("en-IN")}</strong></span>
            </div>
            <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">
              Generate More
            </button>
          </div>
          <WelcomePage d={output} />
          <CertificatePage d={output} />
        </>
      );
    }
    return this.renderForm();
  }

  renderForm() {
    const s = this.state;
    return (
      <div className="bg-card">
        <h2 className="bg-card-title">Niva Bupa 80D Certificate Generator</h2>
        <p className="bg-card-desc">Generate a Niva Bupa style health insurance certificate (welcome letter + certificate page).</p>

        <h3 className="nb-section-title">Policyholder</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Policyholder Name <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={s.policyHolder} onChange={(e) => this.onChange(e, "policyHolder")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Customer ID</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.customerId} onChange={(e) => this.onChange(e, "customerId")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Address <span className="bg-label-hint">multi-line, required</span></label>
            <textarea className="bg-input" rows={3} autoComplete="off" value={s.address} onChange={(e) => this.onChange(e, "address")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Mobile (last 4 visible)</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.mobile} onChange={(e) => this.onChange(e, "mobile")} />
          </div>
        </div>

        <h3 className="nb-section-title">Policy</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Policy Number <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={s.policyNumber} onChange={(e) => this.onChange(e, "policyNumber")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Product Name</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.productName} onChange={(e) => this.onChange(e, "productName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Product UIN</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.productUIN} onChange={(e) => this.onChange(e, "productUIN")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Variant Opted</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.variant} onChange={(e) => this.onChange(e, "variant")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Plan Opted</label>
            <select className="bg-input" value={s.planOpted} onChange={(e) => this.onChange(e, "planOpted")}>
              <option>Family Floater</option>
              <option>Individual</option>
            </select>
          </div>
          <div className="bg-field">
            <label className="bg-label">Policy Period (years)</label>
            <input className="bg-input" type="number" min="1" max="5" value={s.policyPeriodYears} onChange={(e) => this.onChange(e, "policyPeriodYears")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Base Sum Insured (INR)</label>
            <input className="bg-input" type="number" value={s.baseSumInsured} onChange={(e) => this.onChange(e, "baseSumInsured")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Policy Start Date <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="date" value={s.startDate} onChange={(e) => this.onChange(e, "startDate")} />
          </div>
        </div>

        <h3 className="nb-section-title">Premium &amp; Nominee</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Net Premium / Taxable Value (INR) <span className="bg-label-hint">required, GST auto-added</span></label>
            <input className="bg-input" type="number" step="0.01" value={s.netPremium} onChange={(e) => this.onChange(e, "netPremium")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Nominee Name</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.nomineeName} onChange={(e) => this.onChange(e, "nomineeName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Nominee Relation</label>
            <select className="bg-input" value={s.nomineeRelation} onChange={(e) => this.onChange(e, "nomineeRelation")}>
              <option>Father</option>
              <option>Mother</option>
              <option>Spouse</option>
              <option>Son</option>
              <option>Daughter</option>
              <option>Brother</option>
              <option>Sister</option>
            </select>
          </div>
        </div>

        <h3 className="nb-section-title">Ported From <span className="nb-section-hint">optional, leave blank if fresh</span></h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Ported from policy / insurer</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.portedFrom} onChange={(e) => this.onChange(e, "portedFrom")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Original date of initiation</label>
            <input className="bg-input" type="date" value={s.portedDate} onChange={(e) => this.onChange(e, "portedDate")} />
          </div>
        </div>

        <h3 className="nb-section-title">Insured Members</h3>
        <div className="mi-members">
          <div className="mi-members-header">
            <button type="button" className="bg-btn bg-btn-secondary" onClick={this.addMember}>+ Add Member</button>
          </div>
          {s.members.map((m, idx) => (
            <div key={idx} className="mi-member-row">
              <div className="nb-member-grid">
                <div className="bg-field">
                  <label className="bg-label">Name</label>
                  <input className="bg-input" type="text" value={m.name} onChange={(e) => this.updateMember(idx, "name", e.target.value)} />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Base Sum Insured (INR)</label>
                  <input className="bg-input" type="number" value={m.baseSumInsured} onChange={(e) => this.updateMember(idx, "baseSumInsured", e.target.value)} />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Personal Accident</label>
                  <input className="bg-input" type="number" value={m.personalAccident} onChange={(e) => this.updateMember(idx, "personalAccident", e.target.value)} />
                </div>
              </div>
              {s.members.length > 1 ? (
                <button type="button" className="mi-remove-btn" onClick={() => this.removeMember(idx)} title="Remove member">×</button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="bg-actions">
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.generate}>
            Generate Certificate
          </button>
        </div>

        <div className="bg-tips">
          <div className="bg-tips-title">Tips</div>
          <div>Net Premium is the pre-GST taxable value. 18% IGST is added automatically to compute the gross premium.</div>
          <div>For 80DD claims, set the policy holder and members to your parents.</div>
        </div>
      </div>
    );
  }
}

const fmtINR = (n) => Number(n).toLocaleString("en-IN");

const WelcomePage = ({ d }) => (
  <div className="nb-page">
    <div className="nb-logo-wrap">
      <img src={process.env.PUBLIC_URL + "/images/niva-bupa-logo.png"} alt="Niva Bupa" className="nb-logo" />
    </div>
    <div className="nb-welcome-body">
      <div className="nb-letter-meta">
        <div>Date: {d.issueDate}</div>
        <div>Policy Number: {d.policyNumber}</div>
        {d.customerId ? <div>Customer ID: {d.customerId}</div> : null}
      </div>
      <div className="nb-letter-addr">
        <div>MR. {d.policyHolder}</div>
        {d.addressLines.map((l, i) => <div key={i}>{l}</div>)}
        {d.mobile ? <div>Mobile: {d.mobile}</div> : null}
      </div>
      <div className="nb-letter-subject"><strong>Subject : </strong>Niva Bupa Health Insurance Policy No. {d.policyNumber}</div>
      <div className="nb-letter-greeting">Dear MR. {d.policyHolder},</div>
      {d.portedFrom ? (
        <p>
          Thank you for choosing Niva Bupa as your preferred health insurance partner through portability. We wish to intimate you that your policy <strong>{d.policyNumber}</strong> of <strong>{d.portedFrom}</strong>{d.portedDateStr ? <> and Date of Initiation <strong>{d.portedDateStr}</strong></> : null} has been ported as per Portability guidelines.
        </p>
      ) : (
        <p>
          Thank you for choosing Niva Bupa as your preferred health insurance partner. We wish to intimate you that your policy <strong>{d.policyNumber}</strong> has been issued as per details enclosed.
        </p>
      )}
      <p>At Niva Bupa, we put your health first and are committed to provide you access to the very best of healthcare, backed by the highest standards of service.</p>
      <p>Please find enclosed your Niva Bupa Policy Kit which will help you understand your policy in detail and give you more information on how to access our services easily. Your policy kit includes the following:</p>
      <ul className="nb-letter-ul">
        <li><strong>Personalized Health Card:</strong> To access our wide range of hospitals for cashless hospitalization.</li>
        <li><strong>Insurance Certificate:</strong> Confirming your specific policy details like date of commencement, persons covered and specific conditions related to your plan.</li>
        <li><strong>Premium Receipt:</strong> Receipt issued for the premium paid by you.</li>
        <li><strong>Policy Terms and Conditions:</strong> For a clear understanding of policy coverages and exclusions.</li>
        <li><strong>Proposal form:</strong> This is a copy of the proposal form as per the information provided by you. Do inform us immediately in case there is any change in the details mentioned therein.</li>
        <li><strong>Annexure of Policyholder Servicing Turnaround Times as prescribed by Insurance Regulatory and Development Authority of India (IRDAI)</strong></li>
      </ul>
      <p>Do visit us online at www.nivabupa.com to view and download our updated list of network hospitals in your city, download claim forms and for other useful information. You can register with us online using your policy number, date of birth &amp; email id and access your policy details. In case of any further assistance, call us at 1860-500-8888 (customer helpline number) or raise a request using our self-service platform, Insta Assist by clicking: https://rules.nivabupa.com/customer-service/.</p>
      <p>We request you to read your policy terms and conditions carefully so that you are fully aware of your policy benefits. For benefits related to section 80D, please consult your tax advisor.</p>
      <p>Assuring you of our best services and wishing you and your loved ones good health always.</p>
      <div className="nb-letter-yours">Yours Sincerely,</div>
      <img src={process.env.PUBLIC_URL + "/images/niva-bupa-signature.png"} alt="" className="nb-letter-sig" />
      <div className="nb-letter-attorney">
        <strong>Director - Operations &amp; Customer Service</strong>
        <div>For and on behalf of Niva Bupa Health Insurance Co. Ltd.</div>
        <em>(Formerly known as Max Bupa Health Insurance Co. Ltd.)</em>
      </div>
      <div className="nb-letter-imp">Important - Please read this document and keep in a safe place.</div>
    </div>
    <div className="nb-page-footer">Product Name: {d.productName} | Product UIN: {d.productUIN}</div>
  </div>
);

const CertificatePage = ({ d }) => (
  <div className="nb-page">
    <div className="nb-logo-wrap">
      <img src={process.env.PUBLIC_URL + "/images/niva-bupa-logo.png"} alt="Niva Bupa" className="nb-logo" />
    </div>
    <div className="nb-cert-banner">{d.productName} Insurance Certificate</div>

    <table className="nb-table nb-table-policy">
      <tbody>
        <tr>
          <th>Policyholder Name:</th>
          <td>MR. {d.policyHolder}</td>
          <th>Policy Number</th>
          <td>{d.policyNumber}</td>
        </tr>
        <tr>
          <th rowSpan={4}>Policyholder Address:</th>
          <td rowSpan={4}>
            {d.addressLines.map((l, i) => <div key={i}>{l}</div>)}
          </td>
          <th>Policy Commencement Date and Time</th>
          <td>From {d.startStr} 00:00</td>
        </tr>
        <tr>
          <th>Policy Expiry Date and Time</th>
          <td>To {d.expiryStr} 23:59</td>
        </tr>
        <tr>
          <th>Base Sum Insured</th>
          <td>INR {fmtINR(d.baseSumInsured)}</td>
        </tr>
        <tr>
          <th>Variant Opted</th>
          <td>{d.variant}</td>
        </tr>
        <tr>
          <th colSpan={2} className="nb-eia-head">Details of Electronic Insurance Account (eIA)</th>
          <th>Plan Opted</th>
          <td>{d.planOpted}</td>
        </tr>
        <tr>
          <th>eIA Number</th>
          <td>None</td>
          <th>Policy Period</th>
          <td>{d.policyPeriodYears} {d.policyPeriodYears > 1 ? "Years" : "Year"}</td>
        </tr>
        <tr>
          <th>Insurance Repository Name</th>
          <td>None</td>
          <th>Renewal / Payment Due Date</th>
          <td>{d.renewalStr}</td>
        </tr>
        <tr>
          <th colSpan={2} className="nb-eia-head">Details of Central Know Your Customer (CKYC)</th>
          <th>Reported claims in the policy since inception</th>
          <td>0</td>
        </tr>
        <tr>
          <th>CKYC Number</th>
          <td>None</td>
          <td colSpan={2}></td>
        </tr>
      </tbody>
    </table>

    <div className="nb-section-heading">Cover Details</div>
    <table className="nb-table nb-table-cover">
      <thead>
        <tr>
          <th>Name of the Insured Person(s)</th>
          <th>Base Sum Insured (INR)</th>
          <th>Sum Insured Safeguard (INR)</th>
          <th>Booster+Sum Insured (INR)</th>
          <th>Sum Insured (Base Sum Insured + Sum Insured Safeguard + Booster+Sum Insured) (INR)</th>
          <th>Personal Accident opted</th>
        </tr>
      </thead>
      <tbody>
        {d.members.map((m, i) => (
          <tr key={i}>
            <td>{m.name}</td>
            <td>{fmtINR(m.baseSumInsured)}</td>
            <td>0</td>
            <td>0</td>
            <td>{fmtINR(m.baseSumInsured)}</td>
            <td>{m.personalAccident}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="nb-section-heading">Premium Details</div>
    <table className="nb-table nb-table-premium">
      <thead>
        <tr>
          <th>Net Premium/Taxable Value (INR)</th>
          <th>Integrated Goods and Service Tax (18.00%)</th>
          <th>Central Goods and Service Tax (0.00%)</th>
          <th>State/UT Goods and Service Tax (0.00 %)</th>
          <th>Loading</th>
          <th>Gross Premium (INR)</th>
          <th>Gross Premium (INR) (in words)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{d.netPremium.toFixed(2).split(".")[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.{d.netPremium.toFixed(2).split(".")[1]}</td>
          <td>{d.igst.toFixed(2).split(".")[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.{d.igst.toFixed(2).split(".")[1]}</td>
          <td>0.00</td>
          <td>0.00</td>
          <td>0.00</td>
          <td>{fmtINR(Math.round(d.gross))}.00</td>
          <td>{d.grossWords}</td>
        </tr>
      </tbody>
    </table>

    <div className="nb-section-heading">Nominee Details</div>
    <table className="nb-table">
      <thead>
        <tr>
          <th>Nominee Name</th>
          <th>Relationship with the Policyholder</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{d.nomineeName || "—"}</td>
          <td>{d.nomineeRelation}</td>
        </tr>
      </tbody>
    </table>

    <div className="nb-section-heading">Intermediary Details</div>
    <table className="nb-table nb-table-intermediary">
      <thead>
        <tr>
          <th>Intermediary Name</th>
          <th>Intermediary Code</th>
          <th>Intermediary Contact No.</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>NA</td>
          <td>NA</td>
          <td>NA</td>
        </tr>
      </tbody>
    </table>

    <table className="nb-table">
      <thead>
        <tr>
          <th>Claim Administrator</th>
          <th>Servicing Branch Details</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Niva Bupa Health Insurance Company Limited</td>
          <td>Logix Infotech Park, Plot no D-5, Sector 59, Noida, Gautam Budh Nagar, Uttar Pradesh 201301</td>
        </tr>
      </tbody>
    </table>

    <div className="nb-page-footer">Product Name: {d.productName} | Product UIN: {d.productUIN}</div>
  </div>
);
