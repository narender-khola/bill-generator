import React, { Component } from "react";
import "./FuelBill.css";
import { fuel_data } from "./Fueldata";
import ReactGA from 'react-ga4';
import { getHistory, addToHistory } from "../utils/inputHistory";

const HISTORY_KEYS = {
  number_of_bills: "fuel_number_of_bills",
  mean: "fuel_mean",
  amount: "fuel_amount",
};

const _currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const _avgRateForMonth = (month) => {
  if (!month || !month.includes("-")) return null;
  const rows = fuel_data.filter((r) => r.date.startsWith(month));
  if (rows.length === 0) return null;
  const avg = rows.reduce((s, r) => s + parseFloat(r.rate), 0) / rows.length;
  return avg.toFixed(2);
};

const _latestRate = () => {
  if (!fuel_data.length) return "95.45";
  const latest = fuel_data.reduce((a, b) => (a.date > b.date ? a : b));
  return parseFloat(latest.rate).toFixed(2);
};

export default class FuelBill extends Component {
  constructor(props) {
    super(props);
    const initialMonth = _currentMonth();
    const initialAutoRate = _avgRateForMonth(initialMonth);
    const last = (k, fb) => (getHistory(HISTORY_KEYS[k])[0] ?? fb);
    this.state = {
      fuel_data: fuel_data,
      receipt_no: 5050,
      address: "",
      amount: last("amount", ""),
      mean: last("mean", "4000"),
      bills: [],
      pdf_view: false,
      sum_amount: 0,
      sum_ltrs: 0,
      month_mode: false,
      crumpled: false,
      month_end_date: "",
      number_of_bills: last("number_of_bills", "1"),
      petrol_rate: initialAutoRate || _latestRate(),
      petrol_rate_auto: !!initialAutoRate,
      month: initialMonth,
      fuel_stations: [
        {
          logo: process.env.PUBLIC_URL + "/images/indian-oil.png",
          organisation: "IndianOil / IOCL",
          addresses: ["Janta Filling Station – Sikanderpur, near Le Meridien, Sector 26", "NH 8, Sector 15 Part 1", "Khandelwal Oil Company – Opposite Ansal Plaza, Sector 1 Palam Vihar", "Shaheed Ramphal Kajla Filling Station – Sector 29"],
        },
        {
          logo: process.env.PUBLIC_URL + "/images/bharat-petroleum.png",
          organisation: "Bharat Petroleum BPCL",
          addresses: ["DLF Phase 5, Sector 43", "Opp Gold Sukh Mall, Sector 44", "Netaji Subhash Marg, Sector 47", "Delhi–Jaipur Expy, Sector 30", "Masani Village – LT Atul Kataria Marg, Sector 6", "Karamveer Filling Station – Rly Stn Rd, Opp Apna Encl, Gurugram", "Jawala Service Station – Delhi–Jaipur Expy, Sector 31"],
        },
        {
          logo: process.env.PUBLIC_URL + "/images/hp-oil.png",
          organisation: "Hindustan Petroleum (HP)",
          addresses: ["Mehrauli-Gurgaon Rd, Sector 17", "Sector 25 – Near Metro, DLF Phase 1", "Station Road, Sector 5", "Hira Fuels – Opp Jalvayu Towers, Sector 53", "HP (Sector 12A) – Sector 12", "Auto Care Centre – Near Tau Devi Lal Park, Sector 23A", "Subhash Chowk, Sector 48"],
        },
      ],
    };
  }

  _switch_mode = () => {
    this.setState((prevState) => ({ month_mode: !prevState.month_mode }));
  };

  onChange = (e, id) => {
    if (id === "month") {
      const month = e.target.value;
      const autoRate = _avgRateForMonth(month);
      this.setState({
        month,
        ...(autoRate
          ? { petrol_rate: autoRate, petrol_rate_auto: true }
          : { petrol_rate_auto: false }),
      });
      return;
    }
    if (id === "petrol_rate") {
      this.setState({ petrol_rate: e.target.value, petrol_rate_auto: false });
      return;
    }
    this.setState({ [id]: e.target.value });
  };

  _generateRandomNumber = (from_num, to_num) => {
    return from_num + Math.round(Math.random() * (to_num - from_num));
  };

  _getRandomFuelStation = () => {
    const { fuel_stations } = this.state;
    return fuel_stations[Math.floor(Math.random() * fuel_stations.length)];
  };

  _getRandomAddress = (addresses) => {
    return addresses[Math.floor(Math.random() * addresses.length)];
  };

