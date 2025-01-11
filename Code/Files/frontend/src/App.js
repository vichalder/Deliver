import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import DeviceList from './pages/DeviceList';
import MapView from './pages/MapView';
import HistoricalView from './pages/HistoricalView';
import Geofencing from './pages/Geofencing';
import AlertConfiguration from './pages/AlertConfiguration';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="sidebar">
          <ul>
            <li>
              <Link to="/" className={window.location.pathname === '/' ? 'active' : ''}>Device list</Link>
            </li>
            <li>
              <Link to="/map" className={window.location.pathname === '/map' ? 'active' : ''}>Map view</Link>
            </li>
            <li>
              <Link to="/historical" className={window.location.pathname === '/historical' ? 'active' : ''}>Historical data</Link>
            </li>
            <li>
              <Link to="/geofencing" className={window.location.pathname === '/geofencing' ? 'active' : ''}>Geofencing</Link>
            </li>
            <li>
              <Link to="/alerts" className={window.location.pathname === '/alerts' ? 'active' : ''}>Alerts</Link>
            </li>
          </ul>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<DeviceList />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/historical" element={<HistoricalView />} />
            <Route path="/geofencing" element={<Geofencing />} />
            <Route path="/alerts" element={<AlertConfiguration />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;