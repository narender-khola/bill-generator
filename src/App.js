import logo from './logo.svg';
import './App.css';
import FuelBill from "./Components/FuelBill";
import FiberBill from './Components/FiberBill';
import ReactGA from 'react-ga4';

const TRACKING_ID = process.env.REACT_APP_GA_TRACKING_ID;
if (TRACKING_ID) {
  ReactGA.initialize(TRACKING_ID);
}


function App() {
    return (
      <FuelBill />
    );
}

export default App;
