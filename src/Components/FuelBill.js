import React, { Component } from "react";
import "./FuelBill.css";
import { fuel_data, diesel_data } from "./Fueldata";
import ReactGA from 'react-ga4';
import { getHistory, addToHistory } from "../utils/inputHistory";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// 58mm thermal roll, printed at the head's native 203dpi.  Rendering at exactly
// one canvas pixel per printer dot is what keeps the 1-bit pass below meaningful:
// any later rescale re-introduces the greys the thermal head can only dither.
const THERMAL_WIDTH_MM = 58;
const THERMAL_DPI = 203;
const THERMAL_WIDTH_PX = Math.round((THERMAL_WIDTH_MM / 25.4) * THERMAL_DPI); // 464 dots
// Capture above the dot pitch, then box-filter down, so thin strokes survive.
const THERMAL_SUPERSAMPLE = 3;
// Ink cutoff.  Above the midpoint because the downsample leaves antialiased
// stems in the 130-180 band; dropping them is what thinned text out before.
const THERMAL_THRESHOLD = 160;

const HISTORY_KEYS = {
  number_of_bills: "fuel_number_of_bills",
  mean: "fuel_mean",
  amount: "fuel_amount",
};

const _currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const _todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Per-fuel product details.  Density bands are what the dispensers print:
// petrol ~745-751 kg/m3, diesel ~826-836 kg/m3.
const FUELS = {
  petrol: { label: "Petrol", product: "PETROL", data: fuel_data, bpcl: [746.0, 5.0], ioc: [745, 2] },
  diesel: { label: "Diesel", product: "DIESEL", data: diesel_data, bpcl: [828.0, 8.0], ioc: [826, 6] },
};
const FUEL_STORAGE_KEY = "fuel_bill_fuel_type";
const _loadFuelType = () => {
  try {
    const saved = localStorage.getItem(FUEL_STORAGE_KEY);
    if (FUELS[saved]) return saved;
  } catch (e) {}
  return "petrol";
};
const _fuelFields = (fuel) => {
  const f = FUELS[fuel] || FUELS.petrol;
  return {
    product: f.product,
    bpcl_density: (f.bpcl[0] + Math.random() * f.bpcl[1]).toFixed(1) + "Kg/Cu.mtr",
    ioc_density: (f.ioc[0] + Math.random() * f.ioc[1]).toFixed(1) + "kg/m3",
  };
};

// Dates are YYYY-MM-DD strings, so plain string comparison orders them correctly.
const _avgRateForRange = (start, end, fuel = "petrol") => {
  if (!start || !end || start > end) return null;
  const rows = FUELS[fuel].data.filter((r) => r.date >= start && r.date <= end);
  if (rows.length === 0) return null;
  const avg = rows.reduce((s, r) => s + parseFloat(r.rate), 0) / rows.length;
  return avg.toFixed(2);
};

const _DAY_MS = 24 * 60 * 60 * 1000;

const FUEL_STATIONS = [
  {
    logo: process.env.PUBLIC_URL + "/images/indian-oil.png",
    organisation: "IndianOil / IOCL",
    addresses: ["Janta Filling Station – Sikanderpur, near Le Meridien, Sector 26", "NH 8, Sector 15 Part 1", "Khandelwal Oil Company – Opposite Ansal Plaza, Sector 1 Palam Vihar", "Shaheed Ramphal Kajla Filling Station – Sector 29"],
    tin: "06463800124",
    ph: "9212529333"
  },
  {
    logo: process.env.PUBLIC_URL + "/images/bharat-petroleum.png",
    organisation: "Bharat Petroleum BPCL",
    addresses: [
      "BP-BADSHAHPUR, VIL..NORPUR, GURUGRAM. HARYANA",
      "DLF Phase 5, Sector 43, Gurugram",
      "Opp Gold Sukh Mall, Sector 44, Gurugram",
      "Netaji Subhash Marg, Sector 47, Gurugram",
      "Delhi–Jaipur Expy, Sector 30, Gurugram",
      "Masani Village – LT Atul Kataria Marg, Sector 6, Gurugram",
      "Karamveer Filling Station – Rly Stn Rd, Gurugram",
      "Jawala Service Station – Delhi–Jaipur Expy, Sector 31, Gurugram"
    ],
    tin: "06392004285",
    ph: "8587975292"
  },
  {
    logo: process.env.PUBLIC_URL + "/images/hp-oil.png",
    organisation: "Hindustan Petroleum (HP)",
    addresses: ["Mehrauli-Gurgaon Rd, Sector 17", "Sector 25 – Near Metro, DLF Phase 1", "Station Road, Sector 5", "Hira Fuels – Opp Jalvayu Towers, Sector 53", "HP (Sector 12A) – Sector 12", "Auto Care Centre – Near Tau Devi Lal Park, Sector 23A", "Subhash Chowk, Sector 48"],
    tin: "06721598421",
    ph: "9811456722"
  },
];

// Real totalizer readings off BP-BADSHAHPUR receipts (sample_receipt.jpeg).  Each
// dispenser keeps its own Local ID / Atot / Vtot counters, so a generated bill is
// placed on that series by its date+time instead of getting random numbers.
// Between readings the counters are interpolated; outside them they are carried
// forward/back at the average daily throughput of the whole series.
const BADSHAHPUR_ADDRESS = "BP-BADSHAHPUR, VIL..NORPUR, GURUGRAM. HARYANA";
const BADSHAHPUR_DISPENSERS = [
  {
    fip: 2,
    nozzle: 4,
    readings: [
      { at: [2026, 8, 1, 11, 2], local_id: 580947, atot: 226596418.16, vtot: 2352964.41 },
      { at: [2026, 8, 14, 6, 41], local_id: 585174, atot: 228725028.95, vtot: 2373674.77 },
      { at: [2026, 8, 16, 11, 54], local_id: 586113, atot: 229173053.14, vtot: 2378033.63 },
      { at: [2026, 8, 17, 9, 2], local_id: 586478, atot: 229359603.97, vtot: 2379848.88 },
    ],
  },
  {
    fip: 1,
    nozzle: 3,
    readings: [
      { at: [2026, 8, 2, 8, 12], local_id: 637866, atot: 268894852.36, vtot: 2793528.42 },
      { at: [2026, 8, 11, 7, 13], local_id: 640886, atot: 270138704.13, vtot: 2805630.5 },
      { at: [2026, 8, 18, 9, 28], local_id: 644112, atot: 271332371.51, vtot: 2817244.31 },
    ],
  },
].map((d) => ({ ...d, readings: d.readings.map(({ at: [y, mo, day, h, mi], ...r }) => ({ ...r, t: new Date(y, mo - 1, day, h, mi).getTime() })) }));

