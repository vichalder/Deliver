import React from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav>
      <ul>
        <li><Link to="/">Device List</Link></li>
        <li><Link to="/map">Map View</Link></li>
        <li><Link to="/historical">Historical Data</Link></li>
        <li><Link to="/geofencing">Geofencing</Link></li>
        <li><Link to="/alerts">Alert Configuration</Link></li>
      </ul>
    </nav>
  );
}

export default Navbar;