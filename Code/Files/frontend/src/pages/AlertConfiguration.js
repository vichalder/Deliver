import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AlertConfiguration = () => {
  const [devices, setDevices] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedGeofence, setSelectedGeofence] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    fetchDevices();
    fetchGeofences();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get('/api/devices');
      setDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchGeofences = async () => {
    try {
      const response = await axios.get('/api/geofences');
      setGeofences(response.data);
    } catch (error) {
      console.error('Error fetching geofences:', error);
    }
  };

  const handleDeviceChange = (e) => {
    setSelectedDevice(e.target.value);
    checkAlert(e.target.value, selectedGeofence);
  };

  const handleGeofenceChange = (e) => {
    setSelectedGeofence(e.target.value);
    checkAlert(selectedDevice, e.target.value);
  };

  const checkAlert = async (deviceId, geofenceId) => {
    if (!deviceId || !geofenceId) {
      setAlertMessage('');
      return;
    }

    try {
      const deviceResponse = await axios.get(`/api/devices/${deviceId}`);
      const geofenceResponse = await axios.get(`/api/geofences/${geofenceId}`);
      
      const device = deviceResponse.data;
      const geofence = geofenceResponse.data;

      const distance = calculateDistance(
        device.last_latitude,
        device.last_longitude,
        geofence.center.lat,
        geofence.center.lng
      );

      const isInside = distance <= geofence.radius;

      if (geofence.type === 'entering' && isInside) {
        setAlertMessage(`Alert: Device ${device.name} has entered geofence ${geofence.id}`);
      } else if (geofence.type === 'exiting' && !isInside) {
        setAlertMessage(`Alert: Device ${device.name} has exited geofence ${geofence.id}`);
      } else {
        setAlertMessage('');
      }
    } catch (error) {
      console.error('Error checking alert:', error);
      setAlertMessage('Error checking alert status');
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  return (
    <div className="alert-configuration">
      <h2>Alert Configuration</h2>
      <div>
        <label htmlFor="device-select">Select Device: </label>
        <select
          id="device-select"
          value={selectedDevice}
          onChange={handleDeviceChange}
        >
          <option value="">Select a device</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="geofence-select">Select Geofence: </label>
        <select
          id="geofence-select"
          value={selectedGeofence}
          onChange={handleGeofenceChange}
        >
          <option value="">Select a geofence</option>
          {geofences.map((geofence) => (
            <option key={geofence.id} value={geofence.id}>
              Geofence {geofence.id} ({geofence.type})
            </option>
          ))}
        </select>
      </div>
      {alertMessage && (
        <div className="alert-message">
          {alertMessage}
        </div>
      )}
    </div>
  );
};

export default AlertConfiguration;