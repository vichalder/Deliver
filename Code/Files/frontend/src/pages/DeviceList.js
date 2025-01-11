import React, { useState, useEffect } from 'react';
import axios from 'axios';

function DeviceList() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/devices');
        setDevices(response.data);
        setLoading(false);
      } catch (err) {
        setError('Error fetching devices. Please try again later.');
        setLoading(false);
      }
    };

    fetchDevices();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Device List</h1>
      <table>
        <thead>
          <tr><th>Last seen</th><th>ID</th><th>Device Name</th><th>Status</th><th>Latitude</th><th>Longitude</th></tr>
        </thead>
        <tbody>
          {devices.map(device => (
            <tr key={device.id}>
              <td>{new Date(device.last_seen).toLocaleString()}</td>
              <td>{device.id}</td>
              <td>{device.name}</td>
              <td>{device.status}</td>
              <td>{device.last_latitude}</td>
              <td>{device.last_longitude}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DeviceList;