  _getTime = () => {
    let ran_time1 = `${this._generateRandomNumber(10, 22)}:${this._generateRandomNumber(10, 54)}:${this._generateRandomNumber(10, 54)}`;
    let [hour, min, sec] = ran_time1.split(":");
    min = parseInt(min) + parseInt(this._generateRandomNumber(1, 2));
    sec = parseInt(sec) + parseInt(this._generateRandomNumber(1, 2));
    let ran_time2 = `${hour}:${min}:${sec}`;
    min = parseInt(min) + parseInt(this._generateRandomNumber(3, 5));
    sec = parseInt(sec) + parseInt(this._generateRandomNumber(3, 5));
    let ran_time3 = `${hour}:${min}:${sec}`;
    return {
      time: ran_time3,
      txnSt: ran_time1,
      txnEnd: ran_time2,
    };
  };

  _generateAmountArray = (total_number_of_bills) => {
    let amount_arr = [],
      { mean } = this.state;
    mean = parseInt(mean);
    for (let i = 0; i < parseInt(total_number_of_bills / 2); i++) {
      let ei = total_number_of_bills - 1 - i;
      let diff = this._generateRandomNumber(0, 500);
      if (i % 2 == 0) {
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
    
    let { amount, fuel_data, sum_amount, sum_ltrs, mean } = this.state;
    if (mean === "" || mean === null || isNaN(mean) || mean.includes(".") || mean > 10000) {
      alert("Enter valid integer number in mean amount less than 10000");
      return;
    }
    mean = parseInt(mean);
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
      let fuel_station = this._getRandomFuelStation();
      let fuel_address = this._getRandomAddress(fuel_station.addresses);
      bills.push({
        amount: amount_arr[i].toFixed(2),
        date: new Date(fuel_value.date),
        time: times_obj.time,
        rate: fuel_value.rate,
        ltr: parseFloat(amount_arr[i] / fuel_value.rate).toFixed(2),
        bay_no: this._generateRandomNumber(1, 8),
        nozzle_no: this._generateRandomNumber(1, 4),
        product: "PETROL",
        paymode: "CASH",
        txn_id,
        hdfc_no: `D ${fuel_value.date.split("-")[1]}/${fuel_value.date.split("-")[0]}`,
        txnSt: times_obj.txnSt,
        txnEnd: times_obj.txnEnd,
        fuel_station_logo: fuel_station.logo,
        fuel_station_name: fuel_station.organisation,
        fuel_station_address: fuel_address,
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
    amount, fuel_data, sum_amount, sum_ltrs, mean
  })
  };

  _generateFuelBillsMonth = () => {
    let { amount, sum_amount, sum_ltrs, mean, number_of_bills, petrol_rate, month, month_end_date } = this.state;
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
    if (petrol_rate === "" || petrol_rate === null || isNaN(petrol_rate)) {
      const fallback = _avgRateForMonth(month) || _latestRate();
      petrol_rate = parseFloat(fallback);
    } else {
      petrol_rate = parseFloat(petrol_rate);
    }
    if (month === "" || month === null) {
      alert(`Enter valid month`);
      return;
    }
    let month_arr = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
      month_tenure = 30;
    if (month && month.includes("-")) {
      let month_number = parseInt(month.split("-")[1]) - 1;
      month_tenure = month_arr[month_number];
    }
    if (month_end_date) {
      const end = new Date(month_end_date);
      const start = new Date(month);
      if (!isNaN(end.getTime()) && end.getFullYear() === start.getFullYear() && end.getMonth() === start.getMonth()) {
        month_tenure = Math.min(month_tenure, end.getDate());
      } else if (!isNaN(end.getTime()) && (end.getFullYear() < start.getFullYear() || (end.getFullYear() === start.getFullYear() && end.getMonth() < start.getMonth()))) {
        alert("End date must be in or after the selected month");
        return;
      }
    }
    if (month_tenure < 1) {
      alert("End date is before the start of the selected month");
      return;
    }
    let total_number_of_bills = number_of_bills;
    if (total_number_of_bills > month_tenure) {
      alert(`With end date ${month_end_date}, only ${month_tenure} day(s) are available — reduce Number of Bills`);
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
    
    // Get rates for the selected month from fuel_data
    let month_rates = [];
    if (month && month.includes("-")) {
      let month_year = month; // format: YYYY-MM
      month_rates = fuel_data.filter((item) => item.date.startsWith(month_year));
    }
    
    for (let i = 0; i < total_number_of_bills; i++) {
      let dateStr = new Date(new Date(month).getTime() + day_offsets[i] * 60 * 60 * 24 * 1000).toISOString().split("T")[0];
      
      // Determine rate: fetch from fuel_data or use petrol_rate with deviation
      let rate = petrol_rate;
      if (month_rates.length > 0) {
        // Find rate for this specific date in fuel_data
        let rate_entry = month_rates.find((item) => item.date === dateStr);
        if (rate_entry) {
          rate = rate_entry.rate;
        } else if (month_rates.length > 0) {
          // Use a random rate from the month's available rates
          rate = month_rates[Math.floor(Math.random() * month_rates.length)].rate;
        } else {
          // Fallback: use petrol_rate with ±0.20 deviation
          let deviation = this._generateRandomNumber(-20, 20) / 100;
          rate = (petrol_rate + deviation).toFixed(2);
        }
      } else {
        // No data for this month, use petrol_rate with ±0.20 deviation
        let deviation = this._generateRandomNumber(-20, 20) / 100;
        rate = (petrol_rate + deviation).toFixed(2);
      }
      
      let fuel_value = { date: dateStr, rate: rate };
      let times_obj = this._getTime();
      let txn_id = this._generateRandomNumber(receipt_no + 10000, receipt_no + 1000000);
      let fuel_station = this._getRandomFuelStation();
      let fuel_address = this._getRandomAddress(fuel_station.addresses);
      bills.push({
        amount: amount_arr[i].toFixed(2),
        date: new Date(fuel_value.date),
        time: times_obj.time,
        rate: fuel_value.rate,
        ltr: parseFloat(amount_arr[i] / fuel_value.rate).toFixed(2),
        bay_no: this._generateRandomNumber(1, 8),
        nozzle_no: this._generateRandomNumber(1, 4),
        product: "PETROL",
        paymode: "CASH",
        txn_id,
        hdfc_no: `D ${fuel_value.date.split("-")[1]}/${fuel_value.date.split("-")[0]}`,
        txnSt: times_obj.txnSt,
        txnEnd: times_obj.txnEnd,
        fuel_station_logo: fuel_station.logo,
        fuel_station_name: fuel_station.organisation,
        fuel_station_address: fuel_address,
      });
      sum_amount += amount_arr[i];
      sum_ltrs += parseFloat(amount_arr[i] / fuel_value.rate);
      receipt_no = txn_id;
    }
    addToHistory(HISTORY_KEYS.mean, String(mean));
    addToHistory(HISTORY_KEYS.number_of_bills, String(number_of_bills));
    document.title = `Fuel Bills - ${month} (${total_number_of_bills} bills)`;
    this.setState({ bills, pdf_view: true, sum_amount, sum_ltrs: sum_ltrs.toFixed(2), total_number_of_bills });
    ReactGA.event({
    category: 'User Interaction',
    action: 'Clicked a Button',
    label: 'Generate Fuel Bills Monthly',
    amount, sum_amount, sum_ltrs, mean, number_of_bills, petrol_rate, month
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

  render() {
    const { fuel_data, address, amount, mean, receipt_no, bills, pdf_view, total_number_of_bills, sum_amount, sum_ltrs, month_mode, number_of_bills, petrol_rate, petrol_rate_auto, month, crumpled, month_end_date } = this.state;
    return (
      <div className="">
        {!pdf_view ? (
          <div className="bg-card">
            <h2 className="bg-card-title">Fuel Bill Generator</h2>
            <p className="bg-card-desc">Generate realistic petrol bills with date and rate spread for your selected period.</p>

            <div className="bg-mode" role="tablist">
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
                Single Month
              </button>
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
                  <label className="bg-label">Month <span className="bg-label-hint">required</span></label>
                  <input
                    className="bg-input"
                    type="month"
                    value={month}
                    onChange={(e) => this.onChange(e, "month")}
                  />
                </div>
                <div className="bg-field">
                  <label className="bg-label">End Date <span className="bg-label-hint">optional — bills will not cross this date</span></label>
                  <input
                    className="bg-input"
                    type="date"
                    value={month_end_date}
                    min={month ? `${month}-01` : undefined}
                    max={month ? `${month}-31` : undefined}
                    onChange={(e) => this.onChange(e, "month_end_date")}
                  />
                </div>
                <div className="bg-field">
                  <label className="bg-label">Petrol Rate <span className="bg-label-hint">optional — auto-fills from history</span></label>
                  <input
                    className="bg-input"
                    type="number"
                    step="0.01"
                    placeholder="auto"
                    value={petrol_rate}
                    onChange={(e) => this.onChange(e, "petrol_rate")}
                  />
                  {petrol_rate_auto ? (
                    <span className="bg-hint bg-hint-success">Auto-filled: average rate for {month} from historical data</span>
                  ) : null}
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
              </div>
            )}

            <div className="bg-actions">
              <button
                type="button"
                className="bg-btn bg-btn-primary"
                onClick={!month_mode ? this._generateFuelBills : this._generateFuelBillsMonth}
              >
                Generate Bills
              </button>
              <label className="fuel-crumple-toggle">
                <input
                  type="checkbox"
                  checked={crumpled}
                  onChange={(e) => this.setState({ crumpled: e.target.checked })}
                />
                <span>Crumpled receipts (look scanned)</span>
              </label>
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
              <button onClick={() => window.location.reload()} type="button" className="bg-btn bg-btn-primary">
                Generate More
              </button>
            </div>

            <div className={`fuel-print-grid ${crumpled ? "fuel-crumpled" : ""}`}>
            {bills.map((bill, idx) => (
              <div data-v-c7ff15a2="" className={`fuel-print-card ${crumpled ? `fuel-card-tilt-${idx % 5}` : ""}`} style={{ display: "inline-block", width: "260px", verticalAlign: "top" }}>
                {/* <h5 data-v-c7ff15a2="" className="live-preview">
              Live Preview
            </h5> */}
                <bills-100-template data-v-c7ff15a2="" template-id="3" bill-type="FUEL_RECEIPT" preview-data='{"cinSelected":null,"logoSelected":"1","fuel_station_name":"","fuel_address":"","fuel_rate":"","date":"2023-01-29T19:01:25.951Z","time":"0:31","customer_name":"","v_number":"","v_type":null,"payment_method":null,"total":"","cin":"M43010GH195260","email":"","invoice_id":"0505","telNo":"638072","fccId":"6912","fccNo":"30","nozzleNo":"4","filename":"Fuel Bill Template 3","mode":"EMAIL","mobile":"","density":"","dealer_name":""}' vce-ready="">
                  <div id="app">
                    <div id="app">
                      <div></div>
                      <div>
                        <div data-v-6c875dfd="" className="newbody">
                          <div data-v-6c875dfd="" className="background">
                            <img data-v-6c875dfd="" src="https://bill-generator-assets.s3.ap-south-1.amazonaws.com/side-logo.png" alt="Bank Logo" className="sidelogo1" />
                            <img data-v-6c875dfd="" src="https://bill-generator-assets.s3.ap-south-1.amazonaws.com/side-logo.png" alt="Bank Logo" className="sidelogo2" />
                            <img data-v-6c875dfd="" src={bill.fuel_station_logo} alt="Logo" className="logo1" />
                            <p data-v-6c875dfd="" className="top">
                              WELCOME!!!
                            </p>
                            <p data-v-6c875dfd="" className="top" style={{ margin: "4px" }}></p>
                            <p data-v-6c875dfd="" className="top">
                              {bill.fuel_station_name}
                            </p>
                            <p data-v-6c875dfd="" className="top">
                              {bill.fuel_station_address}
                            </p>
                            {/* <p data-v-6c875dfd="" className="top">BPCL</p> */}

                            <div data-v-6c875dfd="" className="table1">
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  Receipt No.: {bill.txn_id}
                                </p>
                              </div>
                            </div>
                            <div data-v-6c875dfd="" className="table2">
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  PRODUCT: {bill.product}
                                </p>
                              </div>
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  RATE/LTR: ₹ {bill.rate}
                                </p>
                              </div>
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  AMOUNT: ₹ {bill.amount}
                                </p>
                              </div>
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  VOLUME(LTR.): lt {bill.ltr}
                                </p>
                              </div>
                            </div>
                            <div data-v-6c875dfd="" className="table1">
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  BAY No: {bill.bay_no}
                                </p>
                              </div>
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  NOZZLE NO: {bill.nozzle_no}
                                </p>
                              </div>
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  TXN ID: {bill.txn_id}
                                </p>
                              </div>
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  TXN ST: {bill.txnSt}
                                </p>
                              </div>
                              <div data-v-6c875dfd="" className="table-element">
                                <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                  TXN END: {bill.txnEnd}
                                </p>
                              </div>
                            </div>
                            <div data-v-6c875dfd="" className="table-element">
                              <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                Date: {bill.date.toLocaleDateString()}
                              </p>
                              <p data-v-6c875dfd=""> Time: {bill.time}</p>
                            </div>
                            <div data-v-6c875dfd="" className="table-element">
                              <p data-v-6c875dfd="" style={{ margin: "4px" }}>
                                MODE: {bill.paymode}
                              </p>
                            </div>
                            <p data-v-6c875dfd="" className="bottom">
                              SAVE FUEL YAANI SAVE MONEY !! THANKS FOR FUELLING WITH US. YOU CAN NOW CALL US ON 1800 226344 (TOLL-FREE) FOR QUERIES/COMPLAINTS.
                            </p>
                          </div>
                        </div>
                      </div>
                      <footer>
                        <div className="container">
                          <div className="row"></div>
                        </div>
                      </footer>
                    </div>
                  </div>
                </bills-100-template>
              </div>
            ))}
            </div>
          </>
        )}
      </div>
    );
  }
}
