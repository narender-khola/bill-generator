import React, { Component } from "react";
import "./CarInsurance.css";
import ReactGA from "react-ga4";
import { QRCodeSVG } from "qrcode.react";
import { getHistory, addToHistory } from "../utils/inputHistory";

const HISTORY_KEYS = {
  policyNumber: "ci_policyNumber",
  insuredName: "ci_insuredName",
  insuredAddress: "ci_insuredAddress",
  insuredPhone: "ci_insuredPhone",
  insuredMobile: "ci_insuredMobile",
  insuredEmail: "ci_insuredEmail",
  insuredGSTIN: "ci_insuredGSTIN",
  policyOffice: "ci_policyOffice",
  policyIssuedDate: "ci_policyIssuedDate",
  policyFrom: "ci_policyFrom",
  policyTo: "ci_policyTo",
  hypothecatedTo: "ci_hypothecatedTo",
  regNo: "ci_regNo",
  manufacturer: "ci_manufacturer",
  model: "ci_model",
  variant: "ci_variant",
  year: "ci_year",
  rto: "ci_rto",
  engineNo: "ci_engineNo",
  chassisNo: "ci_chassisNo",
  cubicCap: "ci_cubicCap",
  seatingCapacity: "ci_seatingCapacity",
  idv: "ci_idv",
  basicOwnDamage: "ci_basicOwnDamage",
  ncbPercent: "ci_ncbPercent",
  basicTP: "ci_basicTP",
  paOwnerDriver: "ci_paOwnerDriver",
  intermediaryName: "ci_intermediaryName",
  intermediaryCode: "ci_intermediaryCode",
  intermediaryMobile: "ci_intermediaryMobile",
  intermediaryLandline: "ci_intermediaryLandline",
  nomineeName: "ci_nomineeName",
  nomineeAge: "ci_nomineeAge",
  nomineeRelation: "ci_nomineeRelation",
  addOns: "ci_addOns",
};

const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);

const formatDDMMYYYY = (s) => {
  if (!s || !s.includes("-")) return s || "";
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
};

