import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, FeatureGroup, Circle } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';

const API_BASE_URL = 'http://localhost:3000/api';

// Define default icon
let DefaultIcon = L.icon({
  iconUrl: iconUrl,
  shadowUrl: iconShadowUrl,
  iconAnchor: [12, 41],
});

/* const getDeviceIcon = (device) => {
  if (device.type === 'TypeA') {
    return L.icon({
      iconUrl: 'path/to/your/custom-icon-for-TypeA.png',
      shadowUrl: iconShadowUrl,
      iconAnchor: [12, 41],
    });
  } else if (device.type === 'TypeB') {
    return L.icon({
      iconUrl: 'path/to/your/custom-icon-for-TypeB.png',
      shadowUrl: iconShadowUrl,
      iconAnchor: [12, 41],
    });
  } else {
    return DefaultIcon;
  }
}; */

const getGeofenceColor = (type) => {
  return type === 'entering' ? 'blue' : 'orange';
};

// New function to create a numbered icon
const createNumberedIcon = (number) => {
  return L.divIcon({
    className: 'custom-numbered-icon',
    html: `<div style="background-color: #2196F3; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function HistoricalView() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapCenter, setMapCenter] = useState([55.828282, 10.605460]);
  const [mapZoom, setMapZoom] = useState(7);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/devices`);
        setDevices(response.data);
        setLoading(false);
      } catch (err) {
        setError('Error fetching devices. Please try again later.');
        setLoading(false);
      }
    };

    const fetchGeofences = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/geofences`);
        setGeofences(response.data);
      } catch (err) {
        console.error('Error fetching geofences:', err);
        setError('Error fetching geofences. Please try again later.');
      }
    };

    fetchDevices();
    fetchGeofences();
  }, []);

  useEffect(() => {
    if (devices.length > 0) {
      L.Icon.Default.imagePath = 'path/to/your/custom-icon-folder/';
    }
  }, [devices]);

  const fetchHistoricalData = async (deviceId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/devices/${deviceId}/history`);
      
      console.log('Raw historical data:', response.data);
      
      // Sort historical data by timestamp
      const sortedData = response.data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Add continuous numbering to all entries
      const numberedData = sortedData.map((item, index) => ({
        ...item,
        orderNumber: index + 1
      }));
      
      console.log('Processed historical data:', numberedData);
      
      setHistoricalData(numberedData);
      adjustMapView(numberedData);
    } catch (err) {
      console.error('Error fetching historical data:', err);
      setError('Error fetching historical data. Please try again later.');
    }
  };

  const handleDeviceSelect = (event) => {
    const deviceId = event.target.value;
    setSelectedDevice(deviceId);
    if (deviceId) {
      fetchHistoricalData(deviceId);
    } else {
      setHistoricalData([]);
      setMapCenter([55.828282, 10.605460]);
      setMapZoom(7);
    }
  };

  const adjustMapView = (data) => {
    if (data.length > 0) {
      const latitudes = data.map(point => point.latitude);
      const longitudes = data.map(point => point.longitude);
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);
      
      setMapCenter([(minLat + maxLat) / 2, (minLng + maxLng) / 2]);
      setMapZoom(10);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  const positions = historicalData.map(point => [point.latitude, point.longitude]);

  return (
    <div>
      <h1>Historical View</h1>
      <select onChange={handleDeviceSelect} value={selectedDevice || ''}>
        <option value="">Select a device</option>
        {devices.map(device => (
          <option key={device.id} value={device.id}>{device.name}</option>
        ))}
      </select>
      <div className="map-container">
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '800px', width: '100%' }}>
          <TileLayer
            url="https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=jqMrtdwJOEd6ITEcglsi"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {positions.length > 0 && <Polyline positions={positions} />}
          {historicalData.map((point) => {
            const device = devices.find(d => d.id === selectedDevice);
            return (
              <Marker 
                key={`${point.orderNumber}-${point.timestamp}`}
                position={[point.latitude, point.longitude]}
                icon={createNumberedIcon(point.orderNumber)}
              >
                <Popup>
                  Order: {point.orderNumber}<br />
                  Timestamp: {new Date(point.timestamp).toLocaleString()}<br />
                  Latitude: {point.latitude}<br />
                  Longitude: {point.longitude}
                </Popup>
              </Marker>
            );
          })}
          <FeatureGroup>
            {geofences.map((geofence) => (
              geofence && geofence.center && (
                <Circle 
                  key={geofence.id} 
                  center={[parseFloat(geofence.center.lat) || 0, parseFloat(geofence.center.lng) || 0]} 
                  radius={parseFloat(geofence.radius) || 0} 
                  pathOptions={{ color: getGeofenceColor(geofence.type) }}
                  id={geofence.id}
                >
                  <Popup>
                    Geofence ID: {geofence.id}
                  </Popup>
                </Circle>
              )
            ))}
          </FeatureGroup>
        </MapContainer>
      </div>
    </div>
  );
}

export default HistoricalView;