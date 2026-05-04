import React, { Component } from "react";
import "./MedicalInsurance.css";
import ReactGA from "react-ga4";
import { getHistory, addToHistory } from "../utils/inputHistory";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatDDMMYYYY = (d) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const HISTORY_KEYS = {
  salutation: "mi_salutation",
  policyHolder: "mi_policyHolder",
  address: "mi_address",
  contact: "mi_contact",
  policyRef: "mi_policyRef",
  planName: "mi_planName",
  startDate: "mi_startDate",
  issueDate: "mi_issueDate",
  members: "mi_members",
};

const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);

const Barcode = ({ value }) => {
  const v = value || "0000";
  const seed = [...v].reduce((s, c) => s + c.charCodeAt(0), 0);
  const widths = [];
  let r = seed;
  for (let i = 0; i < 90; i++) {
    r = (r * 9301 + 49297) % 233280;
    widths.push(1 + (r % 3));
  }
  let x = 0;
  const bars = [];
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    if (i % 2 === 0) {
      bars.push(<rect key={i} x={x} y={0} width={w} height={40} fill="#000" />);
    }
    x += w;
  }
  return (
    <svg viewBox={`0 0 ${x} 40`} className="mi-barcode" preserveAspectRatio="none">
      {bars}
    </svg>
  );
};

