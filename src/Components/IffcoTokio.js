import React, { Component } from "react";
import "./IffcoTokio.css";
import ReactGA from "react-ga4";
import { QRCodeSVG } from "qrcode.react";
import { getHistory, addToHistory } from "../utils/inputHistory";

const HISTORY_KEYS = {
  policyNo: "it_policyNo", proposalNo: "it_proposalNo",
  insuredName: "it_insuredName", insuredAddress: "it_insuredAddress",
  policyIssuedOn: "it_policyIssuedOn",
  odFromDate: "it_odFromDate", odToDate: "it_odToDate",
  liabFromDate: "it_liabFromDate", liabToDate: "it_liabToDate",
  cpaFromDate: "it_cpaFromDate", cpaToDate: "it_cpaToDate",
  prevInsurer: "it_prevInsurer", prevPolicyNo: "it_prevPolicyNo",
  brokerName: "it_brokerName", brokerLic: "it_brokerLic", brokerCIN: "it_brokerCIN",
  brokerCategory: "it_brokerCategory", brokerValidity: "it_brokerValidity",
  make: "it_make", model: "it_model", variant: "it_variant", killowatt: "it_killowatt",
  mfgYear: "it_mfgYear", seatingCap: "it_seatingCap", bodyType: "it_bodyType",
  regNo: "it_regNo", rto: "it_rto", invoiceDate: "it_invoiceDate",
  engineNo: "it_engineNo", chassisNo: "it_chassisNo",
  vehicleIDV: "it_vehicleIDV",
  nomineeName: "it_nomineeName", nomineeAge: "it_nomineeAge", nomineeRel: "it_nomineeRel",
  premiumPaid: "it_premiumPaid", chequeNo: "it_chequeNo", chequeDate: "it_chequeDate",
  bankName: "it_bankName",
  basicVehiclePremium: "it_basicVehiclePremium", addOnTotal: "it_addOnTotal",
  basicTPLiability: "it_basicTPLiability", paOwnerDriver: "it_paOwnerDriver",
  legalDriver: "it_legalDriver",
  dealerCode: "it_dealerCode",
  exShowroomPrice: "it_exShowroomPrice",
  addOns: "it_addOns",
};

const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);

