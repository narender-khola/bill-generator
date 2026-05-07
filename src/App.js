import React, { useState } from "react";
import "./App.css";
import "./app-shell.css";
import FuelBill from "./Components/FuelBill";
import FiberBill from "./Components/FiberBill";
import DriverSalary from "./Components/DriverSalary";
import RentReceipt from "./Components/RentReceipt";
import MedicalInsurance from "./Components/MedicalInsurance";
import NivaBupa from "./Components/NivaBupa";
import LTA from "./Components/LTA";
import CarInsurance from "./Components/CarInsurance";
import CarRC from "./Components/CarRC";
import Login from "./Login";
import { isAuthed, logout } from "./auth";
import ReactGA from "react-ga4";

const TRACKING_ID = process.env.REACT_APP_GA_TRACKING_ID;
if (TRACKING_ID) {
  ReactGA.initialize(TRACKING_ID);
}

const GENERATORS = [
  { id: "fuel", label: "Fuel Bill", component: FuelBill, available: true },
  { id: "fiber", label: "Fiber Bill", component: FiberBill, available: true },
  { id: "driver", label: "Driver Salary", component: DriverSalary, available: true },
  { id: "rent", label: "Rent Receipt", component: RentReceipt, available: true },
  { id: "medical-hdfc", label: "Medical (HDFC)", component: MedicalInsurance, available: true },
  { id: "medical-niva", label: "Medical (Niva Bupa)", component: NivaBupa, available: true },
  { id: "lta", label: "LTA", component: LTA, available: true },
  { id: "car-insurance", label: "Car Insurance", component: CarInsurance, available: true },
  { id: "car-rc", label: "Car RC (Delhi)", component: CarRC, available: true },
];

function App() {
  const [active, setActive] = useState("fuel");
  const [authed, setAuthed] = useState(() => isAuthed());
  if (!authed) return <Login onAuth={() => setAuthed(true)} />;
  const Active = GENERATORS.find((g) => g.id === active).component;
  const onLogout = () => { logout(); setAuthed(false); };
  return (
    <div className="app-shell">
      <header className="app-header noprint">
        <div className="app-header-row">
          <img src={process.env.PUBLIC_URL + "/favicon.svg"} alt="" className="app-header-logo" />
          <div>
            <h1 className="app-title">Bill Generator</h1>
            <p className="app-subtitle">Fuel, fiber, and more — pick a generator below.</p>
          </div>
          <button type="button" className="app-logout-btn" onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <nav className="app-nav noprint">
        {GENERATORS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`app-nav-tab ${active === g.id ? "active" : ""} ${!g.available ? "disabled" : ""}`}
            onClick={() => g.available && setActive(g.id)}
            disabled={!g.available}
          >
            {g.label}
            {!g.available ? <span className="app-nav-badge">Soon</span> : null}
          </button>
        ))}
      </nav>
      <main className="app-content">
        <Active />
      </main>
      <BuildInfo />
    </div>
  );
}

function BuildInfo() {
  const sha = process.env.REACT_APP_GIT_SHA;
  const date = process.env.REACT_APP_BUILD_DATE;
  if (!sha && !date) return null;
  const formatted = date ? new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
  return (
    <footer className="app-footer noprint">
      build {sha ? (
        <a href={`https://github.com/narender-khola/bill-generator/commit/${sha}`} target="_blank" rel="noreferrer">{sha}</a>
      ) : "dev"}
      {formatted ? <span> · {formatted}</span> : null}
    </footer>
  );
}

export default App;