const formatINR = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default class CarInsurance extends Component {
  constructor(props) {
    super(props);
    let savedAddOns = null;
    try {
      const raw = last("addOns", null);
      if (raw) savedAddOns = JSON.parse(raw);
    } catch {}

    this.state = {
      policyNumber: last("policyNumber", ""),
      insuredName: last("insuredName", ""),
      insuredAddress: last("insuredAddress", ""),
      insuredPhone: last("insuredPhone", "NA"),
      insuredMobile: last("insuredMobile", ""),
      insuredEmail: last("insuredEmail", ""),
      insuredGSTIN: last("insuredGSTIN", ""),
      policyOffice: last("policyOffice", "201-204, 301, 2nd & 3rd Floor, Chintamani Classique, Vishweshwar Nagar, off Aarey road, Near, Udipi Vihar Hotel, Goregaon (E), Mumbai 400063"),
      policyIssuedDate: last("policyIssuedDate", ""),
      policyFrom: last("policyFrom", ""),
      policyTo: last("policyTo", ""),
      hypothecatedTo: last("hypothecatedTo", "SBI"),
      regNo: last("regNo", ""),
      manufacturer: last("manufacturer", ""),
      model: last("model", ""),
      variant: last("variant", ""),
      year: last("year", ""),
      rto: last("rto", ""),
      engineNo: last("engineNo", ""),
      chassisNo: last("chassisNo", ""),
      cubicCap: last("cubicCap", ""),
      seatingCapacity: last("seatingCapacity", "5"),
      idv: last("idv", ""),
      basicOwnDamage: last("basicOwnDamage", ""),
      ncbPercent: last("ncbPercent", "25"),
      basicTP: last("basicTP", ""),
      paOwnerDriver: last("paOwnerDriver", "0.00"),
      intermediaryName: last("intermediaryName", "Policybazaar Insurance Brokers Private Limited."),
      intermediaryCode: last("intermediaryCode", "34235100"),
      intermediaryMobile: last("intermediaryMobile", ""),
      intermediaryLandline: last("intermediaryLandline", "1800026 0008787"),
      nomineeName: last("nomineeName", ""),
      nomineeAge: last("nomineeAge", ""),
      nomineeRelation: last("nomineeRelation", "Son"),
      addOns: savedAddOns || [
        { name: "Engine Protect", premium: "" },
        { name: "Consumable Cover", premium: "" },
        { name: "Pay as you drive", premium: "" },
        { name: "Depreciation Cover", premium: "" },
        { name: "Return to Invoice", premium: "" },
      ],
      pdfView: false,
      output: null,
    };
  }

  onChange = (e, id) => this.setState({ [id]: e.target.value });

  updateAddOn = (idx, field, value) => {
    this.setState((s) => ({
      addOns: s.addOns.map((a, i) => (i === idx ? { ...a, [field]: value } : a)),
    }));
  };

  addAddOn = () => {
    this.setState((s) => ({ addOns: [...s.addOns, { name: "", premium: "" }] }));
  };

  removeAddOn = (idx) => {
    this.setState((s) => ({ addOns: s.addOns.filter((_, i) => i !== idx) }));
  };

  generate = () => {
    const s = this.state;
    if (!s.policyNumber.trim() || !s.insuredName.trim() || !s.regNo.trim() || !s.policyFrom || !s.policyTo) {
      alert("Policy number, insured name, registration number and policy dates are required");
      return;
    }
    const idv = parseFloat(s.idv) || 0;
    const basicOD = parseFloat(s.basicOwnDamage) || 0;
    const ncb = parseFloat(s.ncbPercent) || 0;
    const basicTP = parseFloat(s.basicTP) || 0;
    const paOD = parseFloat(s.paOwnerDriver) || 0;

    const addOnsCalc = s.addOns.filter((a) => a.name.trim()).map((a) => ({
      name: a.name.trim(),
      premium: parseFloat(a.premium) || 0,
    }));
    const addOnsTotal = addOnsCalc.reduce((sum, a) => sum + a.premium, 0);

    const ncbDiscount = +(basicOD * (ncb / 100)).toFixed(2);
    const totalODBeforeTax = +(basicOD + addOnsTotal - ncbDiscount).toFixed(2);
    const totalLiability = +(basicTP + paOD).toFixed(2);
    const totalTaxableA = totalODBeforeTax;
    const igstA = +(totalTaxableA * 0.18).toFixed(2);
    const totalODA = +(totalTaxableA + igstA).toFixed(2);
    const grandTotal = +(totalODA + totalLiability).toFixed(2);

    Object.entries(HISTORY_KEYS).forEach(([k]) => {
      if (k === "addOns") return;
      addToHistory(HISTORY_KEYS[k], s[k]);
    });
    try { addToHistory(HISTORY_KEYS.addOns, JSON.stringify(s.addOns)); } catch {}

    document.title = `Car Insurance - ${s.regNo.trim().toUpperCase()} - ${formatDDMMYYYY(s.policyFrom)}`;

    this.setState({
      pdfView: true,
      output: {
        policyNumber: s.policyNumber.trim(),
        insured: {
          name: s.insuredName.trim(),
          address: s.insuredAddress.trim(),
          phone: s.insuredPhone.trim(),
          mobile: s.insuredMobile.trim(),
          email: s.insuredEmail.trim(),
          gstin: s.insuredGSTIN.trim(),
        },
        policy: {
          office: s.policyOffice.trim(),
          issuedDate: formatDDMMYYYY(s.policyIssuedDate),
          from: formatDDMMYYYY(s.policyFrom),
          to: formatDDMMYYYY(s.policyTo),
          hypothecatedTo: s.hypothecatedTo.trim(),
        },
        vehicle: {
          regNo: s.regNo.trim().toUpperCase(),
          manufacturer: s.manufacturer.trim().toUpperCase(),
          model: s.model.trim().toUpperCase(),
          variant: s.variant.trim().toUpperCase(),
          year: s.year.trim(),
          rto: s.rto.trim().toUpperCase(),
          engineNo: s.engineNo.trim().toUpperCase(),
          chassisNo: s.chassisNo.trim().toUpperCase(),
          cubicCap: s.cubicCap.trim(),
          seatingCapacity: s.seatingCapacity.trim(),
          idv,
        },
        premium: {
          basicOD, ncb, ncbDiscount, addOnsTotal, addOnsCalc,
          totalODBeforeTax, totalTaxableA, igstA, totalODA,
          basicTP, paOD, totalLiability,
          grandTotal,
        },
        intermediary: {
          name: s.intermediaryName.trim(),
          code: s.intermediaryCode.trim(),
          mobile: s.intermediaryMobile.trim(),
          landline: s.intermediaryLandline.trim(),
        },
        nominee: {
          name: s.nomineeName.trim(),
          age: s.nomineeAge.trim(),
          relation: s.nomineeRelation,
        },
      },
    });

    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({ category: "User Interaction", action: "Clicked a Button", label: "Generate Car Insurance" });
    }
  };

  render() {
    if (this.state.pdfView && this.state.output) return this.renderOutput();
    return this.renderForm();
  }

  renderForm() {
    const s = this.state;
    return (
      <div className="bg-card">
        <h2 className="bg-card-title">Car Insurance Generator (Zurich Kotak)</h2>
        <p className="bg-card-desc">Generate a Comprehensive Car Insurance Certificate cum Policy Schedule.</p>

        <h3 className="ci-section-title">Policy</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Policy / Certificate Number <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={s.policyNumber} onChange={(e) => this.onChange(e, "policyNumber")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Policy Issued Date</label>
            <input className="bg-input" type="date" value={s.policyIssuedDate} onChange={(e) => this.onChange(e, "policyIssuedDate")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">From <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="date" value={s.policyFrom} onChange={(e) => this.onChange(e, "policyFrom")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">To <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="date" value={s.policyTo} onChange={(e) => this.onChange(e, "policyTo")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Hypothecated To</label>
            <input className="bg-input" type="text" value={s.hypothecatedTo} onChange={(e) => this.onChange(e, "hypothecatedTo")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Policy Issuing Office</label>
            <textarea className="bg-input" rows={2} value={s.policyOffice} onChange={(e) => this.onChange(e, "policyOffice")} />
          </div>
        </div>

        <h3 className="ci-section-title">Insured</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Name <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" value={s.insuredName} onChange={(e) => this.onChange(e, "insuredName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Phone</label>
            <input className="bg-input" type="text" value={s.insuredPhone} onChange={(e) => this.onChange(e, "insuredPhone")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Mobile</label>
            <input className="bg-input" type="text" value={s.insuredMobile} onChange={(e) => this.onChange(e, "insuredMobile")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Email</label>
            <input className="bg-input" type="email" value={s.insuredEmail} onChange={(e) => this.onChange(e, "insuredEmail")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">GSTIN</label>
            <input className="bg-input" type="text" value={s.insuredGSTIN} onChange={(e) => this.onChange(e, "insuredGSTIN")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Address</label>
            <textarea className="bg-input" rows={2} value={s.insuredAddress} onChange={(e) => this.onChange(e, "insuredAddress")} />
          </div>
        </div>

        <h3 className="ci-section-title">Vehicle</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Registration Number <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" value={s.regNo} onChange={(e) => this.onChange(e, "regNo")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Manufacturer</label>
            <input className="bg-input" type="text" value={s.manufacturer} onChange={(e) => this.onChange(e, "manufacturer")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Model</label>
            <input className="bg-input" type="text" value={s.model} onChange={(e) => this.onChange(e, "model")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Variant</label>
            <input className="bg-input" type="text" value={s.variant} onChange={(e) => this.onChange(e, "variant")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Year of Mfr</label>
            <input className="bg-input" type="number" value={s.year} onChange={(e) => this.onChange(e, "year")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">RTO Location</label>
            <input className="bg-input" type="text" value={s.rto} onChange={(e) => this.onChange(e, "rto")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Engine Number</label>
            <input className="bg-input" type="text" value={s.engineNo} onChange={(e) => this.onChange(e, "engineNo")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Chassis Number</label>
            <input className="bg-input" type="text" value={s.chassisNo} onChange={(e) => this.onChange(e, "chassisNo")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Cubic Capacity</label>
            <input className="bg-input" type="number" value={s.cubicCap} onChange={(e) => this.onChange(e, "cubicCap")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Seating Capacity</label>
            <input className="bg-input" type="number" value={s.seatingCapacity} onChange={(e) => this.onChange(e, "seatingCapacity")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Insured Declared Value (IDV) Rs.</label>
            <input className="bg-input" type="number" value={s.idv} onChange={(e) => this.onChange(e, "idv")} />
          </div>
        </div>

        <h3 className="ci-section-title">Premium</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Basic Own Damage Premium (Rs.)</label>
            <input className="bg-input" type="number" step="0.01" value={s.basicOwnDamage} onChange={(e) => this.onChange(e, "basicOwnDamage")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Bonus Percent (NCB %)</label>
            <input className="bg-input" type="number" step="1" value={s.ncbPercent} onChange={(e) => this.onChange(e, "ncbPercent")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Basic TP including TPPD Premium (Rs.)</label>
            <input className="bg-input" type="number" step="0.01" value={s.basicTP} onChange={(e) => this.onChange(e, "basicTP")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">PA Cover for Owner Driver (Rs.)</label>
            <input className="bg-input" type="number" step="0.01" value={s.paOwnerDriver} onChange={(e) => this.onChange(e, "paOwnerDriver")} />
          </div>
        </div>

        <h3 className="ci-section-title">Add-On Covers</h3>
        <div className="mi-members">
          <div className="mi-members-header">
            <button type="button" className="bg-btn bg-btn-secondary" onClick={this.addAddOn}>+ Add Cover</button>
          </div>
          {s.addOns.map((a, idx) => (
            <div key={idx} className="mi-member-row">
              <div className="ci-addon-grid">
                <div className="bg-field">
                  <label className="bg-label">Cover Name</label>
                  <input className="bg-input" type="text" value={a.name} onChange={(e) => this.updateAddOn(idx, "name", e.target.value)} />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Premium (Rs.)</label>
                  <input className="bg-input" type="number" step="0.01" value={a.premium} onChange={(e) => this.updateAddOn(idx, "premium", e.target.value)} />
                </div>
              </div>
              {s.addOns.length > 1 ? (
                <button type="button" className="mi-remove-btn" onClick={() => this.removeAddOn(idx)}>×</button>
              ) : null}
            </div>
          ))}
        </div>

        <h3 className="ci-section-title">Intermediary</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Name</label>
            <input className="bg-input" type="text" value={s.intermediaryName} onChange={(e) => this.onChange(e, "intermediaryName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Code</label>
            <input className="bg-input" type="text" value={s.intermediaryCode} onChange={(e) => this.onChange(e, "intermediaryCode")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Mobile</label>
            <input className="bg-input" type="text" value={s.intermediaryMobile} onChange={(e) => this.onChange(e, "intermediaryMobile")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Landline</label>
            <input className="bg-input" type="text" value={s.intermediaryLandline} onChange={(e) => this.onChange(e, "intermediaryLandline")} />
          </div>
        </div>

        <h3 className="ci-section-title">Nominee</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Name</label>
            <input className="bg-input" type="text" value={s.nomineeName} onChange={(e) => this.onChange(e, "nomineeName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Age</label>
            <input className="bg-input" type="number" value={s.nomineeAge} onChange={(e) => this.onChange(e, "nomineeAge")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Relationship</label>
            <select className="bg-input" value={s.nomineeRelation} onChange={(e) => this.onChange(e, "nomineeRelation")}>
              <option>Son</option>
              <option>Daughter</option>
              <option>Spouse</option>
              <option>Father</option>
              <option>Mother</option>
              <option>Brother</option>
              <option>Sister</option>
            </select>
          </div>
        </div>

        <div className="bg-actions">
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.generate}>Generate Policy</button>
        </div>

        <div className="bg-tips">
          <div className="bg-tips-title">Tips</div>
          <div>18% IGST is auto-calculated on the Own Damage taxable value.</div>
          <div>NCB discount is auto-computed as Basic OD × NCB%.</div>
        </div>
      </div>
    );
  }

  renderOutput() {
    const d = this.state.output;
    return (
      <>
        <div className="noprint bg-result-bar">
          <div className="bg-result-stats">
            <span className="bg-result-stat">Policy: <strong>{d.policyNumber}</strong></span>
            <span className="bg-result-stat">Total: <strong>Rs. {Number(d.premium.grandTotal).toLocaleString("en-IN")}</strong></span>
          </div>
          <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">Generate More</button>
        </div>
        <Page1 d={d} />
        <Page2 d={d} />
        <Page3 d={d} />
      </>
    );
  }
}

const Header = ({ d }) => (
  <>
    <div className="ci-top-row">
      <img src={process.env.PUBLIC_URL + "/images/zurich-kotak-logo.png"} alt="Zurich Kotak" className="ci-logo" />
      <div className="ci-title">
        <div className="ci-title-1">Car Secure</div>
        <div className="ci-title-2">(Comprehensive Policy)</div>
        <div className="ci-title-3">Certificate cum Policy Schedule</div>
      </div>
      <div className="ci-qr">
        <QRCodeSVG value={d.policyNumber} size={64} level="L" />
      </div>
    </div>
    <div className="ci-policy-line">
      <strong>Policy / Certificate No: {d.policyNumber}</strong> &nbsp;&nbsp;&nbsp;
      For any assistance please call <strong>1800 266 4545</strong> or visit <strong>www.zurichkotak.com</strong>
    </div>
  </>
);

const Footer = ({ d }) => (
  <div className="ci-page-footer">
    <div>Car Secure UIN: IRDAN152RP0006V04201516</div>
    <div>Zurich Kotak General Insurance Company (India) Limited (Formerly known as Kotak Mahindra General Insurance Company Limited) CIN: U66030MH2014PLC260291. IRDAI Reg. No. 152.</div>
    <div><strong>Registered &amp; Corporate Office:</strong> 8/1, 4th floor, Silver Metropolis, Jai Coach Compound, Off Western Express Highway, Goregaon (East), Mumbai - 400063, Maharashtra, India.</div>
    <div>Toll Free: 1800 266 4545. Email: care@zurichkotak.com Website: www.zurichkotak.com</div>
  </div>
);

const Page1 = ({ d }) => (
  <div className="ci-page">
    <Header d={d} />
    <div className="ci-twocol">
      <div className="ci-section">
        <div className="ci-section-bar">INSURED DETAILS</div>
        <table className="ci-kv">
          <tbody>
            <tr><td className="ci-k">Name:</td><td>{d.insured.name}</td></tr>
            <tr><td className="ci-k">Address:</td><td>{d.insured.address}</td></tr>
            <tr><td className="ci-k">Phone:</td><td>{d.insured.phone || "NA"}</td></tr>
            <tr><td className="ci-k">Mobile:</td><td>{d.insured.mobile}</td></tr>
            <tr><td className="ci-k">Email:</td><td>{d.insured.email}</td></tr>
            <tr><td className="ci-k">GSTIN:</td><td>{d.insured.gstin}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="ci-section">
        <div className="ci-section-bar">POLICY DETAILS</div>
        <table className="ci-kv">
          <tbody>
            <tr><td className="ci-k">Policy Issuing Office:</td><td>{d.policy.office}</td></tr>
            <tr><td className="ci-k">Policy issued on:</td><td>{d.policy.issuedDate}</td></tr>
            <tr><td className="ci-k">From:</td><td>{d.policy.from} 00:00 &nbsp;&nbsp;&nbsp; <span className="ci-k">to:</span> {d.policy.to} Midnight</td></tr>
            <tr><td className="ci-k">Cover Note No:</td><td>NA</td></tr>
            <tr><td className="ci-k">Hypothecated to:</td><td>{d.policy.hypothecatedTo}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div className="ci-section-bar">VEHICLE DETAILS</div>
    <table className="ci-vehicle">
      <thead>
        <tr>
          <th>Registration Number</th>
          <th>Manufacturer</th>
          <th>Model</th>
          <th>Variant</th>
          <th>Year of Manufacture</th>
          <th>RTO Location</th>
          <th>Engine Number</th>
          <th>Vehicle Chassis / Trailer Chassis No.</th>
          <th>Cubic Capacity</th>
          <th>Seating Capacity</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{d.vehicle.regNo}</td>
          <td>{d.vehicle.manufacturer}</td>
          <td>{d.vehicle.model}</td>
          <td>{d.vehicle.variant}</td>
          <td>{d.vehicle.year}</td>
          <td>{d.vehicle.rto}</td>
          <td>{d.vehicle.engineNo}</td>
          <td>{d.vehicle.chassisNo}</td>
          <td>{d.vehicle.cubicCap}</td>
          <td>{d.vehicle.seatingCapacity}</td>
        </tr>
      </tbody>
    </table>
    <table className="ci-vehicle">
      <thead>
        <tr>
          <th>Insured Declared Value (IDV) of the Vehicle (in ₹)</th>
          <th>Non-Electrical Accessories fitted to the Vehicle (in ₹)</th>
          <th>Electrical &amp; Electronic Accessories fitted to the Vehicle (in ₹)</th>
          <th>Trailer (in ₹)</th>
          <th>CNG / LPG Kit (in ₹)</th>
          <th>Total Value of the Vehicle (in ₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{Number(d.vehicle.idv).toLocaleString("en-IN")}</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>{Number(d.vehicle.idv).toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
    </table>

    <div className="ci-section-bar">PREMIUM COMPUTATION TABLE (in ₹)</div>
    <div className="ci-premium-grid">
      <div className="ci-prem-half">
        <div className="ci-prem-title">Section I</div>
        <table className="ci-prem-table">
          <tbody>
            <tr><td>Own Damage</td><td></td></tr>
            <tr><td>Basic Own Damage</td><td className="ci-r">{formatINR(d.premium.basicOD)}</td></tr>
            <tr><td>Add</td><td></td></tr>
            <tr><td>Add on covers Total Premium</td><td className="ci-r">{formatINR(d.premium.addOnsTotal)}</td></tr>
            <tr><td>Less:</td><td></td></tr>
            <tr><td>Bonus Percent {d.premium.ncb}%</td><td className="ci-r">{formatINR(d.premium.ncbDiscount)}</td></tr>
            <tr><td>Pay as you drive DISCOUNT</td><td className="ci-r">0.00</td></tr>
            <tr className="ci-prem-total"><td>Total Own Damage Premium (A)</td><td className="ci-r">{formatINR(d.premium.totalODBeforeTax)}</td></tr>
            <tr><td colSpan={2} className="ci-prem-divider">Add on Covers Detail: Pay as you drive, Engine Protect, Consumable Cover, Depreciation Cover, Return to Invoice. For the covers opted as shown in Add On Covers Details Table.</td></tr>
            <tr><td>Geographical Area</td><td>INDIA</td></tr>
            <tr><td>Voluntary Deductible</td><td className="ci-r">0.00</td></tr>
            <tr><td>Taxable value of Services (A+B)</td><td className="ci-r">{formatINR(d.premium.totalTaxableA)}</td></tr>
            <tr><td>IGST @ 18%</td><td className="ci-r">{formatINR(d.premium.igstA)}</td></tr>
            <tr className="ci-prem-grand"><td>Total Premium (in ₹)</td><td className="ci-r">{formatINR(d.premium.totalODA + d.premium.totalLiability)}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="ci-prem-half">
        <div className="ci-prem-title">Section II</div>
        <table className="ci-prem-table">
          <tbody>
            <tr><td>Liability</td><td></td></tr>
            <tr><td>Basic TP including TPPD Premium</td><td className="ci-r">{formatINR(d.premium.basicTP)}</td></tr>
            <tr><td>PA Cover for Owner Driver ₹ 15,00,000.00</td><td className="ci-r">{formatINR(d.premium.paOD)}</td></tr>
            <tr><td>Unnamed PA Cover for Passenger ₹ 0.00/Per Person</td><td className="ci-r">0.00</td></tr>
            <tr><td>Legal Liability to Paid Driver</td><td className="ci-r">0.00</td></tr>
            <tr><td>Less:</td><td></td></tr>
            <tr className="ci-prem-total"><td>Total Liability Premium (B)</td><td className="ci-r">{formatINR(d.premium.totalLiability)}</td></tr>
            <tr><td>Additional Excess</td><td className="ci-r">0.00</td></tr>
            <tr><td>Compulsory Deductible</td><td className="ci-r">{Number(d.vehicle.cubicCap) > 1500 ? "2,000.00" : "1,000.00"}</td></tr>
            <tr><td>Voluntary Deductible for Depreciation Cover</td><td className="ci-r">0.00</td></tr>
            <tr className="ci-prem-total"><td>Total Deductible</td><td className="ci-r">{Number(d.vehicle.cubicCap) > 1500 ? "2,000.00" : "1,000.00"}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div className="ci-section-bar">INTERMEDIARY DETAILS</div>
    <table className="ci-kv ci-grid-table">
      <tbody>
        <tr>
          <td className="ci-k">Intermediary Code</td>
          <td>{d.intermediary.code}</td>
          <td className="ci-k">Intermediary Name</td>
          <td>{d.intermediary.name}</td>
        </tr>
        <tr>
          <td className="ci-k">Intermediary's Mobile No.</td>
          <td>{d.intermediary.mobile}</td>
          <td className="ci-k">Intermediary's Landline No.</td>
          <td>{d.intermediary.landline}</td>
        </tr>
      </tbody>
    </table>

    <div className="ci-section-bar">NOMINEE DETAILS</div>
    <table className="ci-vehicle">
      <thead>
        <tr>
          <th>*Nominee Name</th>
          <th>*Nominee age</th>
          <th>*Relationship</th>
          <th>*Name of Appointee (if nominee is a minor)</th>
          <th>Relationship to the Nominee</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{d.nominee.name}</td>
          <td>{d.nominee.age}</td>
          <td>{d.nominee.relation}</td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <Footer />
  </div>
);

const Page2 = ({ d }) => (
  <div className="ci-page">
    <Header d={d} />
    <div className="ci-section-bar">ADD-ON COVER DETAILS</div>
    <table className="ci-vehicle">
      <thead>
        <tr><th>Sr No.</th><th>Add-on Cover</th><th>Sum Insured (INR)</th><th>Premium</th><th>Remarks</th></tr>
      </thead>
      <tbody>
        {d.premium.addOnsCalc.map((a, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>{a.name}<br /><span className="ci-small">IRDAN152RP0006V04201516/A0001/V02201516</span></td>
            <td>-</td>
            <td className="ci-r">{formatINR(a.premium)}</td>
            <td></td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="ci-section-bar">DISCLAIMER</div>
    <p className="ci-para">For complete details on terms and conditions of the policy please read the Policy Wordings. This document is to be read with the policy wordings. Please refer to the claim form for necessary documents to be submitted for processing the claim.</p>
    <Footer />
  </div>
);

const Page3 = ({ d }) => (
  <div className="ci-page">
    <Header d={d} />
    <div className="ci-section-bar">LIMITS OF LIABILITY</div>
    <p className="ci-para">Under Section II - 1(i) of the policy -&gt; Death of or bodily injury: Such amounts is necessary to meet the requirements of Motor Vehicles Act, 1988.</p>
    <p className="ci-para">Under Section II - 1(ii) of the policy -&gt; Damage to Third Party Property : ₹ 7,50,000; PA Cover under Section III: for Owner Driver CSI ₹ 2,00,000.</p>

    <div className="ci-section-bar">LIMITATIONS AS TO USE</div>
    <p className="ci-para">The policy covers use of the vehicle for any purpose other than: Hire or reward; Carriage of goods (other than samples or personal luggage); organized racing; Pace making; speed testing; reliability trails or any purpose in connection with Motor Trade.</p>

    <div className="ci-section-bar">DRIVER'S CLAUSES</div>
    <p className="ci-para">Any person including the insured: Provided that a person driving hold an effective Driving License at the time of accident and is not disqualified from holding or obtaining such a license. Provided also that the person holding an effective Learners License may also drive the Vehicle and that such a person satisfies the requirements of Rule 3 of the Central Motor vehicles Rules 1989.</p>

    <div className="ci-section-bar">SPECIAL CONDITIONS</div>
    <p className="ci-para">Partial Theft of battery not covered.</p>

    <div className="ci-section-bar">NO CLAIM BONUS SCALE</div>
    <table className="ci-vehicle">
      <thead><tr><th>All types of vehicles</th><th>% of Discount on Own Damage Premium</th></tr></thead>
      <tbody>
        <tr><td>No claim made or pending during the preceding full year of insurance</td><td className="ci-r">20%</td></tr>
        <tr><td>No claim made or pending during the preceding 2 consecutive years of insurance</td><td className="ci-r">25%</td></tr>
        <tr><td>No claim made or pending during the preceding 3 consecutive years of insurance</td><td className="ci-r">35%</td></tr>
        <tr><td>No claim made or pending during the preceding 4 consecutive years of insurance</td><td className="ci-r">45%</td></tr>
        <tr><td>No claim made or pending during the preceding 5 consecutive years of insurance</td><td className="ci-r">50%</td></tr>
      </tbody>
    </table>

    <div className="ci-section-bar">IMPORTANT NOTICE</div>
    <p className="ci-para">The insured is not indemnified if the vehicle is used or driven otherwise than in accordance with this Schedule. Any payment made by the Company by reason of wider terms appearing in the Policy in order to comply with the Motor Vehicle Act, 1988 is recoverable from the Insured. See the clause headed "AVOIDANCE OF CERTAIN TERMS AND RIGHT OF RECOVERY". For legal interpretation, English version will hold good.</p>
    <p className="ci-para">Subject to I.M.T. End.Nos. &amp; Memorandum: Printed/herein/attached hereto Under Hire Purchase Agreement with NA</p>

    <div className="ci-section-bar">TAX DETAILS</div>
    <table className="ci-kv ci-grid-table">
      <tbody>
        <tr>
          <td className="ci-k">Service Tax/GST Registration No.</td><td>27AACK7000A1Z6</td>
          <td className="ci-k">Category</td><td>General Insurance Services</td>
        </tr>
        <tr>
          <td className="ci-k">SAC Code</td><td>997134</td>
          <td className="ci-k">Description</td><td>Motor vehicle insurance services</td>
        </tr>
      </tbody>
    </table>

    <div className="ci-section-bar">DECLARATION</div>
    <p className="ci-para">I/We hereby certify that the policy to which the certificate relates as well as the certificate of insurance are issued in accordance with the provision of chapter X, XI of M.V.Act 1988.</p>
    <p className="ci-para">In Witness whereof this Policy has been signed for and on behalf of Zurich Kotak General Insurance Company (India) Limited, 201-204, 301, 2nd &amp; 3rd Floor, Chintamani Classique, Vishweshwar Nagar, off Aarey road, Near, Udipi Vihar Hotel, Goregaon (E), Mumbai-400063 at Mumbai this 04 day of May of {(d.policy.from || "").split("-")[2] || ""}.</p>
    <p className="ci-para">For Zurich Kotak General Insurance Company (India) Limited</p>
    <img src={process.env.PUBLIC_URL + "/images/zurich-kotak-signature.png"} alt="" className="ci-signature" />
    <div>Authorised Signatory</div>
    <p className="ci-para">This document is digitally signed, hence counter signature / stamp is not required.</p>
    <Footer />
  </div>
);
