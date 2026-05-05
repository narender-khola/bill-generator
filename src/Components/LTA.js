import React, { Component } from "react";
import "./LTA.css";
import ReactGA from "react-ga4";
import { QRCodeSVG } from "qrcode.react";
import { getHistory, addToHistory } from "../utils/inputHistory";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatLong = (d) => `${DOWS[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
const formatBP = (d) => `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const hhmm = (s) => (s || "").replace(":", "");

const minus45 = (hm) => {
  if (!hm || !hm.includes(":")) return "";
  let [h, m] = hm.split(":").map(Number);
  let total = h * 60 + m - 45;
  if (total < 0) total += 24 * 60;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}${String(total % 60).padStart(2, "0")}`;
};

const HISTORY_KEYS = {
  contactName: "lta_contactName",
  contactEmail: "lta_contactEmail",
  contactPhone: "lta_contactPhone",
  airline: "lta_airline",
  onwardFrom: "lta_onwardFrom",
  onwardFromCity: "lta_onwardFromCity",
  onwardFromAirport: "lta_onwardFromAirport",
  onwardFromTerminal: "lta_onwardFromTerminal",
  onwardTo: "lta_onwardTo",
  onwardToCity: "lta_onwardToCity",
  onwardToAirport: "lta_onwardToAirport",
  onwardFlightNo: "lta_onwardFlightNo",
  onwardDate: "lta_onwardDate",
  onwardDep: "lta_onwardDep",
  onwardArr: "lta_onwardArr",
  onwardPNR: "lta_onwardPNR",
  returnFlightNo: "lta_returnFlightNo",
  returnDate: "lta_returnDate",
  returnDep: "lta_returnDep",
  returnArr: "lta_returnArr",
  returnPNR: "lta_returnPNR",
  basefare: "lta_basefare",
  totalTax: "lta_totalTax",
  convenienceFee: "lta_convenienceFee",
  passengers: "lta_passengers",
};

const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);

const SEAT_LETTERS = ["A", "B", "C", "D", "E", "F"];
const seatForIndex = (rowStart, idx) => {
  const row = rowStart + Math.floor(idx / 6);
  return `${row}${SEAT_LETTERS[idx % 6]}`;
};

const computeDuration = (depHM, arrHM) => {
  if (!depHM || !arrHM || !depHM.includes(":") || !arrHM.includes(":")) return "";
  const [dh, dm] = depHM.split(":").map(Number);
  const [ah, am] = arrHM.split(":").map(Number);
  let mins = ah * 60 + am - (dh * 60 + dm);
  if (mins < 0) mins += 24 * 60;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
};

export default class LTA extends Component {
  constructor(props) {
    super(props);
    let savedPassengers = null;
    try {
      const raw = last("passengers", null);
      if (raw) savedPassengers = JSON.parse(raw);
    } catch {}

    this.state = {
      contactName: last("contactName", ""),
      contactEmail: last("contactEmail", ""),
      contactPhone: last("contactPhone", ""),
      airline: last("airline", "IndiGo"),
      onwardFrom: last("onwardFrom", "DEL"),
      onwardFromCity: last("onwardFromCity", "New Delhi"),
      onwardFromAirport: last("onwardFromAirport", "Indira Gandhi Airport,India"),
      onwardFromTerminal: last("onwardFromTerminal", "Terminal-2"),
      onwardTo: last("onwardTo", "GOI"),
      onwardToCity: last("onwardToCity", "Goa"),
      onwardToAirport: last("onwardToAirport", "Dabolim Airport,India"),
      onwardFlightNo: last("onwardFlightNo", "6E-2175"),
      onwardDate: last("onwardDate", ""),
      onwardDep: last("onwardDep", "07:40"),
      onwardArr: last("onwardArr", "10:10"),
      onwardPNR: last("onwardPNR", ""),
      returnFlightNo: last("returnFlightNo", "6E-2029"),
      returnDate: last("returnDate", ""),
      returnDep: last("returnDep", "19:40"),
      returnArr: last("returnArr", "22:10"),
      returnPNR: last("returnPNR", ""),
      basefare: last("basefare", ""),
      totalTax: last("totalTax", ""),
      convenienceFee: last("convenienceFee", "0"),
      passengers: savedPassengers || [
        { title: "Mr", name: "", dob: "", type: "Adult", seatOnward: "", seatReturn: "" },
      ],
      pdfView: false,
      output: null,
    };
  }

  onChange = (e, id) => this.setState({ [id]: e.target.value });

  updatePax = (idx, field, value) => {
    this.setState((s) => ({
      passengers: s.passengers.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    }));
  };

  addPax = () => {
    this.setState((s) => ({
      passengers: [...s.passengers, { title: "Mr", name: "", dob: "", type: "Adult", seatOnward: "", seatReturn: "" }],
    }));
  };

  removePax = (idx) => {
    this.setState((s) => ({ passengers: s.passengers.filter((_, i) => i !== idx) }));
  };

  autoAssignSeats = () => {
    this.setState((s) => {
      let oIdx = 0, rIdx = 0;
      const adults = s.passengers.filter((p) => p.type === "Adult").length;
      const startRow = Math.max(8, Math.min(28, 16));
      return {
        passengers: s.passengers.map((p) => {
          if (p.type !== "Adult") return p;
          const o = seatForIndex(startRow, oIdx++);
          const r = seatForIndex(startRow, rIdx++);
          return { ...p, seatOnward: o, seatReturn: r };
        }),
      };
    });
  };

  generate = () => {
    const s = this.state;
    if (!s.contactName.trim() || !s.contactEmail.trim() || !s.onwardDate || !s.returnDate) {
      alert("Contact name, email, onward date and return date are required");
      return;
    }
    if (s.passengers.length === 0) {
      alert("Add at least one passenger");
      return;
    }
    for (let i = 0; i < s.passengers.length; i++) {
      const p = s.passengers[i];
      if (!p.name.trim() || !p.dob) {
        alert(`Fill name and DOB for passenger ${i + 1}`);
        return;
      }
    }
    const base = parseFloat(s.basefare) || 0;
    const tax = parseFloat(s.totalTax) || 0;
    const conv = parseFloat(s.convenienceFee) || 0;
    if (base <= 0 || tax <= 0) {
      alert("Enter valid base fare and tax");
      return;
    }
    const onwardDate = parseISO(s.onwardDate);
    const returnDate = parseISO(s.returnDate);
    const today = new Date();
    const orderDateStr = formatBP(new Date(onwardDate.getTime() - 11 * 24 * 60 * 60 * 1000));
    const orderId = "1900" + String(Math.floor(Math.random() * 9999999999)).padStart(10, "0");
    const partnerId = "23112" + String(Math.floor(Math.random() * 99999999)).padStart(8, "0");
    const onwardSeq = 47 + Math.floor(Math.random() * 5);
    const returnSeq = 47 + Math.floor(Math.random() * 5);

    const buildPNR = (saved) => saved && saved.length === 6 ? saved : Array.from({length: 6}, () => "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789".charAt(Math.floor(Math.random() * 34))).join("");
    const onwardPNR = buildPNR(s.onwardPNR.trim());
    const returnPNR = buildPNR(s.returnPNR.trim());

    const passengers = s.passengers.map((p, i) => {
      const fmtName = (() => {
        const parts = p.name.trim().split(/\s+/);
        const last = parts[parts.length - 1];
        const rest = parts.slice(0, -1).join(" ");
        return `${last}/${rest}`.toUpperCase();
      })();
      const dob = parseISO(p.dob);
      return {
        ...p,
        idx: i,
        nameDisplay: `${p.title} ${p.name.trim()}`,
        nameUpper: fmtName,
        titleUpper: (p.title || "").toUpperCase().replace(/\./g, "").trim() + (p.title === "Mrs" ? "" : ""),
        dobStr: dob ? `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, "0")}-${String(dob.getDate()).padStart(2, "0")}` : "",
        seatOnward: p.seatOnward || (p.type === "Adult" ? seatForIndex(16, i) : ""),
        seatReturn: p.seatReturn || (p.type === "Adult" ? seatForIndex(16, i) : ""),
        seqOnward: onwardSeq + i,
        seqReturn: returnSeq + i,
      };
    });

    Object.entries({
      contactName: s.contactName, contactEmail: s.contactEmail, contactPhone: s.contactPhone,
      airline: s.airline,
      onwardFrom: s.onwardFrom, onwardFromCity: s.onwardFromCity, onwardFromAirport: s.onwardFromAirport, onwardFromTerminal: s.onwardFromTerminal,
      onwardTo: s.onwardTo, onwardToCity: s.onwardToCity, onwardToAirport: s.onwardToAirport,
      onwardFlightNo: s.onwardFlightNo, onwardDate: s.onwardDate, onwardDep: s.onwardDep, onwardArr: s.onwardArr, onwardPNR,
      returnFlightNo: s.returnFlightNo, returnDate: s.returnDate, returnDep: s.returnDep, returnArr: s.returnArr, returnPNR,
      basefare: String(base), totalTax: String(tax), convenienceFee: String(conv),
    }).forEach(([k, v]) => addToHistory(HISTORY_KEYS[k], v));
    try { addToHistory(HISTORY_KEYS.passengers, JSON.stringify(s.passengers)); } catch {}

    const netPay = base + tax + conv;

    document.title = `LTA - ${s.onwardFrom}-${s.onwardTo}-${s.onwardFrom} - ${formatBP(onwardDate)}`;

    this.setState({
      pdfView: true,
      output: {
        orderId, partnerId, orderDate: orderDateStr,
        contactName: s.contactName.trim(),
        contactEmail: s.contactEmail.trim(),
        contactPhone: s.contactPhone.trim(),
        airline: s.airline,
        onward: {
          from: s.onwardFrom.toUpperCase(), to: s.onwardTo.toUpperCase(),
          fromCity: s.onwardFromCity, toCity: s.onwardToCity,
          fromAirport: s.onwardFromAirport, toAirport: s.onwardToAirport,
          fromTerminal: s.onwardFromTerminal,
          flight: s.onwardFlightNo.toUpperCase(),
          date: onwardDate, dateLong: formatLong(onwardDate), dateBP: formatBP(onwardDate),
          dep: s.onwardDep, arr: s.onwardArr,
          duration: computeDuration(s.onwardDep, s.onwardArr),
          pnr: onwardPNR,
        },
        ret: {
          from: s.onwardTo.toUpperCase(), to: s.onwardFrom.toUpperCase(),
          fromCity: s.onwardToCity, toCity: s.onwardFromCity,
          fromAirport: s.onwardToAirport, toAirport: s.onwardFromAirport,
          fromTerminal: s.onwardFromTerminal,
          flight: s.returnFlightNo.toUpperCase(),
          date: returnDate, dateLong: formatLong(returnDate), dateBP: formatBP(returnDate),
          dep: s.returnDep, arr: s.returnArr,
          duration: computeDuration(s.returnDep, s.returnArr),
          pnr: returnPNR,
        },
        passengers,
        fare: { base, tax, conv, net: netPay },
      },
    });

    if (process.env.REACT_APP_GA_TRACKING_ID) {
      ReactGA.event({
        category: "User Interaction",
        action: "Clicked a Button",
        label: "Generate LTA",
        passengers: passengers.length,
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
              <span className="bg-result-stat">Passengers: <strong>{output.passengers.length}</strong></span>
              <span className="bg-result-stat">Net pay: <strong>Rs. {output.fare.net.toLocaleString("en-IN")}</strong></span>
            </div>
            <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">
              Generate More
            </button>
          </div>
          <ItineraryPage d={output} />
          <FareDetailsPage d={output} />
          <BoardingPassPages d={output} />
        </>
      );
    }
    return this.renderForm();
  }

  renderForm() {
    const s = this.state;
    return (
      <div className="bg-card">
        <h2 className="bg-card-title">LTA Travel Documents Generator</h2>
        <p className="bg-card-desc">Generate a Yatra-style itinerary plus IndiGo boarding passes (one per passenger per flight) — round trip in one printable PDF.</p>

        <h3 className="lta-section-title">Contact (Booker)</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Name</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.contactName} onChange={(e) => this.onChange(e, "contactName")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Email</label>
            <input className="bg-input" type="email" autoComplete="off" value={s.contactEmail} onChange={(e) => this.onChange(e, "contactEmail")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Phone</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.contactPhone} onChange={(e) => this.onChange(e, "contactPhone")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Airline</label>
            <input className="bg-input" type="text" autoComplete="off" value={s.airline} onChange={(e) => this.onChange(e, "airline")} />
          </div>
        </div>

        <h3 className="lta-section-title">Onward Flight</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">From (IATA)</label>
            <input className="bg-input" type="text" maxLength={3} value={s.onwardFrom} onChange={(e) => this.onChange(e, "onwardFrom")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">From City</label>
            <input className="bg-input" type="text" value={s.onwardFromCity} onChange={(e) => this.onChange(e, "onwardFromCity")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">From Airport</label>
            <input className="bg-input" type="text" value={s.onwardFromAirport} onChange={(e) => this.onChange(e, "onwardFromAirport")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">From Terminal</label>
            <input className="bg-input" type="text" value={s.onwardFromTerminal} onChange={(e) => this.onChange(e, "onwardFromTerminal")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">To (IATA)</label>
            <input className="bg-input" type="text" maxLength={3} value={s.onwardTo} onChange={(e) => this.onChange(e, "onwardTo")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">To City</label>
            <input className="bg-input" type="text" value={s.onwardToCity} onChange={(e) => this.onChange(e, "onwardToCity")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">To Airport</label>
            <input className="bg-input" type="text" value={s.onwardToAirport} onChange={(e) => this.onChange(e, "onwardToAirport")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Flight Number</label>
            <input className="bg-input" type="text" value={s.onwardFlightNo} onChange={(e) => this.onChange(e, "onwardFlightNo")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Onward Date</label>
            <input className="bg-input" type="date" value={s.onwardDate} onChange={(e) => this.onChange(e, "onwardDate")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Departure (HH:MM 24h)</label>
            <input className="bg-input" type="time" value={s.onwardDep} onChange={(e) => this.onChange(e, "onwardDep")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Arrival (HH:MM 24h)</label>
            <input className="bg-input" type="time" value={s.onwardArr} onChange={(e) => this.onChange(e, "onwardArr")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">PNR <span className="bg-label-hint">leave blank to auto-generate</span></label>
            <input className="bg-input" type="text" maxLength={6} value={s.onwardPNR} onChange={(e) => this.onChange(e, "onwardPNR")} />
          </div>
        </div>

        <h3 className="lta-section-title">Return Flight</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Flight Number</label>
            <input className="bg-input" type="text" value={s.returnFlightNo} onChange={(e) => this.onChange(e, "returnFlightNo")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Return Date</label>
            <input className="bg-input" type="date" value={s.returnDate} onChange={(e) => this.onChange(e, "returnDate")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Departure</label>
            <input className="bg-input" type="time" value={s.returnDep} onChange={(e) => this.onChange(e, "returnDep")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Arrival</label>
            <input className="bg-input" type="time" value={s.returnArr} onChange={(e) => this.onChange(e, "returnArr")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">PNR <span className="bg-label-hint">leave blank to auto-generate</span></label>
            <input className="bg-input" type="text" maxLength={6} value={s.returnPNR} onChange={(e) => this.onChange(e, "returnPNR")} />
          </div>
        </div>

        <h3 className="lta-section-title">Fare</h3>
        <div className="bg-grid">
          <div className="bg-field">
            <label className="bg-label">Base Fare (Rs.)</label>
            <input className="bg-input" type="number" step="0.01" value={s.basefare} onChange={(e) => this.onChange(e, "basefare")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Total Tax (Rs.)</label>
            <input className="bg-input" type="number" step="0.01" value={s.totalTax} onChange={(e) => this.onChange(e, "totalTax")} />
          </div>
          <div className="bg-field">
            <label className="bg-label">Yatra Convenience Fee (Rs.)</label>
            <input className="bg-input" type="number" step="0.01" value={s.convenienceFee} onChange={(e) => this.onChange(e, "convenienceFee")} />
          </div>
        </div>

        <h3 className="lta-section-title">Passengers</h3>
        <div className="mi-members">
          <div className="mi-members-header">
            <button type="button" className="bg-btn bg-btn-secondary" onClick={this.addPax}>+ Add Passenger</button>
            <button type="button" className="bg-btn bg-btn-secondary" onClick={this.autoAssignSeats}>Auto-assign seats</button>
          </div>
          {s.passengers.map((p, idx) => (
            <div key={idx} className="mi-member-row">
              <div className="lta-pax-grid">
                <div className="bg-field">
                  <label className="bg-label">Title</label>
                  <select className="bg-input" value={p.title} onChange={(e) => this.updatePax(idx, "title", e.target.value)}>
                    <option>Mr</option>
                    <option>Mrs</option>
                    <option>Ms</option>
                    <option>Mstr</option>
                  </select>
                </div>
                <div className="bg-field">
                  <label className="bg-label">Full Name</label>
                  <input className="bg-input" type="text" value={p.name} onChange={(e) => this.updatePax(idx, "name", e.target.value)} />
                </div>
                <div className="bg-field">
                  <label className="bg-label">DOB</label>
                  <input className="bg-input" type="date" value={p.dob} onChange={(e) => this.updatePax(idx, "dob", e.target.value)} />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Type</label>
                  <select className="bg-input" value={p.type} onChange={(e) => this.updatePax(idx, "type", e.target.value)}>
                    <option>Adult</option>
                    <option>Child</option>
                    <option>Infant</option>
                  </select>
                </div>
                <div className="bg-field">
                  <label className="bg-label">Seat (Onward)</label>
                  <input className="bg-input" type="text" value={p.seatOnward} onChange={(e) => this.updatePax(idx, "seatOnward", e.target.value)} />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Seat (Return)</label>
                  <input className="bg-input" type="text" value={p.seatReturn} onChange={(e) => this.updatePax(idx, "seatReturn", e.target.value)} />
                </div>
              </div>
              {s.passengers.length > 1 ? (
                <button type="button" className="mi-remove-btn" onClick={() => this.removePax(idx)} title="Remove">×</button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="bg-actions">
          <button type="button" className="bg-btn bg-btn-primary" onClick={this.generate}>Generate LTA Documents</button>
        </div>

        <div className="bg-tips">
          <div className="bg-tips-title">Tips</div>
          <div>Output is one printable document with: itinerary page, fare/baggage/cancellation page, and IndiGo boarding passes (2 per A4 page) for every adult — both for onward and return.</div>
          <div>Infants don't get a boarding pass with seat info (they share an adult seat).</div>
          <div>Click "Auto-assign seats" to seed seats starting from row 16; you can override per passenger before generating.</div>
        </div>
      </div>
    );
  }
}

const fmtRs = (n) => "Rs." + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ItineraryPage = ({ d }) => (
  <div className="lta-page">
    <div className="lta-tk-bar">
      <div className="lta-tk-bar-left">Order Details</div>
      <div className="lta-tk-bar-right">Contact Details</div>
    </div>
    <div className="lta-tk-row">
      <div className="lta-tk-col">
        <div className="lta-tk-line"><span className="lta-tk-label">Order Id</span><span>: {d.orderId}</span></div>
        <div className="lta-tk-line"><span className="lta-tk-label">Order Date</span><span>: {d.orderDate}</span></div>
        <div className="lta-tk-line"><span className="lta-tk-label">Partner ID</span><span>: {d.partnerId}</span></div>
        <div className="lta-tk-line"><span className="lta-tk-label">Booking Partner</span><span><img src={process.env.PUBLIC_URL + "/images/yatra-logo.png"} alt="Yatra" className="lta-yatra" /></span></div>
        <div className="lta-tk-note">For any changes/amendment/queries, kindly reach out to YATRA<br />Call: 0120 - 4845562; Email: <span className="lta-link">flightsupport_hdfc@yatra.co</span></div>
      </div>
      <div className="lta-tk-col lta-tk-contact">
        <div>{d.contactName}</div>
        <div>{d.contactEmail}</div>
        <div>{d.contactPhone}</div>
      </div>
    </div>

    <Sector flight={d.onward} airline={d.airline} side="Onward" />
    <PassengerTable passengers={d.passengers} />
    <Sector flight={d.ret} airline={d.airline} side="Return" />
    <PassengerTable passengers={d.passengers} />
  </div>
);

const Sector = ({ flight, airline, side }) => (
  <>
    <div className="lta-sec-bar">
      <div className="lta-sec-bar-left"><strong>{flight.fromCity} to {flight.toCity}</strong></div>
      <div className="lta-sec-bar-mid">{flight.dateLong.replace(/^\w+,\s*/, "Fri, ")}</div>
      <div className="lta-sec-bar-right"><strong>{side} Journey</strong></div>
    </div>
    <div className="lta-sec-flight">
      <div className="lta-sec-airline">
        <div><strong>{airline}</strong></div>
        <div className="lta-sec-flight-no">{flight.flight}</div>
      </div>
      <div className="lta-sec-leg">
        <div className="lta-sec-time">{flight.from} <strong>{flight.dep}</strong></div>
        <div className="lta-sec-sub">{flight.dateLong}</div>
        <div className="lta-sec-sub">{flight.fromAirport}</div>
        {flight.fromTerminal ? <div className="lta-sec-sub">{flight.fromTerminal}</div> : null}
      </div>
      <div className="lta-sec-mid">
        <div>{flight.duration}</div>
        <div>Economy</div>
      </div>
      <div className="lta-sec-leg">
        <div className="lta-sec-time"><strong>{flight.arr}</strong> {flight.to}</div>
        <div className="lta-sec-sub">{flight.dateLong}</div>
        <div className="lta-sec-sub">{flight.toAirport}</div>
      </div>
    </div>
    <div className="lta-sec-pnr"><strong>Airline PNR: {flight.pnr}</strong></div>
  </>
);

const PassengerTable = ({ passengers }) => (
  <table className="lta-pax-table">
    <thead>
      <tr><th>TRAVELLERS</th><th>DOB</th></tr>
    </thead>
    <tbody>
      {passengers.map((p, i) => {
        let label;
        if (p.type === "Infant") label = `Infant ${passengers.slice(0, i + 1).filter((x) => x.type === "Infant").length}`;
        else if (p.type === "Child") label = `Child ${passengers.slice(0, i + 1).filter((x) => x.type === "Child").length}`;
        else label = `Adult ${passengers.slice(0, i + 1).filter((x) => x.type === "Adult").length}`;
        return (
          <tr key={i}>
            <td>
              <div className="lta-pax-label">{label}:</div>
              <div className="lta-pax-name"><strong>{p.nameDisplay}</strong></div>
            </td>
            <td>{p.dobStr}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const FareDetailsPage = ({ d }) => {
  const adults = d.passengers.filter((p) => p.type === "Adult").length;
  const children = d.passengers.filter((p) => p.type === "Child").length;
  const infants = d.passengers.filter((p) => p.type === "Infant").length;
  return (
    <div className="lta-page">
      <table className="lta-fare-table">
        <thead><tr><th colSpan={2}>FARE DETAILS</th></tr></thead>
        <tbody>
          <tr><td>Basefare</td><td className="lta-r">{fmtRs(d.fare.base)}</td></tr>
          <tr><td>Total Tax</td><td className="lta-r">{fmtRs(d.fare.tax)}</td></tr>
          <tr><td>Discount</td><td className="lta-r">Rs.0.00</td></tr>
          <tr><td>YATRA Convenience Fee</td><td className="lta-r">{fmtRs(d.fare.conv)}</td></tr>
          <tr><td><strong>Net Pay</strong></td><td className="lta-r"><strong>{fmtRs(d.fare.net)}</strong></td></tr>
          <tr><td>Paid by points</td><td className="lta-r">Rs.0.00</td></tr>
          <tr><td><strong>Paid by cash</strong></td><td className="lta-r"><strong>{fmtRs(d.fare.net)}</strong></td></tr>
        </tbody>
      </table>

      <table className="lta-bag-table">
        <thead><tr><th colSpan={4}>Baggage Information</th></tr>
          <tr><th>Person</th><th>Sector / Flights</th><th>Check-in Baggage per person</th><th>Cabin Baggage per person</th></tr>
        </thead>
        <tbody>
          {adults > 0 ? <>
            <tr><td rowSpan={2}>adult</td><td>{d.onward.flight}</td><td>15 kgs</td><td>7 kgs</td></tr>
            <tr><td>{d.ret.flight}</td><td>15 kgs</td><td>7 kgs</td></tr>
          </> : null}
          {children > 0 ? <>
            <tr><td rowSpan={2}>child</td><td>{d.onward.flight}</td><td>15 kgs</td><td>7 kgs</td></tr>
            <tr><td>{d.ret.flight}</td><td>15 kgs</td><td>7 kgs</td></tr>
          </> : null}
          {infants > 0 ? <tr><td>Infant</td><td>Kindly contact Partner for further details.</td><td>Kindly contact Partner for further details.</td><td>Kindly contact Partner for further details.</td></tr> : null}
        </tbody>
      </table>

      <div className="lta-section-heading"><strong>CANCELLATION POLICY</strong></div>
      <CancellationTable sector={`${d.onward.from}-${d.onward.to}`} airline={d.airline} penalty={3500} />
      <CancellationTable sector={`${d.ret.from}-${d.ret.to}`} airline={d.airline} penalty={3000} />

      <div className="lta-blue-heading">Important Notice</div>
      <ol className="lta-notice-list">
        <li>YATRA is the Booking Partner for the above flight booking. For any clarifications concerning rescheduling/modifications, cancellations &amp; refunds, please contact the partner directly on:<br />Yatra - 0120 - 4845562; <span className="lta-link">flightsupport_hdfc@yatra.com</span></li>
        <li>In cases of any rescheduling/modifications &amp; cancellations on account of undue conditions, neither HDFC Bank nor SmartBuy would be held responsible.</li>
        <li>Refunds, if any, will be processed subject to receipt of funds from partner and/or airline.</li>
        <li>In case of any delay in the refunds, neither HDFC Bank nor SmartBuy would be held responsible.</li>
      </ol>
    </div>
  );
};

const CancellationTable = ({ sector, airline, penalty }) => (
  <table className="lta-cancel-table">
    <tbody>
      <tr><td>Sector</td><td>{sector}</td></tr>
      <tr><td>Airline</td><td>{airline}</td></tr>
      <tr><td>Fare Basis Code</td><td>XXXXX</td></tr>
      <tr><td>Type of Fare</td><td>Refundable</td></tr>
      <tr><td>Refund Type</td><td>Refundable</td></tr>
      <tr><td>Cancellation Policy*</td><td>Cancellation penalty per sector applicable 2 hrs prior to departure - INR {penalty}. If cancellation is done with in 2 hrs of departure, the ticket will be treated as a No-Show. In case of a No-Show, the fare in Non-Refundable. Basic Fare + YQ + YR will be forf</td></tr>
      <tr><td>Re-issuance *</td><td>INR 2500 will be charged as rebooking /change fee up to 2 hour prior to flight departure. In case of a No-Show, the fare in Non-Refundable. Basic Fare + YQ + YR will be forfeited and only statutory taxes will be refunded in this case.</td></tr>
      <tr><td>Yatra Offline Cancellation/Rescheduling Service Fee*</td><td><em>Rs.</em>3500</td></tr>
      <tr><td>Yatra Online Cancellation/Rescheduling Service Fee*</td><td><em>Rs.</em>400</td></tr>
      <tr><td colSpan={2}>*Per person per sector</td></tr>
    </tbody>
  </table>
);

const BoardingPassPages = ({ d }) => {
  const adults = d.passengers.filter((p) => p.type !== "Infant");
  const onwardCards = adults.map((p) => ({ p, f: d.onward, seat: p.seatOnward, seq: p.seqOnward }));
  const returnCards = adults.map((p) => ({ p, f: d.ret, seat: p.seatReturn, seq: p.seqReturn }));
  const all = [...onwardCards, ...returnCards];

  const pages = [];
  const PER_PAGE = 2;
  for (let i = 0; i < all.length; i += PER_PAGE) {
    pages.push(all.slice(i, i + PER_PAGE));
  }

  return (
    <>
      {pages.map((page, pi) => (
        <div key={pi} className="lta-bp-page">
          {pi === 0 ? (
            <div className="lta-bp-header">
              <h2>Your Boarding Pass</h2>
              <div>Please carry a printed copy of your Bag Tag &amp; boarding pass before reaching the airport.</div>
            </div>
          ) : null}
          {page.map((c, ci) => (
            <BoardingPass key={ci} p={c.p} f={c.f} seat={c.seat} seq={c.seq} airline={d.airline} />
          ))}
        </div>
      ))}
    </>
  );
};

const BoardingPass = ({ p, f, seat, seq, airline }) => {
  const qrPayload = `M1${p.nameUpper.padEnd(20)}E${f.pnr} ${f.from}${f.to}${airline.slice(0, 2).toUpperCase()} ${f.flight.replace(/[^0-9]/g, "")} ${f.dateBP} ${seat} ${String(seq).padStart(4, "0")}`;
  return (
    <div className="lta-bp">
      <div className="lta-bp-top">
        <div className="lta-bp-top-left">
          <img src={process.env.PUBLIC_URL + "/images/indigo-logo.png"} alt={airline} className="lta-bp-logo" />
          <span className="lta-bp-label">Boarding Pass (Web Check-in)</span>
          <span className="lta-bp-dup">Duplicate</span>
        </div>
        <div className="lta-bp-top-right">Your Departure Terminal is {(f.fromTerminal || "").replace(/Terminal-/, "T") || "T2"} <span aria-hidden="true">✈</span></div>
      </div>
      <div className="lta-bp-content">
        <div className="lta-bp-left">
          <div className="lta-bp-name">{p.nameUpper} {p.title === "Mrs" ? "MRS" : p.title === "Ms" ? "MS" : p.title === "Mstr" ? "MSTR" : "MR"}</div>
          <div className="lta-bp-route">{f.fromCity} ({(f.fromTerminal || "").replace(/Terminal-/, "T") || "T2"}) To <strong>{f.toCity.toUpperCase()}</strong></div>
          <div className="lta-bp-grid">
            <div className="lta-bp-cell"><div className="lta-bp-cell-label">Flight</div><div className="lta-bp-cell-val">{f.flight.replace("-", " ")}</div></div>
            <div className="lta-bp-cell"><div className="lta-bp-cell-label">Gate</div><div className="lta-bp-cell-val">-</div></div>
            <div className="lta-bp-cell"><div className="lta-bp-cell-label">Boarding Time</div><div className="lta-bp-cell-val">{minus45(f.dep)} Hrs</div></div>
            <div className="lta-bp-cell"><div className="lta-bp-cell-label">Boarding</div><div className="lta-bp-cell-val">Zone 2</div></div>
            <div className="lta-bp-cell"><div className="lta-bp-cell-label">Seat</div><div className="lta-bp-cell-val">{seat}</div></div>
          </div>
          <div className="lta-bp-bottom">
            <div className="lta-bp-qr-box">
              <QRCodeSVG value={qrPayload} size={110} level="L" />
            </div>
            <div className="lta-bp-info">
              <div className="lta-bp-info-row"><span>Departure Date</span><strong>{f.dateBP}</strong> <span>Departure Time</span><strong>{hhmm(f.dep)} Hrs</strong></div>
              <div className="lta-bp-info-row"><span>Seq</span><strong>{String(seq).padStart(4, "0")}</strong> <span>Services</span><span>{p.type === "Infant" ? "INFT" : "NIL"}</span></div>
            </div>
          </div>
          <div className="lta-bp-foot">Gate is subject to change and will close 25 minutes prior to departure.</div>
        </div>
        <div className="lta-bp-stub">
          <div className="lta-bp-stub-name">{p.nameUpper} {p.title === "Mrs" ? "MRS" : p.title === "Ms" ? "MS" : p.title === "Mstr" ? "MSTR" : "MR"}</div>
          <div className="lta-bp-stub-route"><strong>{f.from} ({(f.fromTerminal || "").replace(/Terminal-/, "T") || "T2"})</strong> <span aria-hidden="true">→</span> <strong>{f.to}</strong></div>
          <div className="lta-bp-stub-row"><span>Flight</span><strong>{f.flight.replace("-", " ")}</strong></div>
          <div className="lta-bp-stub-row"><span>Departure</span><strong>{f.dateBP}</strong></div>
          <div className="lta-bp-stub-row"><span>PNR</span><strong>{f.pnr}</strong></div>
          <div className="lta-bp-stub-row"><span>Services</span><span>{p.type === "Infant" ? "INFT" : "NIL"}</span></div>
          <div className="lta-bp-stub-qr">
            <QRCodeSVG value={qrPayload} size={72} level="L" />
            <div className="lta-bp-stub-info">
              <div><span>Seat</span> <strong>{seat}</strong></div>
              <div><span>Seq</span> <strong>{String(seq).padStart(4, "0")}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