const _dispenserReading = (dispenser, t, rate) => {
  const rs = dispenser.readings;
  const first = rs[0], last = rs[rs.length - 1];
  let i = rs.findIndex((r, k) => k < rs.length - 1 && t >= r.t && t <= rs[k + 1].t);
  if (i !== -1) {
    const a = rs[i], b = rs[i + 1], f = (t - a.t) / (b.t - a.t);
    return {
      local_id: a.local_id + f * (b.local_id - a.local_id),
      atot: a.atot + f * (b.atot - a.atot),
      vtot: a.vtot + f * (b.vtot - a.vtot),
    };
  }
  // Outside the known readings: extrapolate from the nearest end.  Atot moves by
  // the volume at this bill's rate, since the price may differ from the anchors'.
  const span = last.t - first.t;
  const perMs = { local_id: (last.local_id - first.local_id) / span, vtot: (last.vtot - first.vtot) / span };
  const base = t < first.t ? first : last;
  const dt = t - base.t;
  const dv = perMs.vtot * dt;
  return { local_id: base.local_id + perMs.local_id * dt, atot: base.atot + dv * rate, vtot: base.vtot + dv };
};

// Every other pump (and Badshahpur's diesel nozzles, which the real readings
// don't cover) gets an invented but stable series: two dispensers per pump and
// fuel, with starting counters and daily throughput drawn from a generator
// seeded by the pump's address.  The same pump therefore always prints the same
// FIP/nozzle pairs and counters that climb steadily with the bill's date, across
// runs.  Ranges follow the real Badshahpur nozzles: ~1,700 L and ~350 sales a
// day, ~4.9 L a sale.
const _SERIES_REF = new Date(2026, 7, 1).getTime();
const _seeded = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const _syntheticCache = new Map();
const _syntheticDispensers = (address, fuel) => {
  const key = `${address}::${fuel}`;
  if (_syntheticCache.has(key)) return _syntheticCache.get(key);
  const rnd = _seeded(key);
  const pick = (lo, hi) => lo + rnd() * (hi - lo);
  const used = new Set();
  const dispensers = [0, 1].map(() => {
    let fip, nozzle;
    do {
      fip = 1 + Math.floor(rnd() * 6);
      nozzle = 1 + Math.floor(rnd() * 4);
    } while (used.has(`${fip}/${nozzle}`));
    used.add(`${fip}/${nozzle}`);
    const litresPerDay = pick(1100, 2300);
    const salesPerDay = litresPerDay / pick(4.2, 5.6);
    const vtot = pick(900000, 3600000);
    const atot = vtot * pick(91, 97);
    const local_id = Math.round(vtot / pick(4.4, 5.4));
    const days = 30, t2 = _SERIES_REF + days * _DAY_MS;
    return {
      fip,
      nozzle,
      readings: [
        { t: _SERIES_REF, local_id, atot, vtot },
        { t: t2, local_id: local_id + salesPerDay * days, atot: atot + litresPerDay * days * 100, vtot: vtot + litresPerDay * days },
      ],
    };
  });
  _syntheticCache.set(key, dispensers);
  return dispensers;
};

const _pumpKey = (organisation, address) => `${organisation}::${address}`;
const ALL_PUMP_KEYS = FUEL_STATIONS.flatMap((st) => st.addresses.map((a) => _pumpKey(st.organisation, a)));
const PUMPS_STORAGE_KEY = "fuel_selected_pumps";

const _loadSelectedPumps = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PUMPS_STORAGE_KEY) || "null");
    if (Array.isArray(saved)) {
      // The Noorpur pump used to be listed twice under two spellings.
      const merged = saved.map((k) => k.replace("::BP BADSHAPUR, VILL NOORPUR, GURUGRAM HR", `::${BADSHAHPUR_ADDRESS}`));
      const valid = [...new Set(merged)].filter((k) => ALL_PUMP_KEYS.includes(k));
      if (valid.length) return valid;
    }
  } catch (e) {}
  return ALL_PUMP_KEYS;
};

const _saveSelectedPumps = (keys) => {
  try {
    localStorage.setItem(PUMPS_STORAGE_KEY, JSON.stringify(keys));
  } catch (e) {}
};

const _latestRate = (fuel = "petrol") => {
  const data = FUELS[fuel].data;
  if (!data.length) return "95.45";
  const latest = data.reduce((a, b) => (a.date > b.date ? a : b));
  return parseFloat(latest.rate).toFixed(2);
};

