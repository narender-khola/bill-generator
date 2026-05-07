import React, { Component } from "react";
import "./CarRC.css";
import ReactGA from "react-ga4";
import { QRCodeSVG } from "qrcode.react";
import { getHistory, addToHistory } from "../utils/inputHistory";

const HISTORY_KEYS = {
  regNo: "rc_regNo",
  regnDate: "rc_regnDate",
  validityDate: "rc_validityDate",
  cardIssueDate: "rc_cardIssueDate",
  chassisNo: "rc_chassisNo",
  engineNo: "rc_engineNo",
  ownerName: "rc_ownerName",
  fatherName: "rc_fatherName",
  ownership: "rc_ownership",
  address: "rc_address",
  fuel: "rc_fuel",
  emissionNorms: "rc_emissionNorms",
  vehicleClass: "rc_vehicleClass",
  makerName: "rc_makerName",
  modelName: "rc_modelName",
  colour: "rc_colour",
  bodyType: "rc_bodyType",
  seatingCapacity: "rc_seatingCapacity",
  unladenWeight: "rc_unladenWeight",
  cubicCap: "rc_cubicCap",
  horsePower: "rc_horsePower",
  wheelBase: "rc_wheelBase",
  mfgYearMonth: "rc_mfgYearMonth",
  cylinders: "rc_cylinders",
  ownerSerial: "rc_ownerSerial",
  rto: "rc_rto",
  formNumber: "rc_formNumber",
};

const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);

const formatDDMMYYYY = (s) => {
  if (!s || !s.includes("-")) return s || "";
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
};

export default class CarRC extends Component {
  constructor(props) {
    super(props);
    this.state = {
      regNo: last("regNo", ""),
      regnDate: last("regnDate", ""),
      validityDate: last("validityDate", ""),
      cardIssueDate: last("cardIssueDate", ""),
      chassisNo: last("chassisNo", ""),
      engineNo: last("engineNo", ""),
      ownerName: last("ownerName", ""),
      fatherName: last("fatherName", ""),
      ownership: last("ownership", "INDIVIDUAL"),
      address: last("address", ""),
      fuel: last("fuel", "PETROL"),
      emissionNorms: last("emissionNorms", "BHARAT STAGE VI"),
      vehicleClass: last("vehicleClass", "MOTOR CAR (LMV)"),
      makerName: last("makerName", ""),
      modelName: last("modelName", ""),
      colour: last("colour", ""),
      bodyType: last("bodyType", "5 DOOR STEEL SHELL"),
      seatingCapacity: last("seatingCapacity", "5"),
      unladenWeight: last("unladenWeight", ""),
      cubicCap: last("cubicCap", "0.00"),
      horsePower: last("horsePower", ""),
      wheelBase: last("wheelBase", ""),
      mfgYearMonth: last("mfgYearMonth", ""),
      cylinders: last("cylinders", "0"),
      ownerSerial: last("ownerSerial", "1"),
      rto: last("rto", "JANAKPURI"),
      formNumber: last("formNumber", ""),
      pdfView: false,
    };
  }

  onChange = (e, id) => this.setState({ [id]: e.target.value });

