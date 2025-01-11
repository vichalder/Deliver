import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Circle, Tooltip } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const API_BASE_URL = 'http://localhost:3000/api';

function Geofencing() {
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGeofences = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/geofences`);
        console.log('Fetched geofences:', response.data);
        setGeofences(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching geofences:', err);
        setError('Error fetching geofences. Please try again later.');
        setLoading(false);
      }
    };

    fetchGeofences();
  }, []);

  const handleCreated = async (e) => {
    const { layer } = e;
    const { _latlng, _mRadius } = layer;
    const newGeofence = { center: _latlng, radius: _mRadius, type: 'entering' };
    
    try {
      const response = await axios.post(`${API_BASE_URL}/geofences`, newGeofence);
      const createdGeofence = response.data;
      setGeofences(prevGeofences => [...prevGeofences, createdGeofence]);
      layer.options.id = createdGeofence.id;
      layer.options.type = createdGeofence.type;
      console.log('Created geofence:', createdGeofence);
    } catch (err) {
      console.error('Error creating geofence:', err);
      setError('Error creating geofence. Please try again.');
    }
  };

  const handleEdited = async (e) => {
    const { layers } = e;
    console.log('Editing layers:', layers);
    layers.eachLayer(async (layer) => {
      const { _latlng, _mRadius } = layer;
      const geofenceId = layer.options.id;
      const geofenceType = layer.options.type;
      console.log('Editing geofence:', geofenceId, 'with latlng:', _latlng, 'radius:', _mRadius, 'and type:', geofenceType);
      
      if (geofenceId === undefined) {
        console.error('Geofence ID is undefined for layer:', layer);
        setError('Error updating geofence: ID not found');
        return;
      }

      const updatedGeofence = { center: _latlng, radius: _mRadius, type: geofenceType };
      
      try {
        const response = await axios.put(`${API_BASE_URL}/geofences/${geofenceId}`, updatedGeofence);
        console.log('Update response:', response.data);
        setGeofences(prevGeofences => 
          prevGeofences.map(g => g.id === geofenceId ? { ...g, ...updatedGeofence } : g)
        );
        console.log('Successfully updated geofence:', geofenceId);
      } catch (err) {
        console.error('Error updating geofence:', err);
        setError('Error updating geofence. Please try again.');
      }
    });
  };

  const handleDeleted = async (e) => {
    const { layers } = e;
    layers.eachLayer(async (layer) => {
      const geofenceId = layer.options.id;
      console.log('Deleting geofence:', geofenceId);
      
      if (geofenceId === undefined) {
        console.error('Geofence ID is undefined for layer:', layer);
        setError('Error deleting geofence: ID not found');
        return;
      }
      
      try {
        await axios.delete(`${API_BASE_URL}/geofences/${geofenceId}`);
        setGeofences(prevGeofences => prevGeofences.filter(g => g.id !== geofenceId));
        console.log('Successfully deleted geofence:', geofenceId);
      } catch (err) {
        console.error('Error deleting geofence:', err);
        setError('Error deleting geofence. Please try again.');
      }
    });
  };

  const getGeofenceColor = (type) => {
    return type === 'entering' ? 'blue' : 'orange';
  };

  const toggleGeofenceType = async (geofence) => {
    const newType = geofence.type === 'entering' ? 'exiting' : 'entering';
    const updatedGeofence = { ...geofence, type: newType };
    
    try {
      const response = await axios.put(`${API_BASE_URL}/geofences/${geofence.id}`, updatedGeofence);
      console.log('Update response:', response.data);
      setGeofences(prevGeofences => 
        prevGeofences.map(g => g.id === geofence.id ? { ...g, type: newType } : g)
      );
      console.log('Successfully updated geofence type:', geofence.id);
    } catch (err) {
      console.error('Error updating geofence type:', err);
      setError('Error updating geofence type. Please try again.');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>Geofencing</h1>
      <div className="map-container">
        <MapContainer center={[55.828282, 10.605460]} zoom={7} style={{ height: '800px', width: '100%' }}>
          <TileLayer
            url="https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=jqMrtdwJOEd6ITEcglsi"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <FeatureGroup>
            <EditControl
              position="topright"
              onCreated={handleCreated}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
              draw={{
                rectangle: false,
                polygon: false,
                polyline: false,
                marker: false,
                circlemarker: false,
                circle: { shapeOptions: { color: 'blue' } }
              }}
            />
            {geofences.map((geofence) => (
              geofence && geofence.center && (
                <Circle 
                  key={geofence.id} 
                  center={[parseFloat(geofence.center.lat) || 0, parseFloat(geofence.center.lng) || 0]} 
                  radius={parseFloat(geofence.radius) || 0} 
                  pathOptions={{ color: getGeofenceColor(geofence.type) }}
                  id={geofence.id}
                  type={geofence.type}
                >
                  <Tooltip permanent>
                    <span>Geofence ID: {geofence.id}</span>
                  </Tooltip>
                </Circle>
              )
            ))}
          </FeatureGroup>
        </MapContainer>
      </div>
      <div>
        <h2>Geofences:</h2>
        <ul>
          {geofences.map((geofence) => (
            geofence && geofence.center && (
              <li key={geofence.id}>
                ID: {geofence.id} - 
                Center: {parseFloat(geofence.center.lat).toFixed(6)}, {parseFloat(geofence.center.lng).toFixed(6)} - 
                Radius: {parseFloat(geofence.radius).toFixed(2)}m - 
                Type: {geofence.type}
                <button onClick={() => toggleGeofenceType(geofence)}>Toggle Type</button>
              </li>
            )
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Geofencing;