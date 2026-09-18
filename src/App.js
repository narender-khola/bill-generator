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
import IffcoTokio from "./Components/IffcoTokio";
import CarRC from "./Components/CarRC";
import Login from "./Login";
import { isAuthed, logout } from "./auth";
import ReactGA from "react-ga4";

const TRACKING_ID = process.env.REACT_APP_GA_TRACKING_ID;
if (TRACKING_ID) {
  ReactGA.initialize(TRACKING_ID);
}

// Top-level tabs.  A tab with `options` groups several generators and shows
// a switcher above the form to pick between them.
const GENERATORS = [
  { id: "fuel", label: "Fuel Bill", component: FuelBill, available: true },
  { id: "fiber", label: "Fiber Bill", component: FiberBill, available: true },
  { id: "driver", label: "Driver Salary", component: DriverSalary, available: true },
  { id: "rent", label: "Rent Receipt", component: RentReceipt, available: true },
  {
    id: "medical",
    label: "Medical",
    available: true,
    options: [
      { id: "medical-hdfc", label: "HDFC Ergo", component: MedicalInsurance },
      { id: "medical-niva", label: "Niva Bupa", component: NivaBupa },
    ],
  },
  { id: "lta", label: "LTA", component: LTA, available: true },
  {
    id: "car",
    label: "Car",
    available: true,
    options: [
      { id: "car-insurance", label: "Insurance · Zurich Kotak", component: CarInsurance },
      { id: "car-insurance-iffco", label: "Insurance · IFFCO Tokio", component: IffcoTokio },
      { id: "car-rc", label: "RC (Delhi)", component: CarRC },
    ],
  },
];

function App() {
  const [active, setActive] = useState("fuel");
  // The option last picked in each grouped tab, so switching tabs and coming
  // back lands on the same one.
  const [picked, setPicked] = useState({});
  const [authed, setAuthed] = useState(() => isAuthed());
  if (!authed) return <Login onAuth={() => setAuthed(true)} />;
  const tab = GENERATORS.find((g) => g.id === active);
  const option = tab.options ? tab.options.find((o) => o.id === picked[tab.id]) || tab.options[0] : null;
  const Active = option ? option.component : tab.component;
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
          <a
            href={process.env.PUBLIC_URL + "/downloads/Print58.dmg"}
            download
            className="app-download-link"
            title="Print58 for Mac: drop receipt PDFs on it to print on a 58mm thermal printer, pausing after each receipt. Not notarized by Apple, so on first launch click Done, then System Settings → Privacy & Security → Open Anyway."
          >
            <span aria-hidden="true">↓</span> Mac print app
          </a>
          <a
            href="https://buymeacoffee.com/narender"
            target="_blank"
            rel="noreferrer"
            className="app-coffee-link"
            aria-label="Buy me a coffee"
          >
            <span role="img" aria-hidden="true">☕</span> Buy me a coffee
          </a>
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
        {tab.options ? (
          <div className="app-subnav noprint" role="tablist" aria-label={`${tab.label} generators`}>
            {tab.options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={o.id === option.id}
                className={`app-subnav-btn ${o.id === option.id ? "active" : ""}`}
                onClick={() => setPicked((p) => ({ ...p, [tab.id]: o.id }))}
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : null}
        <Active key={option ? option.id : tab.id} />
      </main>
      <BuildInfo />
    </div>
  );
}

function BuildInfo() {
  const sha = process.env.REACT_APP_GIT_SHA;
  const date = process.env.REACT_APP_BUILD_DATE;
  const formatted = date ? new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
  return (
    <footer className="app-footer noprint">
      <a href="https://buymeacoffee.com/narender" target="_blank" rel="noreferrer" className="app-footer-coffee">
        ☕ Buy me a coffee
      </a>
      {(sha || date) ? (
        <span className="app-footer-build">
          {" · "}build {sha ? (
            <a href={`https://github.com/narender-khola/bill-generator/commit/${sha}`} target="_blank" rel="noreferrer">{sha}</a>
          ) : "dev"}
          {formatted ? <span> · {formatted}</span> : null}
        </span>
      ) : null}
    </footer>
  );
}

export default App;