  generate = () => {
    const s = this.state;
    if (!s.regNo.trim() || !s.ownerName.trim() || !s.regnDate || !s.validityDate) {
      alert("Registration number, owner name, registration date and validity date are required");
      return;
    }
    Object.entries(HISTORY_KEYS).forEach(([k]) => addToHistory(HISTORY_KEYS[k], s[k]));
    document.title = `Car RC - ${s.regNo.trim().toUpperCase()}`;
    this.setState({ pdfView: true });
    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({ category: "User Interaction", action: "Clicked a Button", label: "Generate Car RC" });
    }
  };

  render() {
    const s = this.state;
    if (s.pdfView) return this.renderCards();
    return this.renderForm();
  }

  renderForm() {
    const s = this.state;
    return (
      <div className="bg-card">
        <h2 className="bg-card-title">Car RC Generator (Delhi)</h2>
        <p className="bg-card-desc">Generate a Delhi Vehicle Registration Certificate (front + back) as a single printable card.</p>

        <h3 className="rc-section-title">Front Side</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Registration No <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" autoComplete="off" value={s.regNo} onChange={(e) => this.onChange(e, "regNo")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Date of Registration <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="date" value={s.regnDate} onChange={(e) => this.onChange(e, "regnDate")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Registration Validity <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="date" value={s.validityDate} onChange={(e) => this.onChange(e, "validityDate")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Owner Serial</label>
            <input className="bg-input" type="number" value={s.ownerSerial} onChange={(e) => this.onChange(e, "ownerSerial")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Card Issue Date</label>
            <input className="bg-input" type="date" value={s.cardIssueDate} onChange={(e) => this.onChange(e, "cardIssueDate")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Chassis Number</label>
            <input className="bg-input" type="text" value={s.chassisNo} onChange={(e) => this.onChange(e, "chassisNo")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Engine / Motor Number</label>
            <input className="bg-input" type="text" value={s.engineNo} onChange={(e) => this.onChange(e, "engineNo")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Owner Name <span className="bg-label-hint">required</span></label>
            <input className="bg-input" type="text" value={s.ownerName} onChange={(e) => this.onChange(e, "ownerName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Father / Husband Name</label>
            <input className="bg-input" type="text" value={s.fatherName} onChange={(e) => this.onChange(e, "fatherName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Ownership</label>
            <select className="bg-input" value={s.ownership} onChange={(e) => this.onChange(e, "ownership")}>
              <option>INDIVIDUAL</option>
              <option>COMPANY</option>
              <option>JOINT</option>
            </select>
          </div>
          <div className="bg-field">
            <label className="bg-label">Fuel</label>
            <select className="bg-input" value={s.fuel} onChange={(e) => this.onChange(e, "fuel")}>
              <option>PETROL</option>
              <option>DIESEL</option>
              <option>CNG</option>
              <option>PURE EV</option>
              <option>PETROL/CNG</option>
              <option>HYBRID</option>
            </select>
          </div>
          <div className="bg-field">
            <label className="bg-label">Emission Norms</label>
            <input className="bg-input" type="text" value={s.emissionNorms} onChange={(e) => this.onChange(e, "emissionNorms")} />
          </div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}>
            <label className="bg-label">Address</label>
            <textarea className="bg-input" rows={2} value={s.address} onChange={(e) => this.onChange(e, "address")} />
          </div>
        </div>

        <h3 className="rc-section-title">Back Side</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Vehicle Class</label>
            <input className="bg-input" type="text" value={s.vehicleClass} onChange={(e) => this.onChange(e, "vehicleClass")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Form Number (e.g. RA4437955)</label>
            <input className="bg-input" type="text" value={s.formNumber} onChange={(e) => this.onChange(e, "formNumber")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Maker's Name</label>
            <input className="bg-input" type="text" value={s.makerName} onChange={(e) => this.onChange(e, "makerName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Model Name</label>
            <input className="bg-input" type="text" value={s.modelName} onChange={(e) => this.onChange(e, "modelName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Colour</label>
            <input className="bg-input" type="text" value={s.colour} onChange={(e) => this.onChange(e, "colour")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Body Type</label>
            <input className="bg-input" type="text" value={s.bodyType} onChange={(e) => this.onChange(e, "bodyType")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Seating Capacity</label>
            <input className="bg-input" type="number" value={s.seatingCapacity} onChange={(e) => this.onChange(e, "seatingCapacity")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Unladen Weight (Kg)</label>
            <input className="bg-input" type="number" value={s.unladenWeight} onChange={(e) => this.onChange(e, "unladenWeight")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Cubic Capacity (cc)</label>
            <input className="bg-input" type="text" value={s.cubicCap} onChange={(e) => this.onChange(e, "cubicCap")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Horse Power (BHP/Kw)</label>
            <input className="bg-input" type="text" value={s.horsePower} onChange={(e) => this.onChange(e, "horsePower")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Wheel Base (mm)</label>
            <input className="bg-input" type="number" value={s.wheelBase} onChange={(e) => this.onChange(e, "wheelBase")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Month-Year of Mfg <span className="bg-label-hint">e.g. 11-2025</span></label>
            <input className="bg-input" type="text" value={s.mfgYearMonth} onChange={(e) => this.onChange(e, "mfgYearMonth")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">No. of Cylinders</label>
            <input className="bg-input" type="number" value={s.cylinders} onChange={(e) => this.onChange(e, "cylinders")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Registration Authority</label>
            <input className="bg-input" type="text" value={s.rto} onChange={(e) => this.onChange(e, "rto")} />
          </div>
        </div>

        <div className="bg-actions">
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.generate}>Generate Card</button>
        </div>

        <div className="bg-tips">
          <div className="bg-tips-title">Tips</div>
          <div>The output renders both sides of a Delhi RC card on a single A4 page suitable for printing.</div>
          <div>Use Cmd/Ctrl+P → Save as PDF for the final file.</div>
        </div>
      </div>
    );
  }

  renderCards() {
    const s = this.state;
    const regnDate = formatDDMMYYYY(s.regnDate);
    const validityDate = formatDDMMYYYY(s.validityDate);
    const cardIssueDate = formatDDMMYYYY(s.cardIssueDate);
    return (
      <>
        <div className="noprint bg-result-bar">
          <div className="bg-result-stats">
            <span className="bg-result-stat">RC No: <strong>{s.regNo.toUpperCase()}</strong></span>
          </div>
          <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">Generate More</button>
        </div>
        <div className="rc-page">
          <div className="rc-card rc-front">
            <div className="rc-header">
              <div className="rc-emblem" aria-hidden="true">
                <svg viewBox="0 0 40 40" width="38" height="38">
                  <circle cx="20" cy="20" r="18" fill="#ffffff" stroke="#1f2937" strokeWidth="0.6" />
                  <text x="20" y="14" textAnchor="middle" fontSize="6" fill="#1f2937" fontFamily="serif">अशोक</text>
                  <circle cx="20" cy="22" r="6" fill="none" stroke="#1f2937" strokeWidth="0.5" />
                  <g stroke="#1f2937" strokeWidth="0.5">
                    {Array.from({ length: 12 }, (_, i) => {
                      const a = (i * 30 * Math.PI) / 180;
                      return <line key={i} x1={20 + 4 * Math.cos(a)} y1={22 + 4 * Math.sin(a)} x2={20 + 6 * Math.cos(a)} y2={22 + 6 * Math.sin(a)} />;
                    })}
                  </g>
                  <text x="20" y="34" textAnchor="middle" fontSize="3" fill="#1f2937" fontFamily="serif">सत्यमेव जयते</text>
                </svg>
              </div>
              <div className="rc-header-title">
                <div className="rc-header-line">Indian Union Vehicle Registration Certificate</div>
                <div className="rc-header-line">Issued by Transport Department GNCT of Delhi</div>
              </div>
              <div className="rc-header-badges">
                <div className="rc-badge rc-nt">NT</div>
                <div className="rc-badge rc-dl">DL</div>
              </div>
            </div>

            <div className="rc-front-body">
              <div className="rc-row rc-row-3">
                <div className="rc-field"><div className="rc-label">Regn No</div><div className="rc-value rc-bold">{s.regNo.toUpperCase()}</div></div>
                <div className="rc-field"><div className="rc-label">Date of Regn.</div><div className="rc-value rc-bold">{regnDate}</div></div>
                <div className="rc-field"><div className="rc-label">Regn. Validity</div><div className="rc-value rc-bold">{validityDate}</div></div>
                <div className="rc-field"><div className="rc-label">Owner Serial</div><div className="rc-value rc-bold rc-circle">{s.ownerSerial}</div></div>
              </div>
              <div className="rc-field"><div className="rc-label">Chassis No</div><div className="rc-value rc-bold">{s.chassisNo.toUpperCase()}</div></div>
              <div className="rc-field"><div className="rc-label">Engine/Motor No</div><div className="rc-value rc-bold">{s.engineNo.toUpperCase()}</div></div>
              <div className="rc-field"><div className="rc-label">Owner Name</div><div className="rc-value rc-bold">{s.ownerName.toUpperCase()}</div></div>
              {s.fatherName ? (
                <div className="rc-field"><div className="rc-label">Son/Wife/Daughter of (In case of Individual Owner)</div><div className="rc-value rc-bold">{s.fatherName.toUpperCase()}</div></div>
              ) : null}
              <div className="rc-row rc-row-2">
                <div className="rc-field"><div className="rc-label">Ownership</div><div className="rc-value rc-bold">{s.ownership}</div></div>
                <div className="rc-field"><div className="rc-label">Fuel</div><div className="rc-value rc-bold">{s.fuel}</div></div>
              </div>
              <div className="rc-field"><div className="rc-label">Address</div><div className="rc-value rc-bold rc-address">{s.address.toUpperCase()}</div></div>
              <div className="rc-field"><div className="rc-label">Emission Norms</div><div className="rc-value rc-bold">{s.emissionNorms}</div></div>
            </div>

            <div className="rc-edge-text">Card Issue Date ({cardIssueDate})</div>
            <div className="rc-bg-pattern" aria-hidden="true"></div>
          </div>

          <div className="rc-card rc-back">
            <div className="rc-back-header">
              <div className="rc-back-badges">
                <div className="rc-badge rc-jt">JT</div>
                <div className="rc-badge rc-dl">DL</div>
              </div>
              <div className="rc-vehicle-class"><span>Vehicle Class:</span> {s.vehicleClass}</div>
              <div className="rc-form-no">{s.formNumber.toUpperCase()}</div>
            </div>

            <div className="rc-back-body">
              <div className="rc-back-left">
                <div className="rc-qr">
                  <QRCodeSVG value={`${s.regNo.toUpperCase()}|${s.chassisNo.toUpperCase()}|${s.engineNo.toUpperCase()}`} size={60} level="L" />
                </div>
                <div className="rc-back-meta">
                  <div className="rc-field"><div className="rc-label">Regn. Number</div><div className="rc-value rc-bold">{s.regNo.toUpperCase()}</div></div>
                  <div className="rc-field"><div className="rc-label">Month-Year of Mfg.</div><div className="rc-value rc-bold">{s.mfgYearMonth}</div></div>
                  <div className="rc-field"><div className="rc-label">No. of Cylinders</div><div className="rc-value rc-bold">{s.cylinders}</div></div>
                </div>
              </div>
              <div className="rc-back-right">
                <div className="rc-field"><div className="rc-label">Maker's Name:</div><div className="rc-value rc-bold">{s.makerName.toUpperCase()}</div></div>
                <div className="rc-field"><div className="rc-label">Model Name:</div><div className="rc-value rc-bold">{s.modelName.toUpperCase()}</div></div>
                <div className="rc-row rc-row-2">
                  <div className="rc-field"><div className="rc-label">Colour:</div><div className="rc-value rc-bold">{s.colour.toUpperCase()}</div></div>
                  <div className="rc-field"><div className="rc-label">/ Body Type:</div><div className="rc-value rc-bold">/ {s.bodyType}</div></div>
                </div>
                <div className="rc-field"><div className="rc-label">Seating(in all)  Capacity</div><div className="rc-value rc-bold">{s.seatingCapacity}</div></div>
                <div className="rc-field"><div className="rc-label">Unladen Weight (Kg)</div><div className="rc-value rc-bold">{s.unladenWeight}</div></div>
                <div className="rc-field">
                  <div className="rc-label">Cubic Cap. / Horse Power (BHP/Kw) Wheel Base(mm)</div>
                  <div className="rc-value rc-bold">{s.cubicCap}      / {s.horsePower}      {s.wheelBase}</div>
                </div>
                <div className="rc-form-25a">Form 25-A</div>
                <div className="rc-back-authority">
                  <div>Registration Authority</div>
                  <div className="rc-bold">{s.rto}</div>
                </div>
              </div>
            </div>
            <div className="rc-bg-pattern" aria-hidden="true"></div>
          </div>
        </div>
      </>
    );
  }
}