const formatDDMMMYYYY = (s) => {
  if (!s || !s.includes("-")) return s || "";
  const [y, m, d] = s.split("-");
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${d}-${months[parseInt(m, 10) - 1]}-${y}`;
};

const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

export default class IffcoTokio extends Component {
  constructor(props) {
    super(props);
    let savedAddOns = null;
    try { const raw = last("addOns", null); if (raw) savedAddOns = JSON.parse(raw); } catch {}

    this.state = {
      policyNo: last("policyNo", ""),
      proposalNo: last("proposalNo", ""),
      insuredName: last("insuredName", ""),
      insuredAddress: last("insuredAddress", ""),
      policyIssuedOn: last("policyIssuedOn", ""),
      odFromDate: last("odFromDate", ""),
      odToDate: last("odToDate", ""),
      liabFromDate: last("liabFromDate", ""),
      liabToDate: last("liabToDate", ""),
      cpaFromDate: last("cpaFromDate", ""),
      cpaToDate: last("cpaToDate", ""),
      prevInsurer: last("prevInsurer", "NA"),
      prevPolicyNo: last("prevPolicyNo", "NA"),
      brokerName: last("brokerName", "TATA MOTORS INSURANCE BROKING AND ADVISORY SERVICES LTD, 1ST FLOOR, AFL HOUSE, LOK BHARTI COMPLEX, MAROL MAROSH ROAD, ANDHERI (EAST), MUMBAI - 400 059"),
      brokerLic: last("brokerLic", "375"),
      brokerCIN: last("brokerCIN", "U50300MH1997PLC149349"),
      brokerCategory: last("brokerCategory", "Composite Broker"),
      brokerValidity: last("brokerValidity", "13-MAY-23 To 12-MAY-26"),
      make: last("make", ""),
      model: last("model", ""),
      variant: last("variant", ""),
      killowatt: last("killowatt", ""),
      mfgYear: last("mfgYear", ""),
      seatingCap: last("seatingCap", "5"),
      bodyType: last("bodyType", "SUV"),
      regNo: last("regNo", ""),
      rto: last("rto", "DELHI"),
      invoiceDate: last("invoiceDate", ""),
      engineNo: last("engineNo", ""),
      chassisNo: last("chassisNo", ""),
      vehicleIDV: last("vehicleIDV", ""),
      nomineeName: last("nomineeName", ""),
      nomineeAge: last("nomineeAge", ""),
      nomineeRel: last("nomineeRel", "SPOUSE"),
      premiumPaid: last("premiumPaid", ""),
      chequeNo: last("chequeNo", ""),
      chequeDate: last("chequeDate", ""),
      bankName: last("bankName", ""),
      basicVehiclePremium: last("basicVehiclePremium", ""),
      basicTPLiability: last("basicTPLiability", ""),
      paOwnerDriver: last("paOwnerDriver", "620"),
      legalDriver: last("legalDriver", "150"),
      dealerCode: last("dealerCode", ""),
      exShowroomPrice: last("exShowroomPrice", ""),
      addOns: savedAddOns || [
        { name: "Key Replacements", uin: "IRDAN152RP0012V03201920/A0021V01201920", premium: "" },
        { name: "Nil Depreciation", uin: "IRDAN152RP0012V03201920/A0014V01201920", premium: "" },
        { name: "Consumables", uin: "IRDAN152RP0012V03201920/A0015V01201920", premium: "" },
        { name: "CHARGER PROTECTION", uin: "IRDAN106RP0010V01201819/A0031V01202526", premium: "" },
        { name: "Return To Invoice", uin: "IRDAN152RP0012V03201920/A0017V01201920", premium: "" },
        { name: "BATTERY COVER", uin: "IRDAN106RP0010V01201819/A0028V01202526", premium: "" },
        { name: "Road Side Assistance", uin: "", premium: "" },
      ],
      pdfView: false,
      output: null,
    };
  }

  onChange = (e, id) => this.setState({ [id]: e.target.value });
  updateAddOn = (idx, field, value) => this.setState((s) => ({ addOns: s.addOns.map((a, i) => i === idx ? { ...a, [field]: value } : a) }));
  addAddOn = () => this.setState((s) => ({ addOns: [...s.addOns, { name: "", uin: "", premium: "" }] }));
  removeAddOn = (idx) => this.setState((s) => ({ addOns: s.addOns.filter((_, i) => i !== idx) }));

  generate = () => {
    const s = this.state;
    if (!s.policyNo.trim() || !s.insuredName.trim() || !s.regNo.trim() || !s.odFromDate || !s.odToDate) {
      alert("Policy No, Insured Name, Registration No and Own Damage period are required");
      return;
    }
    const idv = parseFloat(s.vehicleIDV) || 0;
    const basicVeh = parseFloat(s.basicVehiclePremium) || 0;
    const basicTP = parseFloat(s.basicTPLiability) || 0;
    const paOD = parseFloat(s.paOwnerDriver) || 0;
    const legalDr = parseFloat(s.legalDriver) || 0;

    const addOnsCalc = s.addOns.filter((a) => a.name.trim()).map((a) => ({
      name: a.name.trim(), uin: a.uin.trim(), premium: parseFloat(a.premium) || 0,
    }));
    const addOnTotal = addOnsCalc.reduce((sum, a) => sum + a.premium, 0);

    const subTotalBasic = basicVeh;
    const subTotalAdd = addOnTotal;
    const netOD = +(subTotalBasic + subTotalAdd).toFixed(2);
    const netLiab = +(basicTP + paOD + legalDr).toFixed(2);
    const totalAB = +(netOD + netLiab).toFixed(2);
    const cgst = +(totalAB * 0.09).toFixed(0);
    const sgst = +(totalAB * 0.09).toFixed(0);
    const gross = totalAB + cgst + sgst;

    Object.entries(HISTORY_KEYS).forEach(([k]) => {
      if (k === "addOns") return;
      addToHistory(HISTORY_KEYS[k], s[k]);
    });
    try { addToHistory(HISTORY_KEYS.addOns, JSON.stringify(s.addOns)); } catch {}

    document.title = `Iffco Tokio - ${s.regNo.trim().toUpperCase()} - ${formatDDMMMYYYY(s.odFromDate)}`;

    this.setState({
      pdfView: true,
      output: {
        policyNo: s.policyNo.trim(),
        proposalNo: s.proposalNo.trim(),
        insured: {
          name: s.insuredName.trim().toUpperCase(),
          address: s.insuredAddress.trim().toUpperCase(),
        },
        policyIssuedOn: s.policyIssuedOn ? formatDDMMMYYYY(s.policyIssuedOn) + " (13:08)" : "",
        odPeriod: `${formatDDMMMYYYY(s.odFromDate)}(13:08) To ${formatDDMMMYYYY(s.odToDate)}(Midnight)`,
        liabPeriod: `${formatDDMMMYYYY(s.liabFromDate || s.odFromDate)}(13:08) To ${formatDDMMMYYYY(s.liabToDate || s.odToDate)}(Midnight)`,
        cpaPeriod: s.cpaFromDate ? `${formatDDMMMYYYY(s.cpaFromDate)}(13:08) To ${formatDDMMMYYYY(s.cpaToDate)}(Midnight)` : "",
        proposalDate: s.proposalNo ? `${s.proposalNo.trim()}, ${formatDDMMMYYYY(s.policyIssuedOn || s.odFromDate)}` : "",
        prevInsurer: s.prevInsurer.trim(),
        prevPolicyNo: s.prevPolicyNo.trim(),
        broker: {
          name: s.brokerName.trim(),
          lic: s.brokerLic.trim(),
          cin: s.brokerCIN.trim(),
          category: s.brokerCategory.trim(),
          validity: s.brokerValidity.trim(),
        },
        vehicle: {
          make: s.make.trim().toUpperCase(),
          model: s.model.trim().toUpperCase(),
          variant: s.variant.trim().toUpperCase(),
          killowatt: s.killowatt.trim(),
          mfgYear: s.mfgYear.trim(),
          seating: s.seatingCap.trim(),
          bodyType: s.bodyType.trim().toUpperCase(),
          regNo: s.regNo.trim().toUpperCase(),
          rto: s.rto.trim().toUpperCase(),
          invoiceDate: formatDDMMMYYYY(s.invoiceDate),
          engineNo: s.engineNo.trim().toUpperCase(),
          chassisNo: s.chassisNo.trim().toUpperCase(),
          idv,
        },
        nominee: {
          name: s.nomineeName.trim().toUpperCase(),
          age: s.nomineeAge.trim(),
          rel: s.nomineeRel,
        },
        payment: {
          premiumPaid: parseFloat(s.premiumPaid) || gross,
          chequeNo: s.chequeNo.trim(),
          chequeDate: formatDDMMMYYYY(s.chequeDate),
          bankName: s.bankName.trim(),
        },
        premium: {
          basicVeh, addOnTotal, subTotalBasic, subTotalAdd,
          netOD, basicTP, paOD, legalDr, netLiab,
          totalAB, cgst, sgst, gross, addOnsCalc,
        },
        dealerCode: s.dealerCode.trim(),
        exShowroomPrice: s.exShowroomPrice.trim(),
      },
    });

    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({ category: "User Interaction", action: "Clicked a Button", label: "Generate Iffco Tokio Policy" });
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
        <h2 className="bg-card-title">Car Insurance Generator (IFFCO Tokio)</h2>
        <p className="bg-card-desc">Generate a Bundled Cover (1 yr OD + 3 yr TP) Private Cars Certificate cum Policy Schedule.</p>

        <h3 className="ci-section-title">Policy</h3>
        <div className="bg-grid">
          <div className="bg-field"><label className="bg-label">Policy No <span className="bg-label-hint">required</span></label><input className="bg-input" type="text" value={s.policyNo} onChange={(e) => this.onChange(e, "policyNo")} /></div>
          <div className="bg-field"><label className="bg-label">Proposal No</label><input className="bg-input" type="text" value={s.proposalNo} onChange={(e) => this.onChange(e, "proposalNo")} /></div>
          <div className="bg-field"><label className="bg-label">Policy Issued On</label><input className="bg-input" type="date" value={s.policyIssuedOn} onChange={(e) => this.onChange(e, "policyIssuedOn")} /></div>
          <div className="bg-field"><label className="bg-label">Own Damage From <span className="bg-label-hint">required</span></label><input className="bg-input" type="date" value={s.odFromDate} onChange={(e) => this.onChange(e, "odFromDate")} /></div>
          <div className="bg-field"><label className="bg-label">Own Damage To <span className="bg-label-hint">required</span></label><input className="bg-input" type="date" value={s.odToDate} onChange={(e) => this.onChange(e, "odToDate")} /></div>
          <div className="bg-field"><label className="bg-label">Motor Liability From <span className="bg-label-hint">3 yr cover</span></label><input className="bg-input" type="date" value={s.liabFromDate} onChange={(e) => this.onChange(e, "liabFromDate")} /></div>
          <div className="bg-field"><label className="bg-label">Motor Liability To</label><input className="bg-input" type="date" value={s.liabToDate} onChange={(e) => this.onChange(e, "liabToDate")} /></div>
          <div className="bg-field"><label className="bg-label">CPA Cover From</label><input className="bg-input" type="date" value={s.cpaFromDate} onChange={(e) => this.onChange(e, "cpaFromDate")} /></div>
          <div className="bg-field"><label className="bg-label">CPA Cover To</label><input className="bg-input" type="date" value={s.cpaToDate} onChange={(e) => this.onChange(e, "cpaToDate")} /></div>
          <div className="bg-field"><label className="bg-label">Previous Insurer</label><input className="bg-input" type="text" value={s.prevInsurer} onChange={(e) => this.onChange(e, "prevInsurer")} /></div>
          <div className="bg-field"><label className="bg-label">Previous Policy No</label><input className="bg-input" type="text" value={s.prevPolicyNo} onChange={(e) => this.onChange(e, "prevPolicyNo")} /></div>
        </div>

        <h3 className="ci-section-title">Insured</h3>
        <div className="bg-grid">
          <div className="bg-field"><label className="bg-label">Name <span className="bg-label-hint">required</span></label><input className="bg-input" type="text" value={s.insuredName} onChange={(e) => this.onChange(e, "insuredName")} /></div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}><label className="bg-label">Address</label><textarea className="bg-input" rows={2} value={s.insuredAddress} onChange={(e) => this.onChange(e, "insuredAddress")} /></div>
        </div>

        <h3 className="ci-section-title">Broker</h3>
        <div className="bg-grid">
          <div className="bg-field"><label className="bg-label">IRDA Lic No</label><input className="bg-input" type="text" value={s.brokerLic} onChange={(e) => this.onChange(e, "brokerLic")} /></div>
          <div className="bg-field"><label className="bg-label">CIN No</label><input className="bg-input" type="text" value={s.brokerCIN} onChange={(e) => this.onChange(e, "brokerCIN")} /></div>
          <div className="bg-field"><label className="bg-label">Broker Category</label><input className="bg-input" type="text" value={s.brokerCategory} onChange={(e) => this.onChange(e, "brokerCategory")} /></div>
          <div className="bg-field"><label className="bg-label">Validity</label><input className="bg-input" type="text" value={s.brokerValidity} onChange={(e) => this.onChange(e, "brokerValidity")} /></div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}><label className="bg-label">Name &amp; Address</label><textarea className="bg-input" rows={2} value={s.brokerName} onChange={(e) => this.onChange(e, "brokerName")} /></div>
        </div>

        <h3 className="ci-section-title">Vehicle</h3>
        <div className="bg-grid">
          <div className="bg-field"><label className="bg-label">Make</label><input className="bg-input" type="text" value={s.make} onChange={(e) => this.onChange(e, "make")} /></div>
          <div className="bg-field"><label className="bg-label">Model</label><input className="bg-input" type="text" value={s.model} onChange={(e) => this.onChange(e, "model")} /></div>
          <div className="bg-field"><label className="bg-label">Variant</label><input className="bg-input" type="text" value={s.variant} onChange={(e) => this.onChange(e, "variant")} /></div>
          <div className="bg-field"><label className="bg-label">Killowatt</label><input className="bg-input" type="text" value={s.killowatt} onChange={(e) => this.onChange(e, "killowatt")} /></div>
          <div className="bg-field"><label className="bg-label">Manufacturing Year</label><input className="bg-input" type="number" value={s.mfgYear} onChange={(e) => this.onChange(e, "mfgYear")} /></div>
          <div className="bg-field"><label className="bg-label">Seating Capacity</label><input className="bg-input" type="number" value={s.seatingCap} onChange={(e) => this.onChange(e, "seatingCap")} /></div>
          <div className="bg-field"><label className="bg-label">Body Type</label><input className="bg-input" type="text" value={s.bodyType} onChange={(e) => this.onChange(e, "bodyType")} /></div>
          <div className="bg-field"><label className="bg-label">Registration No <span className="bg-label-hint">required</span></label><input className="bg-input" type="text" value={s.regNo} onChange={(e) => this.onChange(e, "regNo")} /></div>
          <div className="bg-field"><label className="bg-label">RTO</label><input className="bg-input" type="text" value={s.rto} onChange={(e) => this.onChange(e, "rto")} /></div>
          <div className="bg-field"><label className="bg-label">Invoice Date</label><input className="bg-input" type="date" value={s.invoiceDate} onChange={(e) => this.onChange(e, "invoiceDate")} /></div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}><label className="bg-label">Engine / Motor No</label><input className="bg-input" type="text" value={s.engineNo} onChange={(e) => this.onChange(e, "engineNo")} /></div>
          <div className="bg-field" style={{ gridColumn: "1 / -1" }}><label className="bg-label">Chassis No</label><input className="bg-input" type="text" value={s.chassisNo} onChange={(e) => this.onChange(e, "chassisNo")} /></div>
          <div className="bg-field"><label className="bg-label">Vehicle IDV (Rs.)</label><input className="bg-input" type="number" value={s.vehicleIDV} onChange={(e) => this.onChange(e, "vehicleIDV")} /></div>
          <div className="bg-field"><label className="bg-label">Ex-Showroom Price (Rs.)</label><input className="bg-input" type="number" value={s.exShowroomPrice} onChange={(e) => this.onChange(e, "exShowroomPrice")} /></div>
          <div className="bg-field"><label className="bg-label">Dealer Code</label><input className="bg-input" type="text" value={s.dealerCode} onChange={(e) => this.onChange(e, "dealerCode")} /></div>
        </div>

        <h3 className="ci-section-title">Nominee</h3>
        <div className="bg-grid">
          <div className="bg-field"><label className="bg-label">Name</label><input className="bg-input" type="text" value={s.nomineeName} onChange={(e) => this.onChange(e, "nomineeName")} /></div>
          <div className="bg-field"><label className="bg-label">Age</label><input className="bg-input" type="number" value={s.nomineeAge} onChange={(e) => this.onChange(e, "nomineeAge")} /></div>
          <div className="bg-field"><label className="bg-label">Relationship</label><select className="bg-input" value={s.nomineeRel} onChange={(e) => this.onChange(e, "nomineeRel")}>
            <option>SPOUSE</option><option>SON</option><option>DAUGHTER</option><option>FATHER</option><option>MOTHER</option><option>BROTHER</option><option>SISTER</option>
          </select></div>
        </div>

        <h3 className="ci-section-title">Premium</h3>
        <div className="bg-grid">
          <div className="bg-field"><label className="bg-label">Basic Vehicle Own Damage Premium (Rs.)</label><input className="bg-input" type="number" step="0.01" value={s.basicVehiclePremium} onChange={(e) => this.onChange(e, "basicVehiclePremium")} /></div>
          <div className="bg-field"><label className="bg-label">Basic Third Party Liability (Rs.)</label><input className="bg-input" type="number" step="0.01" value={s.basicTPLiability} onChange={(e) => this.onChange(e, "basicTPLiability")} /></div>
          <div className="bg-field"><label className="bg-label">PA Cover for Owner Driver (Rs.)</label><input className="bg-input" type="number" step="0.01" value={s.paOwnerDriver} onChange={(e) => this.onChange(e, "paOwnerDriver")} /></div>
          <div className="bg-field"><label className="bg-label">Legal Liability For Paid Driver (Rs.)</label><input className="bg-input" type="number" step="0.01" value={s.legalDriver} onChange={(e) => this.onChange(e, "legalDriver")} /></div>
        </div>

        <h3 className="ci-section-title">Add-On Covers</h3>
        <div className="mi-members">
          <div className="mi-members-header">
            <button type="button" className="bg-btn bg-btn-secondary" onClick={this.addAddOn}>+ Add Cover</button>
          </div>
          {s.addOns.map((a, idx) => (
            <div key={idx} className="mi-member-row">
              <div className="it-addon-grid">
                <div className="bg-field"><label className="bg-label">Name</label><input className="bg-input" type="text" value={a.name} onChange={(e) => this.updateAddOn(idx, "name", e.target.value)} /></div>
                <div className="bg-field"><label className="bg-label">UIN</label><input className="bg-input" type="text" value={a.uin} onChange={(e) => this.updateAddOn(idx, "uin", e.target.value)} /></div>
                <div className="bg-field"><label className="bg-label">Premium (Rs.)</label><input className="bg-input" type="number" step="0.01" value={a.premium} onChange={(e) => this.updateAddOn(idx, "premium", e.target.value)} /></div>
              </div>
              {s.addOns.length > 1 ? <button type="button" className="mi-remove-btn" onClick={() => this.removeAddOn(idx)}>×</button> : null}
            </div>
          ))}
        </div>

        <h3 className="ci-section-title">Payment</h3>
        <div className="bg-grid">
          <div className="bg-field"><label className="bg-label">Premium Paid <span className="bg-label-hint">leave blank to auto-calc</span></label><input className="bg-input" type="number" value={s.premiumPaid} onChange={(e) => this.onChange(e, "premiumPaid")} /></div>
          <div className="bg-field"><label className="bg-label">Cheque No</label><input className="bg-input" type="text" value={s.chequeNo} onChange={(e) => this.onChange(e, "chequeNo")} /></div>
          <div className="bg-field"><label className="bg-label">Cheque Date</label><input className="bg-input" type="date" value={s.chequeDate} onChange={(e) => this.onChange(e, "chequeDate")} /></div>
          <div className="bg-field"><label className="bg-label">Bank Name</label><input className="bg-input" type="text" value={s.bankName} onChange={(e) => this.onChange(e, "bankName")} /></div>
        </div>

        <div className="bg-actions">
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.generate}>Generate Policy</button>
        </div>

        <div className="bg-tips">
          <div className="bg-tips-title">Tips</div>
          <div>9% CGST + 9% SGST is auto-calculated on Total Premium (A+B).</div>
          <div>Bundled cover: 1-year Own Damage + 3-year Motor Third Party. Set both periods accordingly.</div>
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
            <span className="bg-result-stat">Policy: <strong>{d.policyNo}</strong></span>
            <span className="bg-result-stat">Gross Premium: <strong>Rs. {d.premium.gross.toLocaleString("en-IN")}</strong></span>
          </div>
          <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">Generate More</button>
        </div>
        <ItPage1 d={d} />
        <ItPage2 d={d} />
        <ItPage3 d={d} />
      </>
    );
  }
}

const ItHeader = ({ d }) => (
  <>
    <div className="it-top-row">
      <img src={process.env.PUBLIC_URL + "/images/iffco-tokio-logo.png"} alt="IFFCO TOKIO" className="it-logo" />
      <div className="it-company-info">
        <div className="it-company-name">IFFCO Tokio General Insurance Co. Ltd.</div>
        <div><strong>Servicing Office of Insurer :</strong> 705, 7TH FLOOR,KAILASH BUILDING, 26, K.G. MARG,CONNAUGHT PLACE, New Delhi, Delhi (State Code:07) -110001, PH-0124-2850100</div>
        <div><strong>Website :</strong> www.iffcotokio.co.in</div>
        <div><strong>PAN :</strong> AAACI7573H . <strong>GSTIN:</strong> 07AAACI7573H1ZE <strong>Insurer's IRDA Registration Number:</strong> 106</div>
        <div><strong>Tollfree Helpline :</strong> 1800 103 5499 <strong>Email:</strong> support@iffcotokio.co.in <strong>CIN :</strong> U74899DL2000PLC107621</div>
      </div>
      <div className="it-qr">
        <QRCodeSVG value={d.policyNo} size={70} level="L" />
      </div>
    </div>

    <div className="it-banner">
      BUNDLED COVER WITH ONE YEAR TERM FOR OWN DAMAGE AND THREE YEARS MOTOR THIRD PARTY INSURANCE POLICY FOR PRIVATE CARS-CERTFICATE CUM POLICY SCHEDULE (UIN-IRDAN106RP0010V01201819) CUM RECEIPT
    </div>
    <div className="it-banner-sub">(FORM 51 OF THE CENTRAL MOTOR VEHICLE RULES, 1989)</div>

    <table className="it-policy-meta">
      <tbody>
        <tr>
          <td className="it-k">Policy No.</td><td>: {d.policyNo}</td>
          <td className="it-k">Policy Issued On</td><td>: {d.policyIssuedOn}</td>
        </tr>
        <tr>
          <td className="it-k">Insured Name</td><td>: MR.&nbsp;&nbsp;{d.insured.name} .</td>
          <td colSpan={2}></td>
        </tr>
        <tr>
          <td className="it-k">Own Damage Period</td><td>: {d.odPeriod}</td>
          <td className="it-k">Motor Liability Period</td><td>: {d.liabPeriod}</td>
        </tr>
      </tbody>
    </table>
  </>
);

const ItFooter = ({ d }) => (
  <div className="it-bottom-block">
    <div className="it-dealer-line">
      <div>{d.dealerCode ? `Dealer Code : ${d.dealerCode}` : ""}</div>
      <div className="it-r"><strong>For &amp; On Behalf of IFFCO Tokio General Insurance Co. Ltd.</strong></div>
    </div>
    <div className="it-sig-row">
      <div></div>
      <div className="it-sig-block">
        <img src={process.env.PUBLIC_URL + "/images/iffco-tokio-signature.png"} alt="" className="it-sig-img" />
        <div className="it-sig-label">Authorized Signatory</div>
      </div>
    </div>
    <div className="it-help-line">
      In case of any claim or assistance required please contact our help line at <strong>1800 209 0060</strong> and you may also reach us at <strong>support@tmibasl.com</strong>
    </div>
  </div>
);

const ItPage1 = ({ d }) => (
  <div className="it-page">
    <ItHeader d={d} />

    <table className="it-meta-grid">
      <tbody>
        <tr>
          <td className="it-k">Proposal No. &amp; Date</td>
          <td>: {d.proposalDate}</td>
          <td className="it-k">CPA Cover Period</td>
          <td>: {d.cpaPeriod}</td>
        </tr>
        <tr>
          <td className="it-k">Insured Add.</td>
          <td>: {d.insured.address}</td>
          <td className="it-k">Previous Insurer</td>
          <td>: {d.prevInsurer}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td className="it-k">Previous Policy No.</td>
          <td>: {d.prevPolicyNo}</td>
        </tr>
      </tbody>
    </table>

    <div className="it-section-title">BROKER DETAILS</div>
    <table className="it-meta-grid">
      <tbody>
        <tr>
          <td className="it-k">IRDA Lic. No.</td><td>{d.broker.lic}</td>
          <td className="it-k">CIN No.</td><td>{d.broker.cin}</td>
        </tr>
        <tr>
          <td className="it-k">Broker Category</td><td>{d.broker.category}</td>
          <td className="it-k">Validity</td><td>{d.broker.validity}</td>
        </tr>
        <tr>
          <td className="it-k">Name &amp; Add.</td>
          <td colSpan={3}>{d.broker.name}</td>
        </tr>
      </tbody>
    </table>

    <table className="it-vehicle-table">
      <thead>
        <tr><th>Make</th><th>Model</th><th>Variant</th><th>Killowatt</th><th>Manufacturing Year</th><th>Seating capacity</th></tr>
      </thead>
      <tbody>
        <tr><td>{d.vehicle.make}</td><td>{d.vehicle.model}</td><td>{d.vehicle.variant}</td><td>{d.vehicle.killowatt}</td><td>{d.vehicle.mfgYear}</td><td>{d.vehicle.seating}</td></tr>
      </tbody>
      <thead>
        <tr><th>Body Type</th><th>Registration No.</th><th>RTO</th><th>Invoice Date</th><th>Engine/Motor No.</th><th>Chassis No.</th></tr>
      </thead>
      <tbody>
        <tr><td>{d.vehicle.bodyType}</td><td>{d.vehicle.regNo}</td><td>{d.vehicle.rto}</td><td>{d.vehicle.invoiceDate}</td><td>{d.vehicle.engineNo}</td><td>{d.vehicle.chassisNo}</td></tr>
      </tbody>
      <thead>
        <tr><th>Vehicle IDV</th><th>CNG/LPG Kit</th><th>Elec. Accessories</th><th>Non-Elec. Accessories</th><th colSpan={2}>Total IDV</th></tr>
      </thead>
      <tbody>
        <tr><td>{fmt(d.vehicle.idv)}</td><td>0</td><td>0</td><td>0</td><td colSpan={2}>{fmt(d.vehicle.idv)}</td></tr>
      </tbody>
    </table>

    <div className="it-section-title">NOMINEE DETAILS</div>
    <table className="it-vehicle-table">
      <thead><tr><th>Name of Nominee</th><th>Age</th><th>Relationship with Insured</th><th>Name of Appointee</th><th>Relationship with Nominee</th></tr></thead>
      <tbody><tr><td>{d.nominee.name}</td><td>{d.nominee.age}</td><td>{d.nominee.rel}</td><td>--N.A--</td><td>--N.A--</td></tr></tbody>
    </table>

    <div className="it-section-title">PAYMENT DETAILS</div>
    <table className="it-meta-grid">
      <tbody>
        <tr>
          <td className="it-k">Premium Paid :</td><td>{fmt(d.payment.premiumPaid)}</td>
          <td className="it-k">Cheque No. :</td><td>{d.payment.chequeNo}</td>
          <td className="it-k">Cheque Date:</td><td>{d.payment.chequeDate}</td>
        </tr>
        <tr>
          <td className="it-k">Bank Name :</td><td colSpan={3}>{d.payment.bankName}</td>
          <td className="it-k">Bank City :</td><td></td>
        </tr>
      </tbody>
    </table>

    <ItFooter d={d} />
  </div>
);

const ItPage2 = ({ d }) => (
  <div className="it-page">
    <ItHeader d={d} />
    <div className="it-page-title">SCHEDULE OF PREMIUM (AMOUNT IN RS.)</div>
    <table className="it-prem-table">
      <thead>
        <tr><th colSpan={2} className="it-prem-section">Own Damage Premium (A)</th></tr>
      </thead>
      <tbody>
        <tr><td colSpan={2} className="it-prem-sub-l"><strong>Basic Premium</strong>{"  "}<span className="it-r-inline"><strong>Deductibles</strong></span></td></tr>
        <tr><td>Vehicle</td><td className="it-r">{fmt(d.premium.basicVeh)}</td></tr>
        <tr><td>Non-Elec. Accessories <span className="it-r-side">Voluntary Deductibles (0) (IMT-22A) &nbsp;&nbsp; 0</span></td><td className="it-r">0</td></tr>
        <tr><td>Elec. Accessories (IMT-24) <span className="it-r-side">Anti Theft Device (IMT-10) &nbsp;&nbsp; 0</span></td><td className="it-r">0</td></tr>
        <tr><td>CNG/LPG Kit (IMT-25) <span className="it-r-side">AA Membership (IMT-8) &nbsp;&nbsp; 0</span></td><td className="it-r">0</td></tr>
        <tr><td><strong>Sub Total (Basic Premium)</strong> <span className="it-r-side">No Claim Bonus (0%) &nbsp;&nbsp; 0</span></td><td className="it-r"><strong>{fmt(d.premium.subTotalBasic)}</strong></td></tr>
        <tr><td>Geographical Area Extension (IMT-1) <span className="it-r-side">Handicapped Discount (0%) &nbsp;&nbsp; 0</span></td><td className="it-r">0</td></tr>
        <tr><td>IMT 23 Premium <span className="it-r-side"><strong>Sub Total (Deductibles)</strong> &nbsp;&nbsp; <strong>0</strong></span></td><td className="it-r">0</td></tr>
        <tr><td>Add On Coverages (Refer Note 5)</td><td className="it-r">{fmt(d.premium.addOnTotal)}</td></tr>
        <tr><td><strong>Sub Total-Addition</strong></td><td className="it-r"><strong>{fmt(d.premium.netOD)}</strong></td></tr>
        <tr><th colSpan={2} className="it-prem-section">Liability Premium (B)</th></tr>
        <tr><td>Basic Third Party Liability <span className="it-r-side">PA Cover For 0 Persons of Rs. 200000 Each (IMT-16) &nbsp;&nbsp; 0</span></td><td className="it-r">{fmt(d.premium.basicTP)}</td></tr>
        <tr><td>Third Party Liability For Bi-Fuel Kit <span className="it-r-side">PA cover for Paid Driver of Rs. 200000 (IMT–17) &nbsp;&nbsp; 0</span></td><td className="it-r">0</td></tr>
        <tr><td>Third Party Liability For Geographical Area Extension <span className="it-r-side">Legal Liability For Paid Driver (IMT-28) &nbsp;&nbsp; {fmt(d.premium.legalDr)}</span></td><td className="it-r">0</td></tr>
        <tr><td>PA Cover For Owner Driver Of Rs. 1500000 (IMT-15)</td><td className="it-r">{fmt(d.premium.paOD)}</td></tr>
        <tr><td className="it-empty"></td><td className="it-r"><strong>Net Liability Premium (B) &nbsp;&nbsp; {fmt(d.premium.netLiab)}</strong></td></tr>
      </tbody>
    </table>

    <table className="it-totals">
      <tbody>
        <tr><td>Total Premium (A+B)</td><td className="it-r"><strong>{fmt(d.premium.totalAB)}</strong></td></tr>
        <tr><td>CGST (9%)</td><td className="it-r">{fmt(d.premium.cgst)}</td></tr>
        <tr><td>SGST (9%)</td><td className="it-r">{fmt(d.premium.sgst)}</td></tr>
        <tr className="it-totals-grand"><td>Gross Premium Paid</td><td className="it-r"><strong>{fmt(d.premium.gross)}</strong></td></tr>
      </tbody>
    </table>

    <div className="it-note-box">
      <strong>Note:</strong> .Warning that in case of dishonour of the premium cheque, this document stands automatically cancelled 'ab-initio'<br />
      &gt; Consolidated stamp duty paid to state exchequer.<br />
      &gt; The policy is subject to compulsory deductible of Rs.2000 (IMT-22)<br />
      &gt; The insurance company will display terms &amp; conditions on its website www.iffcotokio.co.in which can be accessed by you online.<br />
      &gt;Addon Opted: BATTERY AND CHARGER BUNDLE COVER,Consumables,Loss of Key,NilDepDec2024Age0,RTI,Road Side Assistance,<br />
      *Subject to IMT Endt. Nos.&amp; Memorandum:22,28<br />
      {d.exShowroomPrice ? <><strong>EX-SHOWROOM PRICE</strong> : {fmt(d.exShowroomPrice)}</> : null}
    </div>

    <table className="it-vehicle-table">
      <thead><tr><th colSpan={2}>Addon Unique Identification Number (UIN) Details</th><th>Add On Premium</th></tr></thead>
      <tbody>
        {d.premium.addOnsCalc.map((a, i) => (
          <tr key={i}><td>{a.name}</td><td>{a.uin}</td><td className="it-r">{fmt(a.premium)}</td></tr>
        ))}
      </tbody>
    </table>

    <div className="it-hyp-line"><strong>Hypothecation Details:</strong>   ----NA----</div>

    <ItFooter d={d} />
  </div>
);

const ItPage3 = ({ d }) => (
  <div className="it-page">
    <ItHeader d={d} />
    <div className="it-misp-line">MISP Name: AUTOVIKAS SALES AND SERVICE PVT LTD, MISP PAN No: AADCA7132R, MISP Code: TMIBASL/MISP/AADCA7132R</div>
    <div>SAC:997134, Description of Service :Motor Vehicle Insurance Services, Place of Supply :DELHI(State Code:07)</div>
    <p className="it-cert-para">I/we hereby certify that the policy to which this certificate relates as well as the certificate of insurance are issued in accordance with the provisions of Chapter X and Chapter XI of Motor Vehicle Act, 1988</p>

    <table className="it-clause-table">
      <tbody>
        <tr>
          <td className="it-clause-k">LIMITATIONS AS TO USE</td>
          <td>The policy covers use of the vehicle for any purpose other than (1) Hire or Reward (2) Carriage of goods (other than samples or personal luggage) (3) Organized racing (4) Pace making (5) Speed testing (6) Reliability trials (7) Any purpose in connection with motor trade.</td>
        </tr>
        <tr>
          <td className="it-clause-k">DRIVER'S CLAUSE</td>
          <td>Any person including the insured: Provided that the person driving holds an effective driving license at the time of the accident and is not disqualified from holding or obtaining such license. Provided also that the person holding an effective learners license may also drive the vehicle &amp; that such a person satisfies the requirements of Rule 3 of the Central Motor Vehicle Rules, 1989.</td>
        </tr>
        <tr>
          <td className="it-clause-k">LIMITS OF LIABILITY CLAUSE</td>
          <td>Under Section II-1(i) of the policy-Death of or bodily injury: Such amount as is necessary to meet the requirements of the Motor Vehicle Act 1988.Under Section II-1 (ii) of the policy-Damage to third party property is Rs.7.5lakhs PA Cover Under Section III for Owner-Driver is Rs. 1500000</td>
        </tr>
        <tr>
          <td className="it-clause-k">NCB Clause</td>
          <td>The insured is entitled for a No Claim Bonus (NCB) on the own damage section of the policy, if no claim is made or pending during the preceding year(s)-20%, preceding two consecutive years-25%, preceding three consecutive years-35%, preceding four consecutive years-45%, preceding five consecutive years-50% of NCB on OD Premium. NCB is allowed provided the policy is renewed within 90 days of the expiry date of the previous policy.</td>
        </tr>
        <tr>
          <td className="it-clause-k">IMPORTANT NOTICE</td>
          <td>The insured is not indemnified if the vehicle is used or driven otherwise than in accordance with the schedule. Any payment made by the company by reasons of wider terms appearing in the certificate in order to comply with the Motor Vehicle Act, 1988 is recoverable from the insured. See the clause headed "AVOIDANCE OF CERTAIN TERMS &amp; RIGHT OF RECOVERY". For legal interpretation English version will hold good.</td>
        </tr>
        <tr>
          <td className="it-clause-k">NOTE</td>
          <td>This Schedule, the attached Policy and Endorsements mentioned herein above shall read together and word or expression to which a specific meaning has been attached in any part of this policy or of the Schedule shall bear the same meaning wherever it may appear. Any amendments/modifications/alterations made on this system generated policy document is not valid and Company shall not be liable for any liability whatsoever arising from such changes. Any changes required to be made in the policy once issued would be valid and effective, only after written request is made to the Company and Company accepts the requested amendments/modifications/alterations and records the same through separate endorsement to be issued by the company. <br />In Witness whereoff this policy has been signed at FARIDABAD on {d.policyIssuedOn}</td>
        </tr>
      </tbody>
    </table>

    <ItFooter d={d} />
  </div>
);