export default class MedicalInsurance extends Component {
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
      salutation: last("salutation", "MR"),
      policyHolder: last("policyHolder", ""),
      address: last("address", ""),
      contact: last("contact", ""),
      policyRef: last("policyRef", ""),
      planName: last("planName", "Optima Secure"),
      startDate: last("startDate", todayISO),
      issueDate: last("issueDate", todayISO),
      members: savedMembers || [
        { name: "", relation: "Self", gender: "Male", dob: "", totalPremium: "" },
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
      members: [...s.members, { name: "", relation: "Spouse", gender: "Female", dob: "", totalPremium: "" }],
    }));
  };

  removeMember = (idx) => {
    this.setState((s) => ({
      members: s.members.filter((_, i) => i !== idx),
    }));
  };

  generate = () => {
    const { salutation, policyHolder, address, contact, policyRef, planName, startDate, issueDate, members } = this.state;
    if (!policyHolder.trim() || !address.trim() || !policyRef.trim() || !startDate) {
      alert("Policy Holder, Address, Policy Reference and Start Date are required");
      return;
    }
    if (members.length === 0) {
      alert("Add at least one insured member");
      return;
    }
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.name.trim() || !m.dob || !m.totalPremium) {
        alert(`Fill all fields for member ${i + 1}`);
        return;
      }
      if (isNaN(parseFloat(m.totalPremium)) || parseFloat(m.totalPremium) <= 0) {
        alert(`Enter a valid total premium for member ${i + 1}`);
        return;
      }
    }

    const start = parseISO(startDate);
    const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    const issued = parseISO(issueDate);

    const computed = members.map((m) => {
      const total = parseFloat(m.totalPremium);
      const base = total / 1.18;
      const gst = total - base;
      const dob = parseISO(m.dob);
      return {
        name: m.name.trim(),
        relation: m.relation,
        gender: m.gender,
        dob: dob ? formatDDMMYYYY(dob) : "",
        baseFormatted: base.toFixed(2),
        gstFormatted: gst.toFixed(4),
        totalFormatted: total.toFixed(2),
        baseRaw: base,
        gstRaw: gst,
        totalRaw: total,
      };
    });

    const totalSum = computed.reduce((s, m) => s + m.totalRaw, 0);
    const totalSumRounded = Math.round(totalSum);

    addToHistory(HISTORY_KEYS.salutation, salutation);
    addToHistory(HISTORY_KEYS.policyHolder, policyHolder.trim());
    addToHistory(HISTORY_KEYS.address, address.trim());
    addToHistory(HISTORY_KEYS.contact, contact.trim());
    addToHistory(HISTORY_KEYS.policyRef, policyRef.trim());
    addToHistory(HISTORY_KEYS.planName, planName.trim());
    addToHistory(HISTORY_KEYS.startDate, startDate);
    addToHistory(HISTORY_KEYS.issueDate, issueDate);
    try { addToHistory(HISTORY_KEYS.members, JSON.stringify(members)); } catch {}

    document.title = `80D Insurance - ${policyHolder.trim()} - FY ${start.getFullYear()}-${String(start.getFullYear() + 1).slice(-2)}`;

    this.setState({
      pdfView: true,
      output: {
        salutation,
        policyHolder: policyHolder.trim().toUpperCase(),
        addressLines: address.trim().split("\n").filter(Boolean),
        contact: contact.trim(),
        policyRef: policyRef.trim(),
        planName: planName.trim() || "Optima Secure",
        periodStart: formatDDMMYYYY(start),
        periodEnd: formatDDMMYYYY(end),
        issueDate: formatDDMMYYYY(issued),
        members: computed,
        totalSum: totalSumRounded,
      },
    });

    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({
        category: "User Interaction",
        action: "Clicked a Button",
        label: "Generate Medical Insurance Cert",
        members: members.length,
      });
    }
  };

  render() {
    const { salutation, policyHolder, address, contact, policyRef, planName, startDate, issueDate, members, pdfView, output } = this.state;

    if (pdfView && output) {
      return (
        <>
          <div className="noprint bg-result-bar">
            <div className="bg-result-stats">
              <span className="bg-result-stat">Members: <strong>{output.members.length}</strong></span>
              <span className="bg-result-stat">Total premium: <strong>Rs. {output.totalSum.toLocaleString("en-IN")}</strong></span>
            </div>
            <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">
              Generate More
            </button>
          </div>
          <div className="mi-page">
            <Section1 d={output} />
            <div className="mi-cut-line" aria-hidden="true">
              <span className="mi-scissors">&#9986;</span>
            </div>
            <Section2 d={output} />
            <div className="mi-footer">
              HDFC ERGO General Insurance Company Limited. IRDAI Reg No.146 &nbsp;&nbsp;&nbsp; UIN: HDFHLIP23123V022223. &nbsp;&nbsp;&nbsp; Customer Service Address: D 301, 3rd Floor,
              <br />
              CIN : U66030MH2007PLC177117. &nbsp; Registered &amp; Corporate Office: 1st Floor, HDFC House, &nbsp;&nbsp;&nbsp; Eastern Business District (Magnet Mall), LBS Marg, Bhandup (West), Mumbai - 400 078.
              <br />
              165/166 Backbay Reclamation, H.T.Parekh Marg, Churchgate, Mumbai - 400 020. &nbsp;&nbsp;&nbsp; Customer Service No : +91 22-62346234/+91-120 6234 6234 | www.hdfcergo.com
            </div>
          </div>
        </>
      );
    }

    return (
      <div className="bg-card">
        <h2 className="bg-card-title">Medical Insurance 80D Certificate Generator</h2>
        <p className="bg-card-desc">Generate an HDFC ERGO style health insurance policy certificate with Section 80D premium breakup.</p>

        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Salutation</label>
            <select className="bg-input" value={salutation} onChange={(e) => this.onChange(e, "salutation")}>
              <option value="MR">MR</option>
              <option value="MRS">MRS</option>
              <option value="MS">MS</option>
            </select>
          </div>
          <div className="bg-field">
            <label className="bg-label">Policy Holder Name <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={policyHolder} onChange={(e) => this.onChange(e, "policyHolder")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Address <span className="bg-label-hint">multi-line, required</span></label>
            <textarea className="bg-input" rows={3} autoComplete="off" value={address} onChange={(e) => this.onChange(e, "address")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Contact Number <span className="bg-label-hint">e.g. 98XXXXXXX9</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={contact} onChange={(e) => this.onChange(e, "contact")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Plan Name</label>
            <input className="bg-input" type="text" autoComplete="off" value={planName} onChange={(e) => this.onChange(e, "planName")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Policy Reference Number <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={policyRef} onChange={(e) => this.onChange(e, "policyRef")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Policy Start Date <span className="bg-label-hint">required, end auto = +1 year</span></label>
            <input className="bg-input" type="date" value={startDate} onChange={(e) => this.onChange(e, "startDate")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Certificate Issue Date</label>
            <input className="bg-input" type="date" value={issueDate} onChange={(e) => this.onChange(e, "issueDate")} />
          </div>
        </div>

        <div className="mi-members">
          <div className="mi-members-header">
            <h3 className="mi-members-title">Insured Members</h3>
            <button type="button" className="bg-btn bg-btn-secondary" onClick={this.addMember}>+ Add Member</button>
          </div>
          {members.map((m, idx) => (
            <div key={idx} className="mi-member-row">
              <div className="mi-member-grid">
                <div className="bg-field">
                  <label className="bg-label">Name</label>
                  <input className="bg-input" type="text" value={m.name} onChange={(e) => this.updateMember(idx, "name", e.target.value)} />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Relation</label>
                  <select className="bg-input" value={m.relation} onChange={(e) => this.updateMember(idx, "relation", e.target.value)}>
                    <option>Self</option>
                    <option>Spouse</option>
                    <option>Son</option>
                    <option>Daughter</option>
                    <option>Father</option>
                    <option>Mother</option>
                  </select>
                </div>
                <div className="bg-field">
                  <label className="bg-label">Gender</label>
                  <select className="bg-input" value={m.gender} onChange={(e) => this.updateMember(idx, "gender", e.target.value)}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div className="bg-field">
                  <label className="bg-label">Date of Birth</label>
                  <input className="bg-input" type="date" value={m.dob} onChange={(e) => this.updateMember(idx, "dob", e.target.value)} />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Total Premium Paid (incl. 18% GST)</label>
                  <input className="bg-input" type="number" step="0.01" value={m.totalPremium} onChange={(e) => this.updateMember(idx, "totalPremium", e.target.value)} />
                </div>
              </div>
              {members.length > 1 ? (
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
          <div>Enter the total premium each person paid (including 18% GST). Base premium and GST are auto-calculated.</div>
          <div>Add a member for each insured person — yourself, spouse, kids, parents.</div>
          <div>The output is a single-page A4 with welcome letter on top and 80D certificate below.</div>
        </div>
      </div>
    );
  }
}

const Section1 = ({ d }) => (
  <section className="mi-section">
    <div className="mi-header-row">
      <h1 className="mi-company">HDFC ERGO General Insurance Company Limited</h1>
      <img src={process.env.PUBLIC_URL + "/images/hdfc-ergo-logo.png"} alt="HDFC ERGO" className="mi-logo" />
    </div>
    <div className="mi-plan">my: <strong>{d.planName}</strong></div>
    <div className="mi-barcode-wrap">
      <Barcode value={d.policyRef} />
      <div className="mi-barcode-text">{d.policyRef}</div>
    </div>
    <div className="mi-address">
      <div>{d.salutation} {d.policyHolder}</div>
      {d.addressLines.map((l, i) => <div key={i} className="mi-addr-line">{l}</div>)}
      {d.contact ? <div className="mi-addr-line">Contact No. {d.contact}</div> : null}
    </div>
    <div className="mi-date">Date:{d.issueDate}</div>
    <div className="mi-greeting">Dear {d.salutation} {d.policyHolder}</div>
    <p className="mi-para">Thank you for choosing HDFC ERGO GENERAL INSURANCE COMPANY LTD. as your preferred insurance partner. We welcome you to be a part of our family !</p>
    <p className="mi-para">Your Health insurance policy reference no {d.policyRef} is confirmed on the basis of the information and declaration given by you. The details of coverage are mentioned in the enclosed policy schedule of insurance.</p>
    <p className="mi-para">We value your relationship with us and assure you our best services at all times and we look forward to serve you.</p>
    <p className="mi-para">Now you can view your policy details and health card at your fingertips. Download our Mobile App now and experience convenience today!!</p>
    <div className="mi-signoff">For HDFC ERGO General Insurance Company Ltd.</div>
    <img src={process.env.PUBLIC_URL + "/images/signature.png"} alt="" className="mi-sig" />
    <div className="mi-attorney">Duly Constituted Attorney</div>
  </section>
);

const Section2 = ({ d }) => (
  <section className="mi-section">
    <div className="mi-header-row">
      <h1 className="mi-company">HDFC ERGO General Insurance Company Limited</h1>
      <img src={process.env.PUBLIC_URL + "/images/hdfc-ergo-logo.png"} alt="HDFC ERGO" className="mi-logo" />
    </div>
    <div className="mi-cert-greeting">Dear{d.salutation} {d.policyHolder},</div>
    <div className="mi-subject"><strong>Subject :</strong> Certificate for the purpose of deduction under section 80 D of Income Tax (Amendment) Act, 1986</div>
    <p className="mi-para mi-cert-para">
      This is to certify that we have received an amount of {d.totalSum.toLocaleString("en-IN")} towards premium from {d.salutation} {d.policyHolder} for my : {d.planName},Policy No. {d.policyRef} issued to {d.salutation} {d.policyHolder} for the period {d.periodStart} to {d.periodEnd}.
    </p>
    <div className="mi-table-label">Member wise premium break up is as follows:</div>
    <table className="mi-table">
      <thead>
        <tr><th colSpan={6} className="mi-table-title">Insured Person's Premium Details</th></tr>
        <tr>
          <th>Name of Insured Person</th>
          <th>Relation with policy holder</th>
          <th>Gender</th>
          <th>Date of Birth</th>
          <th>Premium</th>
          <th>Goods &amp; Services Tax (GST)</th>
          <th>Total Premium including GST</th>
        </tr>
      </thead>
      <tbody>
        {d.members.map((m, i) => (
          <tr key={i}>
            <td>{m.name}</td>
            <td>{m.relation}</td>
            <td>{m.gender}</td>
            <td>{m.dob}</td>
            <td>{m.baseFormatted}</td>
            <td>{m.gstFormatted}</td>
            <td>{m.totalFormatted}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="mi-note">
      <div>Note:</div>
      <ol>
        <li>This is subject to the provisions of Section 80D of income tax (Amendment) Act, 1986 as amended from time to time.</li>
        <li>This certificate must be surrendered to the company in case of cancellation of this policy. In event of incorrect representation of this declaration the liability shall be upon the policy holder.</li>
      </ol>
    </div>
    <div className="mi-signoff mi-signoff-right">For HDFC ERGO General Insurance Company Ltd.</div>
    <div className="mi-cert-footer">
      <div>Date:{d.issueDate}</div>
      <div className="mi-cert-sig-block">
        <img src={process.env.PUBLIC_URL + "/images/signature.png"} alt="" className="mi-sig" />
        <div className="mi-attorney">Duly Constituted Attorney</div>
      </div>
    </div>
  </section>
);