export default class FuelBill extends Component {
  constructor(props) {
    super(props);
    const initialStart = `${_currentMonth()}-01`;
    const initialEnd = _todayStr();
    const initialFuel = _loadFuelType();
    const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);
    this.state = {
      fuel_type: initialFuel,
      receipt_no: 5050,
      address: "",
      amount: last("amount", ""),
      mean: last("mean", "4000"),
      bills: [],
      pdf_view: false,
      sum_amount: 0,
      sum_ltrs: 0,
      month_mode: true,
      range_start: initialStart,
      range_end: initialEnd,
      selected_pumps: _loadSelectedPumps(),
      number_of_bills: last("number_of_bills", "1"),
      // Empty = each bill takes the rate of its own day; a typed rate is used on
      // every bill instead.
      petrol_rate: "",
      fuel_stations: FUEL_STATIONS,
    };
  }

  _switch_mode = () => {
    this.setState((prevState) => ({ month_mode: !prevState.month_mode }));
  };

  _setFuelType = (fuel) => {
    if (fuel === this.state.fuel_type) return;
    try { localStorage.setItem(FUEL_STORAGE_KEY, fuel); } catch (e) {}
    // A typed rate was for the other fuel, so it never carries over.
    this.setState({ fuel_type: fuel, petrol_rate: "" });
  };

  onChange = (e, id) => {
    this.setState({ [id]: e.target.value });
  };

  _generateRandomNumber = (from_num, to_num) => {
    return from_num + Math.round(Math.random() * (to_num - from_num));
  };

  // Picks uniformly across the selected pumps, so a brand with more chosen
  // outlets shows up proportionally more often.
  _getRandomPump = () => {
    const { fuel_stations, selected_pumps } = this.state;
    const pool = [];
    fuel_stations.forEach((station) => {
      station.addresses.forEach((address) => {
        if (selected_pumps.includes(_pumpKey(station.organisation, address))) pool.push({ station, address });
      });
    });
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // Counter fields placing the bill on its pump's series: the real Badshahpur
  // petrol readings, or the pump's invented series otherwise.  Bills are at least
  // a day apart and a dispenser does ~1500 L / ~350 sales a day, so the jitter
  // never makes a series run backwards.
  _totalizerFields = (address, dateStr, timeStr, rate) => {
    const fuel = this.state.fuel_type;
    const pool = address === BADSHAHPUR_ADDRESS && fuel === "petrol" ? BADSHAHPUR_DISPENSERS : _syntheticDispensers(address, fuel);
    const dispenser = pool[Math.floor(Math.random() * pool.length)];
    const [y, mo, d] = dateStr.split("-").map(Number);
    const [h, mi] = timeStr.split(":").map(Number);
    rate = parseFloat(rate);
    const r = _dispenserReading(dispenser, new Date(y, mo - 1, d, h, mi).getTime(), rate);
    const dv = (Math.random() - 0.5) * 40;
    const sale = Math.round(r.local_id + this._generateRandomNumber(-15, 15));
    return {
      bay_no: dispenser.fip,
      nozzle_no: dispenser.nozzle,
      local_id: String(sale).padStart(8, "0"),
      // HP and IndianOil print the dispenser's transaction counter as Trns.ID.
      trns_id: String(sale).padStart(16, "0"),
      atot: (r.atot + dv * rate).toFixed(2).padStart(14, "0"),
      vtot: (r.vtot + dv).toFixed(2).padStart(14, "0"),
    };
  };

  _setSelectedPumps = (keys) => {
    _saveSelectedPumps(keys);
    this.setState({ selected_pumps: keys });
  };

  _togglePump = (key) => {
    const { selected_pumps } = this.state;
    this._setSelectedPumps(
      selected_pumps.includes(key) ? selected_pumps.filter((k) => k !== key) : ALL_PUMP_KEYS.filter((k) => k === key || selected_pumps.includes(k))
    );
  };

  _toggleStation = (station) => {
    const { selected_pumps } = this.state;
    const keys = station.addresses.map((a) => _pumpKey(station.organisation, a));
    const allOn = keys.every((k) => selected_pumps.includes(k));
    this._setSelectedPumps(
      allOn ? selected_pumps.filter((k) => !keys.includes(k)) : ALL_PUMP_KEYS.filter((k) => keys.includes(k) || selected_pumps.includes(k))
    );
  };

  _hashString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  // Transaction start, end and print time, a few minutes apart.  Built from
  // seconds since midnight so minutes and seconds carry over instead of
  // printing impossible times like 20:60.
  _getTime = () => {
    const fmt = (t) => [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((n) => String(n).padStart(2, "0")).join(":");
    const start = this._generateRandomNumber(10, 22) * 3600 + this._generateRandomNumber(0, 59) * 60 + this._generateRandomNumber(0, 59);
    const end = start + this._generateRandomNumber(60, 130);
    const printed = end + this._generateRandomNumber(180, 310);
    return {
      time: fmt(printed),
      txnSt: fmt(start),
      txnEnd: fmt(end),
    };
  };

  _generateAmountArray = (total_number_of_bills) => {
    let amount_arr = [],
      { mean } = this.state;
    mean = parseInt(mean);
    for (let i = 0; i < parseInt(total_number_of_bills / 2); i++) {
      let ei = total_number_of_bills - 1 - i;
      let diff = this._generateRandomNumber(0, 500);
      if (i % 2 === 0) {
        amount_arr[i] = mean - diff;
        amount_arr[ei] = mean + diff;
      } else {
        amount_arr[i] = mean + diff;
        amount_arr[ei] = mean - diff;
      }
    }
    if (total_number_of_bills % 2 !== 0) {
      amount_arr[parseInt(total_number_of_bills / 2)] = mean;
    }
    console.log(amount_arr);
    return amount_arr;
  };

  _generateFuelBills = () => {
    
    let { amount, fuel_type, sum_amount, sum_ltrs, mean } = this.state;
    const fuel_data = FUELS[fuel_type].data;
    if (mean === "" || mean === null || isNaN(mean) || mean.includes(".") || mean > 10000) {
      alert("Enter valid integer number in mean amount less than 10000");
      return;
    }
    mean = parseInt(mean);
    if (!this.state.selected_pumps.length) {
      alert("Select at least one petrol pump");
      return;
    }
    if (amount === "" || amount === null || isNaN(amount) || amount.includes(".") || amount > mean * 365 - 1) {
      alert(`Enter valid integer number in total amount less than ${mean * 365 - 1}`);
      return;
    }

    // Filter fuel data from 2025-04-01 to today
    const startDate = new Date("2025-04-01");
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let filtered_fuel_data = fuel_data.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= today;
    });

    if (filtered_fuel_data.length === 0) {
      alert("No fuel data available for the specified date range");
      return;
    }

    let total_number_of_bills = parseInt(amount / mean);

    if (total_number_of_bills < 2) {
      alert("Generate at least 2 bills to ensure first and last dates are included");
      return;
    }

    let bills = [];
    let amount_arr = this._generateAmountArray(total_number_of_bills);
    let receipt_no = 4102709341; // starting txn number

    // Calculate evenly distributed indices with variance
    let indices = [];
    let totalDays = filtered_fuel_data.length - 1;
    let averageGap = totalDays / (total_number_of_bills - 1);

    for (let i = 0; i < total_number_of_bills; i++) {
      let idealIndex = Math.round(i * averageGap);

      // Add variance of ±1 day for realism (but only for non-first and non-last bills)
      let variance = 0;
      if (i !== 0 && i !== total_number_of_bills - 1) {
        variance = this._generateRandomNumber(-1, 1);
      }

      let finalIndex = Math.max(0, Math.min(idealIndex + variance, filtered_fuel_data.length - 1));

      // Ensure we don't pick the same date twice in a row
      if (indices.length > 0 && indices[indices.length - 1] === finalIndex) {
        finalIndex = Math.min(finalIndex + 1, filtered_fuel_data.length - 1);
      }

      indices.push(finalIndex);
    }

    for (let i = 0; i < total_number_of_bills; i++) {
      let fuel_value = filtered_fuel_data[indices[i]];
      let times_obj = this._getTime();
      let txn_id = this._generateRandomNumber(receipt_no + 10000, receipt_no + 100000000);
      let { station: fuel_station, address: fuel_address } = this._getRandomPump();
      bills.push({
        amount: amount_arr[i].toFixed(2),
        date: new Date(fuel_value.date),
        time: times_obj.time,
        rate: fuel_value.rate,
        ltr: parseFloat(amount_arr[i] / fuel_value.rate).toFixed(2),
        bay_no: this._generateRandomNumber(1, 8),
        nozzle_no: this._generateRandomNumber(1, 4),
        paymode: "CASH",
        txn_id,
        ..._fuelFields(this.state.fuel_type),
        bpcl_preset: ["Volume", "Amount"][Math.floor(Math.random() * 2)],
        ioc_preset: this._generateRandomNumber(10, 99) + "L",
        local_id: String(this._generateRandomNumber(100000, 999999)).padStart(8, '0'),
        atot: String((20000000000 + Math.random() * 8000000000).toFixed(2)).padStart(14, '0'),
        vtot: String((1000000 + Math.random() * 2000000).toFixed(2)).padStart(14, '0'),
        trns_id: String(this._generateRandomNumber(1000, 99999)).padStart(16, '0'),
        hdfc_no: `D ${fuel_value.date.split("-")[1]}/${fuel_value.date.split("-")[0]}`,
        txnSt: times_obj.txnSt,
        txnEnd: times_obj.txnEnd,
        fuel_station_logo: fuel_station.logo,
        fuel_station_name: fuel_station.organisation,
        fuel_station_address: fuel_address,
        fuel_station_tin: "06" + String(this._hashString(fuel_address)).padStart(9, '3').slice(-9),
        fuel_station_ph: "9" + String(this._hashString(fuel_address + "ph")).padStart(9, '8').slice(-9),
        paddingTop: this._generateRandomNumber(15, 35) + 'mm',
        paddingBottom: this._generateRandomNumber(20, 40) + 'mm',
        card_no: `************${this._generateRandomNumber(1000, 9999)}`,
        bank_mid: `5PR000001735416`,
        bank_tid: `PA0${this._generateRandomNumber(50000, 59999)}`,
        aid: `A00000000310${this._generateRandomNumber(10, 99)}`,
        serial_no: `14930${this._generateRandomNumber(70000, 79999)}`,
        mid: `Autoca09995316023309`,
        tid: `2720${this._generateRandomNumber(4000, 4999)}`,
        ...this._totalizerFields(fuel_address, fuel_value.date, times_obj.time, fuel_value.rate),
      });
      sum_amount += amount_arr[i];
      sum_ltrs += parseFloat(amount_arr[i] / fuel_value.rate);
      receipt_no = txn_id;
    }
    addToHistory(HISTORY_KEYS.amount, String(amount));
    addToHistory(HISTORY_KEYS.mean, String(mean));
    document.title = `Fuel Bills - FY (${total_number_of_bills} bills)`;
    this.setState({ bills, pdf_view: true, sum_amount, sum_ltrs: sum_ltrs.toFixed(2), total_number_of_bills });
    ReactGA.event({
    category: 'User Interaction',
    action: 'Clicked a Button',
    label: 'Generate Fuel Bills',
    amount, fuel_type, sum_amount, sum_ltrs, mean
  })
  };

  _generateFuelBillsMonth = () => {
    let { amount, sum_amount, sum_ltrs, mean, number_of_bills, petrol_rate, range_start, range_end, selected_pumps, fuel_type } = this.state;
    const fuel_data = FUELS[fuel_type].data;
    if (mean === "" || mean === null || isNaN(mean) || mean.includes(".") || mean > 50000) {
      alert("Enter valid integer number in mean amount less than 50000");
      return;
    }
    mean = parseInt(mean);
    if (number_of_bills === "" || number_of_bills === null || isNaN(number_of_bills) || number_of_bills.includes(".") || number_of_bills > 30) {
      alert(`Enter valid integer number in number of bills and less than 30`);
      return;
    }
    number_of_bills = parseInt(number_of_bills);
    if (!range_start || !range_end) {
      alert("Enter both a start date and an end date");
      return;
    }
    if (range_start > range_end) {
      alert("Start date must be on or before the end date");
      return;
    }
    if (!selected_pumps.length) {
      alert("Select at least one petrol pump");
      return;
    }
    if (petrol_rate === "" || petrol_rate === null || isNaN(petrol_rate)) {
      const fallback = _avgRateForRange(range_start, range_end, fuel_type) || _latestRate(fuel_type);
      petrol_rate = parseFloat(fallback);
    } else {
      petrol_rate = parseFloat(petrol_rate);
    }
    // Both parse as UTC midnight, so the difference is a whole number of days.
    const range_start_ms = new Date(range_start).getTime();
    const month_tenure = Math.round((new Date(range_end).getTime() - range_start_ms) / _DAY_MS) + 1;
    let total_number_of_bills = number_of_bills;
    if (total_number_of_bills > month_tenure) {
      alert(`${range_start} to ${range_end} has only ${month_tenure} day(s) — reduce Number of Bills`);
      return;
    }
    let bills = [];
    let day_offsets = [];
    if (total_number_of_bills === 1) {
      day_offsets.push(0);
    } else {
      const span = month_tenure - 1;
      const step = span / (total_number_of_bills - 1);
      for (let i = 0; i < total_number_of_bills; i++) {
        let day = Math.round(i * step);
        if (i > 0 && day <= day_offsets[i - 1]) day = day_offsets[i - 1] + 1;
        if (day > span) day = span;
        day_offsets.push(day);
      }
    }
    let amount_arr = this._generateAmountArray(total_number_of_bills);
    let receipt_no = 2102709341 + this._generateRandomNumber(1000, 2102709341); // starting txn number
    
    // Check if we have real historical data for this range
    let month_rates = fuel_data.filter((item) => item.date >= range_start && item.date <= range_end);
    
    // The bill's own day's price; a day missing from the history takes the
    // nearest stored day's.
    const getClosestStoredRate = (targetDateStr) => {
      let targetTime = new Date(targetDateStr).getTime();
      let closestRate = fuel_data[fuel_data.length - 1].rate;
      let minDiff = Infinity;
      for (let item of fuel_data) {
         let diff = Math.abs(new Date(item.date).getTime() - targetTime);
         if (diff < minDiff) {
            minDiff = diff;
            closestRate = item.rate;
         }
      }
      return parseFloat(closestRate).toFixed(2);
    };

    for (let i = 0; i < total_number_of_bills; i++) {
      let dateStr = new Date(range_start_ms + day_offsets[i] * _DAY_MS).toISOString().split("T")[0];
      
      let rate;
      if (String(this.state.petrol_rate).trim() !== "" && !isNaN(parseFloat(this.state.petrol_rate))) {
        rate = parseFloat(this.state.petrol_rate).toFixed(2);
      } else {
        rate = getClosestStoredRate(dateStr);
        // If there's no historical data for this range (e.g. future date), 
        // add a tiny bit of random variance so the bills don't look identical.
        if (month_rates.length === 0) {
           let deviation = this._generateRandomNumber(-20, 20) / 100;
           rate = (parseFloat(rate) + deviation).toFixed(2);
        }
      }
      
      let fuel_value = { date: dateStr, rate: rate };
      let times_obj = this._getTime();
      let txn_id = this._generateRandomNumber(receipt_no + 10000, receipt_no + 1000000);
      let { station: fuel_station, address: fuel_address } = this._getRandomPump();
      bills.push({
        amount: amount_arr[i].toFixed(2),
        date: new Date(fuel_value.date),
        time: times_obj.time,
        rate: fuel_value.rate,
        ltr: parseFloat(amount_arr[i] / fuel_value.rate).toFixed(2),
        bay_no: this._generateRandomNumber(1, 8),
        nozzle_no: this._generateRandomNumber(1, 4),
        paymode: "CASH",
        txn_id,
        ..._fuelFields(this.state.fuel_type),
        bpcl_preset: ["Volume", "Amount"][Math.floor(Math.random() * 2)],
        ioc_preset: this._generateRandomNumber(10, 99) + "L",
        local_id: String(this._generateRandomNumber(100000, 999999)).padStart(8, '0'),
        atot: String((20000000000 + Math.random() * 8000000000).toFixed(2)).padStart(14, '0'),
        vtot: String((1000000 + Math.random() * 2000000).toFixed(2)).padStart(14, '0'),
        trns_id: String(this._generateRandomNumber(1000, 99999)).padStart(16, '0'),
        hdfc_no: `D ${fuel_value.date.split("-")[1]}/${fuel_value.date.split("-")[0]}`,
        txnSt: times_obj.txnSt,
        txnEnd: times_obj.txnEnd,
        fuel_station_logo: fuel_station.logo,
        fuel_station_name: fuel_station.organisation,
        fuel_station_address: fuel_address,
        fuel_station_tin: "06" + String(this._hashString(fuel_address)).padStart(9, '3').slice(-9),
        fuel_station_ph: "9" + String(this._hashString(fuel_address + "ph")).padStart(9, '8').slice(-9),
        paddingTop: this._generateRandomNumber(15, 35) + 'mm',
        paddingBottom: this._generateRandomNumber(20, 40) + 'mm',
        card_no: `************${this._generateRandomNumber(1000, 9999)}`,
        bank_mid: `5PR000001735416`,
        bank_tid: `PA0${this._generateRandomNumber(50000, 59999)}`,
        aid: `A00000000310${this._generateRandomNumber(10, 99)}`,
        serial_no: `14930${this._generateRandomNumber(70000, 79999)}`,
        mid: `Autoca09995316023309`,
        tid: `2720${this._generateRandomNumber(4000, 4999)}`,
        ...this._totalizerFields(fuel_address, fuel_value.date, times_obj.time, fuel_value.rate),
      });
      sum_amount += amount_arr[i];
      sum_ltrs += parseFloat(amount_arr[i] / fuel_value.rate);
      receipt_no = txn_id;
    }
    addToHistory(HISTORY_KEYS.mean, String(mean));
    addToHistory(HISTORY_KEYS.number_of_bills, String(number_of_bills));
    document.title = `Fuel Bills - ${range_start} to ${range_end} (${total_number_of_bills} bills)`;
    this.setState({ bills, pdf_view: true, sum_amount, sum_ltrs: sum_ltrs.toFixed(2), total_number_of_bills });
    ReactGA.event({
    category: 'User Interaction',
    action: 'Clicked a Button',
    label: 'Generate Fuel Bills Monthly',
    amount, sum_amount, sum_ltrs, mean, number_of_bills, petrol_rate, range_start, range_end
  })
  };

  _sanitizeFuelData = (fuel_data) => {
    // let { fuel_data } = this.state;
    let fy_fuel_data = [];
    for (let i = 0; i < fuel_data.length; i++) {
      if (new Date(fuel_data[i].date).getTime() >= new Date(`04-01-2024 00:00`).getTime()) {
        fy_fuel_data.push(fuel_data[i]);
      }
    }
    return JSON.stringify(fy_fuel_data);
  };

  componentDidMount() {
    // this._sanitizeFuelData();
  }

  processCanvasTo1Bit = (canvas) => {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Composite over white first.  A binary alpha test made every semi-opaque
      // pixel of a transparent-background logo read as full-strength colour,
      // which is what turned those logos into solid black blobs.
      const a = data[i + 3] / 255;
      const r = data[i] * a + 255 * (1 - a);
      const g = data[i + 1] * a + 255 * (1 - a);
      const b = data[i + 2] * a + 255 * (1 - a);

      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const color = luma > THERMAL_THRESHOLD ? 255 : 0;

      data[i] = color;
      data[i + 1] = color;
      data[i + 2] = color;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Capture one .thermal-58mm node as a bilevel canvas that is exactly
  // THERMAL_WIDTH_PX dots wide, i.e. 1 canvas pixel per printer dot.
  renderThermalCanvas = async (page) => {
    const targetPx = THERMAL_WIDTH_PX;
    const shot = await html2canvas(page, {
      scale: (targetPx * THERMAL_SUPERSAMPLE) / page.offsetWidth,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    // Downsample to the dot grid.  Going straight to targetPx via html2canvas
    // leaves the browser rasterising glyphs at a hinted size it handles badly;
    // supersampling and box-filtering here gives far cleaner stems.
    const out = document.createElement('canvas');
    out.width = targetPx;
    out.height = Math.max(1, Math.round((shot.height * targetPx) / shot.width));
    const octx = out.getContext('2d');
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, out.width, out.height);
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(shot, 0, 0, out.width, out.height);

    this.processCanvasTo1Bit(out);
    return out;
  };

  // Print straight from the browser -- no PDF round-trip.  The @page rule in
  // the print grid below sizes the sheet to the roll; the receipts already
  // carry page-break-after, so each one lands on its own slip.
  handlePrint58 = () => {
    if (document.querySelectorAll('.thermal-58mm').length === 0) return;
    window.print();
  };

  handleDownloadMultiplePDFs = async () => {
    const pages = document.querySelectorAll('.thermal-58mm');
    if (pages.length === 0) return;

    for (let i = 0; i < pages.length; i++) {
      try {
        const canvas = await this.renderThermalCanvas(pages[i]);
        const heightInMm = (canvas.height * THERMAL_WIDTH_MM) / canvas.width;

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [THERMAL_WIDTH_MM, heightInMm],
          compress: true,
        });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, THERMAL_WIDTH_MM, heightInMm, undefined, 'NONE');
        pdf.save(`thermal_receipt_${i + 1}.pdf`);
        // Browsers drop back-to-back programmatic downloads; let each land.
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (err) {
        console.error("Error generating PDF:", err);
      }
    }
  };

  handleDownloadSinglePDF = async () => {
    const pages = document.querySelectorAll('.thermal-58mm');
    if (pages.length === 0) return;

    let pdf = null;

    for (let i = 0; i < pages.length; i++) {
      try {
        const canvas = await this.renderThermalCanvas(pages[i]);
        const heightInMm = (canvas.height * THERMAL_WIDTH_MM) / canvas.width;

        if (!pdf) {
          pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [THERMAL_WIDTH_MM, heightInMm],
            compress: true,
          });
        } else {
          pdf.addPage([THERMAL_WIDTH_MM, heightInMm], 'portrait');
        }

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, THERMAL_WIDTH_MM, heightInMm, undefined, 'NONE');
      } catch (err) {
        console.error("Error generating PDF page:", err);
      }
    }

    if (pdf) {
      pdf.save(`thermal_receipts_all.pdf`);
    }
  };

  render() {
    const { amount, mean, bills, pdf_view, total_number_of_bills, sum_amount, sum_ltrs, month_mode, number_of_bills, petrol_rate, range_start, range_end, fuel_stations, selected_pumps, fuel_type } = this.state;
    const fuelLabel = FUELS[fuel_type].label;
    const avgRate = month_mode ? _avgRateForRange(range_start, range_end, fuel_type) : null;
    return (
      <div className="">
        {!pdf_view ? (
          <div className="bg-card">
            <h2 className="bg-card-title">Fuel Bill Generator</h2>
            <p className="bg-card-desc">Generate realistic {fuelLabel.toLowerCase()} bills with date and rate spread for your selected period.</p>

            <div className="bg-mode-row">
            <div className="bg-mode" role="tablist" aria-label="Period">
              <button
                type="button"
                className={`bg-mode-btn ${!month_mode ? "active" : ""}`}
                onClick={() => { if (month_mode) this._switch_mode(); }}
              >
                Financial Year
              </button>
              <button
                type="button"
                className={`bg-mode-btn ${month_mode ? "active" : ""}`}
                onClick={() => { if (!month_mode) this._switch_mode(); }}
              >
                Date Range
              </button>
            </div>
            </div>

            {month_mode ? (
              <div className="bg-grid">
                <div className="bg-field">
                  <label className="bg-label">Mean Bill Amount <span className="bg-label-hint">required</span></label>
                  <input
                    className="bg-input"
                    type="number"
                    placeholder="e.g. 4000"
                    value={mean}
                    onChange={(e) => this.onChange(e, "mean")}
                  />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Number of Bills <span className="bg-label-hint">1–30</span></label>
                  <input
                    className="bg-input"
                    type="number"
                    placeholder="e.g. 5"
                    value={number_of_bills}
                    onChange={(e) => this.onChange(e, "number_of_bills")}
                  />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Start Date <span className="bg-label-hint">required</span></label>
                  <input
                    className="bg-input"
                    type="date"
                    value={range_start}
                    max={range_end || undefined}
                    onChange={(e) => this.onChange(e, "range_start")}
                  />
                </div>
                <div className="bg-field">
                  <label className="bg-label">End Date <span className="bg-label-hint">required — bills stay within this range</span></label>
                  <input
                    className="bg-input"
                    type="date"
                    value={range_end}
                    min={range_start || undefined}
                    onChange={(e) => this.onChange(e, "range_end")}
                  />
                </div>
                <div className="bg-field">
                  <span className="bg-label">Fuel</span>
                  <div className="bg-mode bg-mode-input" role="tablist" aria-label="Fuel">
                    {Object.keys(FUELS).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`bg-mode-btn ${fuel_type === key ? "active" : ""}`}
                        onClick={() => this._setFuelType(key)}
                      >
                        {FUELS[key].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-field">
                  <label className="bg-label">{fuelLabel} Rate <span className="bg-label-hint">optional</span></label>
                  <input
                    className="bg-input"
                    type="number"
                    step="0.01"
                    placeholder={`Rate of the day${avgRate ? ` (avg ₹${avgRate})` : ""}`}
                    value={petrol_rate}
                    onChange={(e) => this.onChange(e, "petrol_rate")}
                  />
                  <span className="bg-hint">Leave empty to use each bill's own day's rate. A rate typed here goes on every bill.</span>
                </div>
              </div>
            ) : (
              <div className="bg-grid">
                <div className="bg-field">
                  <label className="bg-label">Total Amount <span className="bg-label-hint">required</span></label>
                  <input
                    className="bg-input"
                    type="number"
                    placeholder="Total to spread across the year"
                    value={amount}
                    onChange={(e) => this.onChange(e, "amount")}
                  />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Mean Bill Amount <span className="bg-label-hint">required, &lt; 10000</span></label>
                  <input
                    className="bg-input"
                    type="number"
                    placeholder="e.g. 4000"
                    value={mean}
                    onChange={(e) => this.onChange(e, "mean")}
                  />
                </div>
                <div className="bg-field">
                  <span className="bg-label">Fuel</span>
                  <div className="bg-mode bg-mode-input" role="tablist" aria-label="Fuel">
                    {Object.keys(FUELS).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`bg-mode-btn ${fuel_type === key ? "active" : ""}`}
                        onClick={() => this._setFuelType(key)}
                      >
                        {FUELS[key].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="fuel-pumps">
              <div className="fuel-pumps-head">
                <span className="bg-label">Petrol Pumps <span className="bg-label-hint">{selected_pumps.length} of {ALL_PUMP_KEYS.length} selected — bills are spread across these</span></span>
                <span className="fuel-pumps-bulk">
                  <button type="button" className="fuel-pumps-link" onClick={() => this._setSelectedPumps(ALL_PUMP_KEYS)}>All</button>
                  <button type="button" className="fuel-pumps-link" onClick={() => this._setSelectedPumps([])}>None</button>
                </span>
              </div>
              {fuel_stations.map((station) => {
                const keys = station.addresses.map((a) => _pumpKey(station.organisation, a));
                const onCount = keys.filter((k) => selected_pumps.includes(k)).length;
                return (
                  <fieldset key={station.organisation} className="fuel-pumps-group">
                    <legend>
                      <label className="fuel-pumps-item fuel-pumps-org">
                        <input
                          type="checkbox"
                          checked={onCount === keys.length}
                          ref={(el) => { if (el) el.indeterminate = onCount > 0 && onCount < keys.length; }}
                          onChange={() => this._toggleStation(station)}
                        />
                        <span>{station.organisation}</span>
                      </label>
                    </legend>
                    {station.addresses.map((address) => {
                      const key = _pumpKey(station.organisation, address);
                      return (
                        <label key={key} className="fuel-pumps-item">
                          <input type="checkbox" checked={selected_pumps.includes(key)} onChange={() => this._togglePump(key)} />
                          <span>{address}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                );
              })}
              {!selected_pumps.length ? <span className="bg-hint fuel-pumps-warn">Select at least one pump to generate bills</span> : null}
            </div>

            <div className="bg-actions">
              <button
                type="button"
                className="bg-btn bg-btn-primary"
                onClick={!month_mode ? this._generateFuelBills : this._generateFuelBillsMonth}
              >
                Generate Bills
              </button>
            </div>

            {!month_mode ? (
              <div className="bg-tips">
                <div className="bg-tips-title">Tips for best results</div>
                <div>Bills are generated with ±500 deviation from the mean amount.</div>
                <div>For an even spread across the year, divide your total by 92 and use that (rounded down) as the mean. That gives ~4-day gaps.</div>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="noprint bg-result-bar">
              <div className="bg-result-stats">
                <span className="bg-result-stat">Bills generated: <strong>{total_number_of_bills}</strong></span>
                <span className="bg-result-stat">Total amount: <strong>₹ {sum_amount}</strong></span>
                <span className="bg-result-stat">Total litres: <strong>{sum_ltrs}</strong></span>
              </div>
              <div className="bg-result-actions">
                <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-ghost">
                  ← New bills
                </button>
                <button onClick={this.handleDownloadSinglePDF} type="button" className="bg-btn bg-btn-secondary">
                  Single PDF
                </button>
                <button onClick={this.handleDownloadMultiplePDFs} type="button" className="bg-btn bg-btn-secondary">
                  PDF per bill
                </button>
                <button onClick={this.handlePrint58} type="button" className="bg-btn bg-btn-primary">
                  Print 58mm
                </button>
              </div>
            </div>
            <div className="noprint bg-callout">
                <span className="bg-callout-icon" aria-hidden="true">🖨</span>
                <div>
                  <strong>Printing on a 58mm thermal printer from a Mac?</strong>{" "}
                  Get the <a href={`${process.env.PUBLIC_URL}/downloads/Print58.dmg`} download>Print58 app</a>,
                  drag it to Applications, then drop the downloaded PDF on it. It pauses after each receipt so you can tear it off.
                  {" "}First launch is blocked because it isn't notarized by Apple: click Done, then System Settings → Privacy &amp; Security → Open Anyway.
                  {" "}Needs Ghostscript (<code>brew install ghostscript</code>) and Python Pillow. Prefer Terminal? Use <a href={`${process.env.PUBLIC_URL}/downloads/print58.sh`} download>print58.sh</a>.
                </div>
              </div>

            <div className="fuel-print-grid">
                <style>{`
                  @media print {
                    @page { size: 58mm auto; margin: 0; }
                    body, html { width: 58mm !important; margin: 0 !important; padding: 0 !important; }
                    .container { min-width: 0 !important; width: 58mm !important; padding: 0 !important; margin: 0 !important; }
                    .fuel-print-grid { width: 58mm !important; margin: 0 !important; padding: 0 !important; }
                  }
                `}</style>
                {bills.map((bill, idx) => {
                  let formattedDate = "";
                  try {
                    formattedDate = new Date(bill.date).toLocaleDateString('en-GB', {
                      day: '2-digit', month: '2-digit', year: '2-digit'
                    });
                  } catch (e) {
                    formattedDate = bill.date;
                  }
                  
                  let formattedTime = bill.time || "11:54";
                  if (formattedTime && formattedTime.split(':').length === 3) {
                    formattedTime = formattedTime.split(':').slice(0, 2).join(':');
                  }
                  
                  return (
                    <div key={idx} className="thermal-58mm" style={{ paddingTop: bill.paddingTop || '20mm', paddingBottom: bill.paddingBottom || '25mm' }}>
                      {bill.fuel_station_name === "Bharat Petroleum BPCL" ? (
                        <div className="thermal-receipt-body bpcl-receipt">
                          <div className="bpcl-logo-container">
                            <img src={bill.fuel_station_logo} alt="Bharat Petroleum" className="bpcl-logo" />
                          </div>
                          <div className="bpcl-welcomes">Welcomes You</div>
                          <div className="bpcl-address">
                            {bill.fuel_station_address.split(',').map((line, i) => <div key={i}>{line.trim()}</div>)}
                            <div>Tel. No.: {bill.fuel_station_ph || '8587975292'}</div>
                          </div>
                          
                          <div className="thermal-details bpcl-details">
                            <div className="bpcl-row"><span className="bpcl-label">Receipt No.</span><span className="bpcl-val">: H{String(bill.txn_id).slice(-4)}</span></div>
                            <div className="bpcl-row"><span className="bpcl-label">Local ID</span><span className="bpcl-val">: {bill.local_id || '00586113'}</span></div>
                            <div className="bpcl-row"><span className="bpcl-label">FIP No.</span><span className="bpcl-val">: 0{bill.bay_no}</span></div>
                            <div className="bpcl-row"><span className="bpcl-label">Nozzle No.</span><span className="bpcl-val">: 0{bill.nozzle_no}</span></div>
                            <div className="bpcl-row"><span className="bpcl-label">Product</span><span className="bpcl-val">: {bill.product ? bill.product.charAt(0) + bill.product.slice(1).toLowerCase() : "Petrol"}</span></div>
                            <div className="bpcl-row"><span className="bpcl-label">Density</span><span className="bpcl-val">: {bill.bpcl_density || '746.8Kg/Cu.mtr'}</span></div>
                            <div className="bpcl-row"><span className="bpcl-label">Preset Type</span><span className="bpcl-val">: {bill.bpcl_preset || 'Volume'}</span></div>
                            <div className="bpcl-row"><span className="bpcl-label">Rate(Rs/L)</span><span className="bpcl-val">: {parseFloat(bill.rate).toFixed(2)}</span></div>
                            <div className="bpcl-row"><span className="bpcl-label">Volume(L)</span><span className="bpcl-val">: {String(parseFloat(bill.ltr).toFixed(2)).padStart(8, '0')}</span></div>
                            <div className="bpcl-row"><span className="bpcl-label">Amount(Rs)</span><span className="bpcl-val">: {String(parseFloat(bill.amount).toFixed(2)).padStart(8, '0')}</span></div>
                            <div className="bpcl-row bpcl-row-tot"><span className="bpcl-label-tot">Atot:</span><span className="bpcl-val-tot">{String(bill.atot || '00229173053.14').padStart(14, '0')}</span></div>
                            <div className="bpcl-row bpcl-row-tot"><span className="bpcl-label-tot">Vtot:</span><span className="bpcl-val-tot">{String(bill.vtot || '00002378033.63').padStart(14, '0')}</span></div>
                          </div>
                          
                          <div className="bpcl-vehicle-info">
                            <div>Vehicle No: Not Entered</div>
                            <div>Mobile No : Not Entered</div>
                          </div>
                          
                          <div className="bpcl-datetime">
                            Date : {formattedDate} Time: {formattedTime}
                          </div>
                          
                          <div className="bpcl-tax-section">
                            <div className="bpcl-tax-row"><span className="bpcl-tax-label">CST No</span><span className="bpcl-tax-val">:</span></div>
                            <div className="bpcl-tax-row"><span className="bpcl-tax-label">LST No</span><span className="bpcl-tax-val">:</span></div>
                            <div className="bpcl-tax-row"><span className="bpcl-tax-label">VAT No</span><span className="bpcl-tax-val">:</span></div>
                            <div className="bpcl-tax-row"><span className="bpcl-tax-label">ATTENDANT ID</span><span className="bpcl-tax-val">: Not Available</span></div>
                            <div className="bpcl-tax-row"><span className="bpcl-tax-label">FCC DATE</span><span className="bpcl-tax-val">: Not Available</span></div>
                            <div className="bpcl-tax-row"><span className="bpcl-tax-label">FCC TIME</span><span className="bpcl-tax-val">: Not Available</span></div>
                          </div>
                          
                          <div className="bpcl-bottom-code">
                            00
                          </div>
                        </div>
                      ) : bill.fuel_station_name === "Hindustan Petroleum (HP)" ? (
                        <div className="thermal-receipt-body hpcl-receipt">
                          <div className="hpcl-header">
                            <img src={bill.fuel_station_logo} alt="Logo" className="hpcl-logo" />
                            <div className="hpcl-brand-name">Hindustan Petroleum<br/>Corporation Ltd.</div>
                            <div className="hpcl-address">
                              {bill.fuel_station_address.split(',').map((line, i) => <div key={i}>{line.trim()}</div>)}
                            </div>
                            <div>TIN: {bill.fuel_station_tin || '06721598421'}</div>
                            <div>TEL: {bill.fuel_station_ph || '9811456722'}</div>
                          </div>
                          
                          <div className="hpcl-details">
                            <div className="hpcl-row"><span className="hpcl-label">Rcpt No</span><span className="hpcl-val">: HP{bill.txn_id.toString().slice(-4)}</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">Trns.ID</span><span className="hpcl-val">: {bill.trns_id || '0000000000006365'}</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">Date</span><span className="hpcl-val">: {formattedDate}</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">Time</span><span className="hpcl-val">: {bill.time}</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">FIP No</span><span className="hpcl-val">: {bill.bay_no}</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">Nozzle</span><span className="hpcl-val">: {bill.nozzle_no}</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">Product</span><span className="hpcl-val">: {bill.product || 'Petrol'}</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">Density</span><span className="hpcl-val">: {bill.ioc_density || '746.5kg/m3'}</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">Rate</span><span className="hpcl-val">: Rs.{bill.rate}</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">Volume</span><span className="hpcl-val">: {bill.ltr}L</span></div>
                            <div className="hpcl-row"><span className="hpcl-label">Amount</span><span className="hpcl-val">: Rs.{bill.amount}</span></div>
                          </div>
                          
                          <div className="hpcl-footer">
                            <div>Thank You - Visit Again</div>
                          </div>
                        </div>
                      ) : (
                        <div className="thermal-receipt-body">
                          <div className="thermal-logo-container">
                            <img src={bill.fuel_station_logo} alt="Logo" className="thermal-logo" />
                            <div className="thermal-brand-name">{bill.fuel_station_name}</div>
                          </div>
                          <div className="thermal-header">
                            <div>{bill.fuel_station_address.split(',')[0] || "NH 8 GGN."}</div>
                            <div>TIN.{bill.fuel_station_tin || '06463800124'}</div>
                            <div>PH {bill.fuel_station_ph || '9212529333'}</div>
                          </div>
                          
                          <div className="thermal-details">
                            <div className="thermal-row">
                              <span className="thermal-label">Bill No</span>
                              <span className="thermal-val">:{bill.txn_id}-ORGNL</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Trns.ID</span>
                              <span className="thermal-val">:{bill.trns_id || '0000000000006365'}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Atnd.ID</span>
                              <span className="thermal-val">:</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Vehi.No</span>
                              <span className="thermal-val">:NotEntered</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Date</span>
                              <span className="thermal-val">:{formattedDate}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Time</span>
                              <span className="thermal-val">:{bill.time}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">FP. ID</span>
                              <span className="thermal-val">:{bill.bay_no}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Nozl No</span>
                              <span className="thermal-val">:{bill.nozzle_no}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Fuel</span>
                              <span className="thermal-val">:{bill.product || 'Petrol'}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Density</span>
                              <span className="thermal-val">:{bill.ioc_density || '746.5kg/m3'}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Preset</span>
                              <span className="thermal-val">:{bill.ioc_preset || '99L'}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Rate</span>
                              <span className="thermal-val">:Rs.{bill.rate}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Sale</span>
                              <span className="thermal-val">:Rs.{bill.amount}</span>
                            </div>
                            <div className="thermal-row">
                              <span className="thermal-label">Volume</span>
                              <span className="thermal-val">:{bill.ltr}L</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          </>
        )}
      </div>
    );
  }
}
