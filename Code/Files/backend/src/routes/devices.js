const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Get all devices
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM devices');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single device
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Device not found' });
    } else {
      res.json(rows[0]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new device
router.post('/', async (req, res) => {
  const { name, type } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO devices (name, type, status) VALUES (?, ?, "active")',
      [name, type]
    );
    res.status(201).json({ id: result.insertId, name, type, status: 'active' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update device location
router.post('/:id/location', async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;
  try {
    await pool.query(
      'UPDATE devices SET last_latitude = ?, last_longitude = ?, last_seen = NOW() WHERE id = ?',
      [latitude, longitude, id]
    );
    await pool.query(
      'INSERT INTO device_history (device_id, latitude, longitude) VALUES (?, ?, ?)',
      [id, latitude, longitude]
    );
    res.status(200).json({ message: 'Location updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get device history
router.get('/:id/history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM device_history WHERE device_id = ? ORDER BY timestamp DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Connect device to geofence and update status
router.post('/:id/connect-geofence', async (req, res) => {
  const { id } = req.params;
  const { geofenceId } = req.body;
  
  try {
    // Get device and geofence details
    const [deviceRows] = await pool.query('SELECT * FROM devices WHERE id = ?', [id]);
    const [geofenceRows] = await pool.query('SELECT * FROM geofences WHERE id = ?', [geofenceId]);
    
    if (deviceRows.length === 0 || geofenceRows.length === 0) {
      return res.status(404).json({ error: 'Device or geofence not found' });
    }

    const device = deviceRows[0];
    const geofence = {
      id: geofenceRows[0].id,
      center: {
        lat: geofenceRows[0].center_lat,
        lng: geofenceRows[0].center_lng
      },
      radius: geofenceRows[0].radius,
      type: geofenceRows[0].type
    };

    // Calculate if device is inside geofence
    const R = 6371e3; // Earth's radius in meters
    const φ1 = device.last_latitude * Math.PI / 180;
    const φ2 = geofence.center.lat * Math.PI / 180;
    const Δφ = (geofence.center.lat - device.last_latitude) * Math.PI / 180;
    const Δλ = (geofence.center.lng - device.last_longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    const isInside = distance <= geofence.radius;
    
    // Update device status based on geofence type and position
    let newStatus = 'active';
    if ((geofence.type === 'exiting' && !isInside) || 
        (geofence.type === 'entering' && isInside)) {
      newStatus = 'illegal_state';
    }

    // Save device-geofence connection and update status
    await pool.query(
      'INSERT INTO device_geofences (device_id, geofence_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE geofence_id = ?',
      [id, geofenceId, geofenceId]
    );
    
    await pool.query(
      'UPDATE devices SET status = ? WHERE id = ?',
      [newStatus, id]
    );

    res.json({ 
      message: 'Device connected to geofence and status updated',
      status: newStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
