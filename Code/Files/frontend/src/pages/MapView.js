import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png'; // Default icon URL
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png'; // Shadow icon URL

// Define default icon
let DefaultIcon = L.icon({
  iconUrl: iconUrl,
  shadowUrl: iconShadowUrl,
  iconAnchor: [12, 41], // Point of the icon which will correspond to marker's location
});

const getDeviceIcon = (device) => {
  if (device.type === 'TypeA') {
    return L.icon({
      iconUrl: 'path/to/your/custom-icon-for-TypeA.png', // Custom icon URL for TypeA
      shadowUrl: iconShadowUrl,
      iconAnchor: [12, 41],
    });
  } else if (device.type === 'TypeB') {
    return L.icon({
      iconUrl: 'path/to/your/custom-icon-for-TypeB.png', // Custom icon URL for TypeB
      shadowUrl: iconShadowUrl,
      iconAnchor: [12, 41],
    });
  } else {
    return DefaultIcon;
  }
};

function MapView() {
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
  
  useEffect(() => {
    if (devices.length > 0) {
      L.Icon.Default.imagePath = 'path/to/your/custom-icon-folder/'; // Update the default icon path
    }
  }, [devices]);
  

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="map-container">
      <h1>Map View</h1>
      <MapContainer center={[55.828282, 10.605460]} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=jqMrtdwJOEd6ITEcglsi"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {devices.map(device => (
          device.last_latitude != null && device.last_longitude != null && (
            <Marker 
              key={device.id} 
              position={[Number(device.last_latitude), Number(device.last_longitude)]}
              icon={getDeviceIcon(device)} // Use the custom icon based on device type or status
            >
              <Popup>
                {device.name} - Type: {device.type}, Status: {device.status}
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
  
}

export default MapView;
